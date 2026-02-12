package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	otelmetric "go.opentelemetry.io/otel/metric"
	oteltrace "go.opentelemetry.io/otel/trace"
	"golang.org/x/time/rate"

	qgotel "github.com/stym06/quickgithub/worker/internal/otel"
)

var tracer = otel.Tracer("quickgithub-worker/llm")

const (
	ModelSonnet = "claude-sonnet-4-5-20250929"
	ModelHaiku  = "claude-haiku-4-5-20251001"

	OpenAIModelMain = "gpt-4o"
	OpenAIModelFast = "gpt-4o-mini"

	maxRetries   = 8
	baseBackoff  = 2 * time.Second
	maxBackoff   = 60 * time.Second
	maxTokens    = 4096
	haikuMaxToks = 2048

	// Default: 500 RPM — the proactive limiter is effectively transparent.
	// Actual pace is governed reactively by 429 + Retry-After parsing.
	// Tune down via LLM_RATE_LIMIT_RPM env var if needed.
	defaultRateLimitRPM = 500

	// Default TPM limit (input + output tokens combined per minute).
	// Tune via LLM_RATE_LIMIT_TPM env var to match your Anthropic tier.
	defaultRateLimitTPM = 200000
)

// Provider identifies which LLM backend to use.
type Provider string

const (
	ProviderAnthropic Provider = "anthropic"
	ProviderOpenAI    Provider = "openai"
)

// ToolUseResult holds the extracted structured output from an LLM call.
type ToolUseResult struct {
	ID    string
	Name  string
	Input json.RawMessage
}

// CallResult holds the full result of an LLM call including token usage.
type CallResult struct {
	ToolUse      *ToolUseResult
	Text         string
	InputTokens  int
	OutputTokens int
	Model        string
}

// Client wraps LLM API access and supports both Anthropic and OpenAI backends.
type Client struct {
	provider     Provider
	anthropic    *anthropic.Client
	openAIKey    string
	limiter      *rate.Limiter // RPM limiter
	tokenLimiter *rate.Limiter // TPM limiter
}

// NewClient creates an LLM client for the given provider.
func NewClient(provider string, anthropicKey string, openaiKey string) *Client {
	rpm := defaultRateLimitRPM
	if v := os.Getenv("LLM_RATE_LIMIT_RPM"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			rpm = n
		}
	}

	tpm := defaultRateLimitTPM
	if v := os.Getenv("LLM_RATE_LIMIT_TPM"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			tpm = n
		}
	}

	// Token limiter: refills at TPM/60 tokens per second, burst up to full TPM.
	tokensPerSec := rate.Limit(float64(tpm) / 60.0)

	c := &Client{
		provider:     Provider(provider),
		openAIKey:    openaiKey,
		limiter:      rate.NewLimiter(rate.Every(time.Minute/time.Duration(rpm)), 1),
		tokenLimiter: rate.NewLimiter(tokensPerSec, tpm),
	}

	if provider == "anthropic" && anthropicKey != "" {
		ac := anthropic.NewClient(option.WithAPIKey(anthropicKey))
		c.anthropic = &ac
	}

	log.Printf("LLM client rate limiter: %d RPM, %d TPM", rpm, tpm)
	return c
}

// waitForRateLimit blocks until the RPM rate limiter allows a request.
func (c *Client) waitForRateLimit(ctx context.Context) error {
	return c.limiter.Wait(ctx)
}

// consumeTokens blocks until the TPM budget can accommodate the given number
// of tokens. Call this after each LLM response with the actual token count;
// it will delay the next call if the budget is running low.
func (c *Client) consumeTokens(ctx context.Context, tokens int) {
	if tokens <= 0 {
		return
	}
	// WaitN blocks until the token bucket has replenished enough capacity,
	// effectively pacing subsequent calls to stay within the TPM limit.
	if err := c.tokenLimiter.WaitN(ctx, tokens); err != nil {
		log.Printf("TPM limiter wait interrupted: %v", err)
	}
}

