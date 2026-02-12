package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	otelmetric "go.opentelemetry.io/otel/metric"
	oteltrace "go.opentelemetry.io/otel/trace"

	qgotel "github.com/stym06/quickgithub/worker/internal/otel"
)

// rateLimitError wraps a 429 response and carries the Retry-After hint.
type rateLimitError struct {
	msg        string
	retryAfter time.Duration
}

func (e *rateLimitError) Error() string { return e.msg }

const openAIBaseURL = "https://api.openai.com/v1/chat/completions"

// openAIRequest is the request body for the OpenAI Chat Completions API.
type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Tools       []openAITool    `json:"tools,omitempty"`
	ToolChoice  interface{}     `json:"tool_choice,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Temperature float64         `json:"temperature,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAITool struct {
	Type     string             `json:"type"`
	Function openAIToolFunction `json:"function"`
}

type openAIToolFunction struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters"`
}

// openAIResponse is the response from the OpenAI Chat Completions API.
type openAIResponse struct {
	Choices []openAIChoice `json:"choices"`
	Usage   *openAIUsage   `json:"usage,omitempty"`
	Error   *openAIError   `json:"error,omitempty"`
}

type openAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type openAIChoice struct {
	Message openAIResponseMessage `json:"message"`
}

type openAIResponseMessage struct {
	Content   string          `json:"content"`
	ToolCalls []openAIToolCall `json:"tool_calls,omitempty"`
}

type openAIToolCall struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Function openAIToolCallFunc `json:"function"`
}

type openAIToolCallFunc struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type openAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