// retryBackoff returns the backoff duration for an attempt, capped at maxBackoff.
// If the API returned a Retry-After hint, that takes precedence.
func retryBackoff(attempt int, retryAfter time.Duration) time.Duration {
	if retryAfter > 0 {
		return retryAfter
	}
	backoff := baseBackoff * time.Duration(1<<uint(attempt))
	if backoff > maxBackoff {
		backoff = maxBackoff
	}
	return backoff
}

// CallSonnetWithTools calls the main LLM model with tool definitions for structured output.
func (c *Client) CallSonnetWithTools(ctx context.Context, system string, messages []anthropic.MessageParam, tools []anthropic.ToolUnionParam) (*CallResult, error) {
	switch c.provider {
	case ProviderOpenAI:
		return c.callOpenAIWithTools(ctx, system, messages, tools)
	default:
		return c.callAnthropicWithTools(ctx, system, messages, tools)
	}
}

// CallHaiku calls a fast/cheap LLM for simple text generation.
func (c *Client) CallHaiku(ctx context.Context, system string, messages []anthropic.MessageParam) (*CallResult, error) {
	switch c.provider {
	case ProviderOpenAI:
		return c.callOpenAIText(ctx, system, messages)
	default:
		return c.callAnthropicHaiku(ctx, system, messages)
	}
}

// recordLLMMetrics records common metrics for an LLM call.
func recordLLMMetrics(ctx context.Context, model, provider string, inputTokens, outputTokens int, durationMs int64) {
	attrs := attribute.String("gen_ai.request.model", model)
	sysAttr := attribute.String("gen_ai.system", provider)

	qgotel.LLMCallsTotal.Add(ctx, 1, otelmetric.WithAttributes(attrs, sysAttr))
	qgotel.LLMInputTokens.Add(ctx, int64(inputTokens), otelmetric.WithAttributes(attrs, sysAttr))
	qgotel.LLMOutputTokens.Add(ctx, int64(outputTokens), otelmetric.WithAttributes(attrs, sysAttr))
	qgotel.LLMLatency.Record(ctx, durationMs, otelmetric.WithAttributes(attrs, sysAttr))

	cost := estimateCost(model, inputTokens, outputTokens)
	if cost > 0 {
		qgotel.LLMCostTotal.Add(ctx, cost, otelmetric.WithAttributes(attrs, sysAttr))
	}
}

// estimateCost returns estimated USD cost based on model and token counts.
func estimateCost(model string, inputTokens, outputTokens int) float64 {
	// Prices per 1M tokens (approximate)
	var inputPrice, outputPrice float64
	switch model {
	case ModelSonnet:
		inputPrice, outputPrice = 3.0, 15.0
	case ModelHaiku:
		inputPrice, outputPrice = 0.80, 4.0
	case OpenAIModelMain:
		inputPrice, outputPrice = 2.50, 10.0
	case OpenAIModelFast:
		inputPrice, outputPrice = 0.15, 0.60
	default:
		return 0
	}
	return (float64(inputTokens)*inputPrice + float64(outputTokens)*outputPrice) / 1_000_000
}

// --- Anthropic implementation ---

func (c *Client) callAnthropicWithTools(ctx context.Context, system string, messages []anthropic.MessageParam, tools []anthropic.ToolUnionParam) (*CallResult, error) {
	ctx, span := tracer.Start(ctx, "llm.call",
		oteltrace.WithAttributes(
			attribute.String("gen_ai.system", "anthropic"),
			attribute.String("gen_ai.request.model", ModelSonnet),
		),
	)
	defer span.End()

	if err := c.waitForRateLimit(ctx); err != nil {
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	start := time.Now()
	var lastErr error

	for attempt := range maxRetries {
		resp, err := c.anthropic.Messages.New(ctx, anthropic.MessageNewParams{
			Model:     ModelSonnet,
			MaxTokens: maxTokens,
			System: []anthropic.TextBlockParam{
				{Text: system},
			},
			Messages: messages,
			Tools:    tools,
			ToolChoice: anthropic.ToolChoiceUnionParam{
				OfAny: &anthropic.ToolChoiceAnyParam{},
			},
		})
		if err != nil {
			lastErr = err
			if attempt < maxRetries-1 {
				backoff := retryBackoff(attempt, 0)
				log.Printf("Anthropic API error (attempt %d/%d): %v, retrying in %v", attempt+1, maxRetries, err, backoff)
				span.AddEvent("retry", oteltrace.WithAttributes(
					attribute.Int("attempt", attempt+1),
					attribute.String("error", err.Error()),
				))
				select {
				case <-ctx.Done():
					span.SetStatus(codes.Error, ctx.Err().Error())
					return nil, ctx.Err()
				case <-time.After(backoff):
				}
				continue
			}
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
			return nil, fmt.Errorf("Anthropic API call failed after %d attempts: %w", maxRetries, err)
		}

		inputTok := int(resp.Usage.InputTokens)
		outputTok := int(resp.Usage.OutputTokens)
		durationMs := time.Since(start).Milliseconds()

		span.SetAttributes(
			attribute.Int("gen_ai.usage.input_tokens", inputTok),
			attribute.Int("gen_ai.usage.output_tokens", outputTok),
		)
		recordLLMMetrics(ctx, ModelSonnet, "anthropic", inputTok, outputTok, durationMs)
		c.consumeTokens(ctx, inputTok+outputTok)

		for _, block := range resp.Content {
			if block.Type == "tool_use" {
				return &CallResult{
					ToolUse: &ToolUseResult{
						ID:    block.ID,
						Name:  block.Name,
						Input: block.Input,
					},
					InputTokens:  inputTok,
					OutputTokens: outputTok,
					Model:        ModelSonnet,
				}, nil
			}
		}

		err = fmt.Errorf("no tool_use block in Anthropic response")
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	span.SetStatus(codes.Error, lastErr.Error())
	span.RecordError(lastErr)
	return nil, lastErr
}

func (c *Client) callAnthropicHaiku(ctx context.Context, system string, messages []anthropic.MessageParam) (*CallResult, error) {
	ctx, span := tracer.Start(ctx, "llm.call",
		oteltrace.WithAttributes(
			attribute.String("gen_ai.system", "anthropic"),
			attribute.String("gen_ai.request.model", ModelHaiku),
		),
	)
	defer span.End()

	if err := c.waitForRateLimit(ctx); err != nil {
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	start := time.Now()
	var lastErr error

	for attempt := range maxRetries {
		resp, err := c.anthropic.Messages.New(ctx, anthropic.MessageNewParams{
			Model:     ModelHaiku,
			MaxTokens: haikuMaxToks,
			System: []anthropic.TextBlockParam{
				{Text: system},
			},
			Messages: messages,
		})
		if err != nil {
			lastErr = err
			if attempt < maxRetries-1 {
				backoff := retryBackoff(attempt, 0)
				log.Printf("Anthropic Haiku API error (attempt %d/%d): %v, retrying in %v", attempt+1, maxRetries, err, backoff)
				select {
				case <-ctx.Done():
					span.SetStatus(codes.Error, ctx.Err().Error())
					return nil, ctx.Err()
				case <-time.After(backoff):
				}
				continue
			}
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
			return nil, fmt.Errorf("Anthropic Haiku API call failed after %d attempts: %w", maxRetries, err)
		}

		inputTok := int(resp.Usage.InputTokens)
		outputTok := int(resp.Usage.OutputTokens)
		durationMs := time.Since(start).Milliseconds()

		span.SetAttributes(
			attribute.Int("gen_ai.usage.input_tokens", inputTok),
			attribute.Int("gen_ai.usage.output_tokens", outputTok),
		)
		recordLLMMetrics(ctx, ModelHaiku, "anthropic", inputTok, outputTok, durationMs)
		c.consumeTokens(ctx, inputTok+outputTok)

		var result string
		for _, block := range resp.Content {
			if block.Type == "text" {
				result += block.Text
			}
		}
		return &CallResult{
			Text:         result,
			InputTokens:  inputTok,
			OutputTokens: outputTok,
			Model:        ModelHaiku,
		}, nil
	}

	span.SetStatus(codes.Error, lastErr.Error())
	span.RecordError(lastErr)
	return nil, lastErr
}