// callOpenAIWithTools calls OpenAI with function calling and returns a CallResult.
func (c *Client) callOpenAIWithTools(ctx context.Context, system string, messages []anthropic.MessageParam, tools []anthropic.ToolUnionParam) (*CallResult, error) {
	ctx, span := tracer.Start(ctx, "llm.call",
		oteltrace.WithAttributes(
			attribute.String("gen_ai.system", "openai"),
			attribute.String("gen_ai.request.model", OpenAIModelMain),
		),
	)
	defer span.End()

	if err := c.waitForRateLimit(ctx); err != nil {
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	start := time.Now()
	oaiMessages := convertMessages(system, messages)
	oaiTools := convertTools(tools)

	reqBody := openAIRequest{
		Model:      OpenAIModelMain,
		Messages:   oaiMessages,
		Tools:      oaiTools,
		ToolChoice: "required",
		MaxTokens:  maxTokens,
	}

	var lastErr error
	for attempt := range maxRetries {
		resp, err := c.doOpenAIRequest(ctx, reqBody)
		if err != nil {
			lastErr = err
			if attempt < maxRetries-1 {
				var retryAfter time.Duration
				var rlErr *rateLimitError
				if errors.As(err, &rlErr) {
					retryAfter = rlErr.retryAfter
					qgotel.LLMCallsTotal.Add(ctx, 0, otelmetric.WithAttributes(
						attribute.String("gen_ai.request.model", OpenAIModelMain),
						attribute.String("gen_ai.system", "openai"),
					))
				}
				backoff := retryBackoff(attempt, retryAfter)
				log.Printf("OpenAI API error (attempt %d/%d): %v, retrying in %v", attempt+1, maxRetries, err, backoff)
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
			return nil, fmt.Errorf("OpenAI API call failed after %d attempts: %w", maxRetries, err)
		}

		if len(resp.Choices) == 0 {
			err := fmt.Errorf("no choices in OpenAI response")
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}

		inputTok, outputTok := 0, 0
		if resp.Usage != nil {
			inputTok = resp.Usage.PromptTokens
			outputTok = resp.Usage.CompletionTokens
		}
		durationMs := time.Since(start).Milliseconds()

		span.SetAttributes(
			attribute.Int("gen_ai.usage.input_tokens", inputTok),
			attribute.Int("gen_ai.usage.output_tokens", outputTok),
		)
		recordLLMMetrics(ctx, OpenAIModelMain, "openai", inputTok, outputTok, durationMs)
		c.consumeTokens(ctx, inputTok+outputTok)

		msg := resp.Choices[0].Message
		if len(msg.ToolCalls) == 0 {
			err := fmt.Errorf("no tool calls in OpenAI response")
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}

		tc := msg.ToolCalls[0]
		return &CallResult{
			ToolUse: &ToolUseResult{
				ID:    tc.ID,
				Name:  tc.Function.Name,
				Input: json.RawMessage(tc.Function.Arguments),
			},
			InputTokens:  inputTok,
			OutputTokens: outputTok,
			Model:        OpenAIModelMain,
		}, nil
	}

	span.SetStatus(codes.Error, lastErr.Error())
	span.RecordError(lastErr)
	return nil, lastErr
}

// callOpenAIText calls OpenAI for plain text generation (no tools).
func (c *Client) callOpenAIText(ctx context.Context, system string, messages []anthropic.MessageParam) (*CallResult, error) {
	ctx, span := tracer.Start(ctx, "llm.call",
		oteltrace.WithAttributes(
			attribute.String("gen_ai.system", "openai"),
			attribute.String("gen_ai.request.model", OpenAIModelFast),
		),
	)
	defer span.End()

	if err := c.waitForRateLimit(ctx); err != nil {
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	start := time.Now()
	oaiMessages := convertMessages(system, messages)

	reqBody := openAIRequest{
		Model:     OpenAIModelFast,
		Messages:  oaiMessages,
		MaxTokens: haikuMaxToks,
	}

	var lastErr error
	for attempt := range maxRetries {
		resp, err := c.doOpenAIRequest(ctx, reqBody)
		if err != nil {
			lastErr = err
			if attempt < maxRetries-1 {
				var retryAfter time.Duration
				var rlErr *rateLimitError
				if errors.As(err, &rlErr) {
					retryAfter = rlErr.retryAfter
				}
				backoff := retryBackoff(attempt, retryAfter)
				log.Printf("OpenAI text API error (attempt %d/%d): %v, retrying in %v", attempt+1, maxRetries, err, backoff)
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
			return nil, fmt.Errorf("OpenAI text API call failed after %d attempts: %w", maxRetries, err)
		}

		if len(resp.Choices) == 0 {
			err := fmt.Errorf("no choices in OpenAI response")
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}

		inputTok, outputTok := 0, 0
		if resp.Usage != nil {
			inputTok = resp.Usage.PromptTokens
			outputTok = resp.Usage.CompletionTokens
		}
		durationMs := time.Since(start).Milliseconds()

		span.SetAttributes(
			attribute.Int("gen_ai.usage.input_tokens", inputTok),
			attribute.Int("gen_ai.usage.output_tokens", outputTok),
		)
		recordLLMMetrics(ctx, OpenAIModelFast, "openai", inputTok, outputTok, durationMs)
		c.consumeTokens(ctx, inputTok+outputTok)

		return &CallResult{
			Text:         resp.Choices[0].Message.Content,
			InputTokens:  inputTok,
			OutputTokens: outputTok,
			Model:        OpenAIModelFast,
		}, nil
	}

	span.SetStatus(codes.Error, lastErr.Error())
	span.RecordError(lastErr)
	return nil, lastErr
}

// doOpenAIRequest makes an HTTP request to the OpenAI API.
func (c *Client) doOpenAIRequest(ctx context.Context, reqBody openAIRequest) (*openAIResponse, error) {
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIBaseURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.openAIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode == 429 {
		var retryAfter time.Duration
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			if secs, err := strconv.Atoi(ra); err == nil {
				retryAfter = time.Duration(secs) * time.Second
			}
		}
		return nil, &rateLimitError{
			msg:        fmt.Sprintf("OpenAI API returned 429: %s", string(respBody)),
			retryAfter: retryAfter,
		}
	}

	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("OpenAI API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var oaiResp openAIResponse
	if err := json.Unmarshal(respBody, &oaiResp); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	if oaiResp.Error != nil {
		return nil, fmt.Errorf("OpenAI API error: %s", oaiResp.Error.Message)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAI API returned %d: %s", resp.StatusCode, string(respBody))
	}

	return &oaiResp, nil
}

// convertMessages converts Anthropic-style messages to OpenAI format.
func convertMessages(system string, messages []anthropic.MessageParam) []openAIMessage {
	var oai []openAIMessage

	if system != "" {
		oai = append(oai, openAIMessage{Role: "system", Content: system})
	}

	for _, msg := range messages {
		role := string(msg.Role)
		var content string
		for _, block := range msg.Content {
			if block.OfText != nil {
				content += block.OfText.Text
			}
		}
		oai = append(oai, openAIMessage{Role: role, Content: content})
	}

	return oai
}

// convertTools converts Anthropic tool definitions to OpenAI function calling format.
func convertTools(tools []anthropic.ToolUnionParam) []openAITool {
	var oai []openAITool
	for _, tool := range tools {
		if tool.OfTool == nil {
			continue
		}
		t := tool.OfTool

		var desc string
		if t.Description.Valid() {
			desc = t.Description.Value
		}

		params := map[string]interface{}{
			"type":       "object",
			"properties": t.InputSchema.Properties,
		}
		if len(t.InputSchema.Required) > 0 {
			params["required"] = t.InputSchema.Required
		}

		oai = append(oai, openAITool{
			Type: "function",
			Function: openAIToolFunction{
				Name:        t.Name,
				Description: desc,
				Parameters:  params,
			},
		})
	}
	return oai
}
