package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"

	"github.com/stym06/quickgithub/worker/internal/tasks"
)

const (
	stageLevelMaxAttempts = 3
	stageLevelCooldown    = 30 * time.Second
)

// NonRetryableError wraps errors that should not be retried at the stage or
// task level (e.g. JSON parse failures from malformed LLM output).
type NonRetryableError struct{ Err error }

func (e *NonRetryableError) Error() string { return e.Err.Error() }
func (e *NonRetryableError) Unwrap() error { return e.Err }

// ProgressFunc is called to report pipeline progress.
type ProgressFunc func(status string, progress int, message string)

// RunPipeline executes the 4-stage LLM analysis pipeline.
func RunPipeline(
	ctx context.Context,
	client *Client,
	structures []tasks.FileStructure,
	readme string,
	fileTree string,
	packageFiles string,
	progressFn ProgressFunc,
) (tasks.Documentation, error) {
	var doc tasks.Documentation

	// Stage 1: System Overview (40-50%)
	progressFn("ANALYZING", 40, "Generating system overview...")
	overview, err := retryStage(ctx, "overview", stageLevelMaxAttempts, stageLevelCooldown, func() (tasks.SystemOverview, error) {
		return runOverviewStage(ctx, client, readme, fileTree, packageFiles)
	})
	if err != nil {
		return doc, fmt.Errorf("overview stage: %w", err)
	}
	doc.SystemOverview = overview
	log.Printf("Stage 1 complete: system overview generated")

	// Stage 2: Module Analysis (50-70%)
	progressFn("ANALYZING", 50, "Analyzing code modules...")
	chunks := ChunkByDirectory(structures)
	moduleResult, err := runModuleStage(ctx, client, chunks, progressFn)
	if err != nil {
		return doc, fmt.Errorf("module stage: %w", err)
	}
	doc.KeyModules = moduleResult.Modules
	log.Printf("Stage 2 complete: %d modules analyzed, %d skipped", len(moduleResult.Modules), len(moduleResult.SkippedModules))

	// Stage 3: Synthesis (70-90%)
	progressFn("ANALYZING", 70, "Synthesizing architecture and tech stack...")
	overviewJSON, _ := json.Marshal(overview)
	modulesJSON, _ := json.Marshal(moduleResult.Modules)
	synthesis, err := retryStage(ctx, "synthesis", stageLevelMaxAttempts, stageLevelCooldown, func() (tasks.SynthesisResult, error) {
		return runSynthesisStage(ctx, client, string(overviewJSON), string(modulesJSON))
	})
	if err != nil {
		return doc, fmt.Errorf("synthesis stage: %w", err)
	}
	doc.Architecture = synthesis.Architecture
	doc.TechStack = synthesis.TechStack
	doc.EntryPoints = synthesis.EntryPoints
	doc.Dependencies = synthesis.Dependencies
	log.Printf("Stage 3 complete: synthesis done")

	// Stage 4: Context Generation (90-95%)
	progressFn("ANALYZING", 90, "Generating Q&A context...")
	fullDocJSON, _ := json.Marshal(doc)
	repoContext, err := runContextStage(ctx, client, string(fullDocJSON))
	if err != nil {
		log.Printf("Warning: context generation failed: %v, using overview as fallback", err)
		repoContext = fmt.Sprintf("%s\n\n%s", overview.Description, overview.Purpose)
	}
	if len(moduleResult.SkippedModules) > 0 {
		repoContext += fmt.Sprintf("\n\nNote: %d module(s) could not be analyzed and were skipped: %s",
			len(moduleResult.SkippedModules), strings.Join(moduleResult.SkippedModules, ", "))
	}
	doc.RepoContext = repoContext
	log.Printf("Stage 4 complete: Q&A context generated")

	return doc, nil
}

// runOverviewStage calls Claude Sonnet to generate the system overview.
func runOverviewStage(ctx context.Context, client *Client, readme, fileTree, packageFiles string) (tasks.SystemOverview, error) {
	ctx, span := tracer.Start(ctx, "llm.pipeline.overview",
		oteltrace.WithAttributes(attribute.String("stage", "overview")),
	)
	defer span.End()

	var overview tasks.SystemOverview

	system, messages := SystemOverviewPrompt(readme, fileTree, packageFiles)
	tools := []anthropic.ToolUnionParam{SystemOverviewTool()}

	result, err := client.CallSonnetWithTools(ctx, system, messages, tools)
	if err != nil {
		return overview, err
	}

	if err := json.Unmarshal(result.ToolUse.Input, &overview); err != nil {
		return overview, &NonRetryableError{fmt.Errorf("parsing overview response: %w", err)}
	}

	span.SetAttributes(
		attribute.Int("tokens.input", result.InputTokens),
		attribute.Int("tokens.output", result.OutputTokens),
	)

	return overview, nil
}

// moduleStageResult holds the output of the module analysis stage.
type moduleStageResult struct {
	Modules        []tasks.ModuleAnalysis
	SkippedModules []string
}

// runModuleStage calls Claude Sonnet for each directory chunk with per-chunk
// retries. Chunks that fail after all retries are skipped so the pipeline can
// continue with partial results.
func runModuleStage(ctx context.Context, client *Client, chunks []tasks.DirectoryChunk, progressFn ProgressFunc) (moduleStageResult, error) {
	ctx, span := tracer.Start(ctx, "llm.pipeline.modules",
		oteltrace.WithAttributes(
			attribute.String("stage", "modules"),
			attribute.Int("chunks.count", len(chunks)),
		),
	)
	defer span.End()

	var res moduleStageResult
	var totalInputTokens, totalOutputTokens int

	for i, chunk := range chunks {
		progress := 50 + (20 * (i + 1) / len(chunks))
		progressFn("ANALYZING", progress, fmt.Sprintf("Analyzing module %d/%d: %s", i+1, len(chunks), chunk.DirPath))

		// Retry each chunk up to stageLevelMaxAttempts before skipping.
		chunkCopy := chunk // capture for closure
		type chunkResult struct {
			module tasks.ModuleAnalysis
			call   *CallResult
		}
		cr, err := retryStage(ctx, fmt.Sprintf("module:%s", chunk.DirPath), stageLevelMaxAttempts, stageLevelCooldown, func() (chunkResult, error) {
			m, r, e := analyzeChunk(ctx, client, chunkCopy)
			return chunkResult{m, r}, e
		})
		if err != nil {
			log.Printf("Skipping module %s after %d retries: %v", chunk.DirPath, stageLevelMaxAttempts, err)
			res.SkippedModules = append(res.SkippedModules, chunk.DirPath)
			continue
		}
		cr.module.ModulePath = chunk.DirPath
		res.Modules = append(res.Modules, cr.module)

		if cr.call != nil {
			totalInputTokens += cr.call.InputTokens
			totalOutputTokens += cr.call.OutputTokens
		}
	}

	span.SetAttributes(
		attribute.Int("tokens.input", totalInputTokens),
		attribute.Int("tokens.output", totalOutputTokens),
		attribute.Int("modules.skipped", len(res.SkippedModules)),
	)

	if len(res.SkippedModules) > 0 {
		log.Printf("Module analysis completed with %d skipped modules: %v", len(res.SkippedModules), res.SkippedModules)
	}

	if len(res.Modules) == 0 {
		return res, fmt.Errorf("all %d module analyses failed", len(chunks))
	}

	return res, nil
}

// analyzeChunk runs module analysis on a single directory chunk.
func analyzeChunk(ctx context.Context, client *Client, chunk tasks.DirectoryChunk) (tasks.ModuleAnalysis, *CallResult, error) {
	var module tasks.ModuleAnalysis

	system, messages := ModuleAnalysisPrompt(chunk.DirPath, chunk.Files)
	tools := []anthropic.ToolUnionParam{ModuleAnalysisTool()}

	result, err := client.CallSonnetWithTools(ctx, system, messages, tools)
	if err != nil {
		return module, nil, err
	}

	if err := json.Unmarshal(result.ToolUse.Input, &module); err != nil {
		return module, nil, &NonRetryableError{fmt.Errorf("parsing module response: %w", err)}
	}

	return module, result, nil
}

// runSynthesisStage calls Claude Sonnet to produce cross-cutting documentation.
func runSynthesisStage(ctx context.Context, client *Client, overviewJSON, modulesJSON string) (tasks.SynthesisResult, error) {
	ctx, span := tracer.Start(ctx, "llm.pipeline.synthesis",
		oteltrace.WithAttributes(attribute.String("stage", "synthesis")),
	)
	defer span.End()

	var result tasks.SynthesisResult

	system, messages := SynthesisPrompt(overviewJSON, modulesJSON)
	tools := []anthropic.ToolUnionParam{SynthesisTool()}

	callResult, err := client.CallSonnetWithTools(ctx, system, messages, tools)
	if err != nil {
		return result, err
	}

	if err := json.Unmarshal(callResult.ToolUse.Input, &result); err != nil {
		return result, &NonRetryableError{fmt.Errorf("parsing synthesis response: %w", err)}
	}

	span.SetAttributes(
		attribute.Int("tokens.input", callResult.InputTokens),
		attribute.Int("tokens.output", callResult.OutputTokens),
	)

	return result, nil
}

// retryStage wraps a critical pipeline stage with stage-level retries.
// Each attempt internally still uses the LLM client's own retry logic (8 retries).
// Non-retryable errors (e.g. JSON parse failures) bail immediately.
func retryStage[T any](ctx context.Context, name string, maxAttempts int, cooldown time.Duration, fn func() (T, error)) (T, error) {
	var zero T
	var lastErr error

	for attempt := range maxAttempts {
		result, err := fn()
		if err == nil {
			return result, nil
		}
		lastErr = err

		// Don't retry parse/structural errors — the same input will produce the same bad output.
		var nre *NonRetryableError
		if errors.As(err, &nre) {
			log.Printf("Stage %q failed with non-retryable error, not retrying: %v", name, err)
			return zero, err
		}

		if attempt < maxAttempts-1 {
			log.Printf("Stage %q failed (attempt %d/%d): %v, retrying in %v", name, attempt+1, maxAttempts, err, cooldown)
			select {
			case <-ctx.Done():
				return zero, ctx.Err()
			case <-time.After(cooldown):
			}
		}
	}
	return zero, fmt.Errorf("stage %q failed after %d attempts: %w", name, maxAttempts, lastErr)
}

// runContextStage calls Claude Haiku to generate a Q&A context blob.
func runContextStage(ctx context.Context, client *Client, fullDocJSON string) (string, error) {
	ctx, span := tracer.Start(ctx, "llm.pipeline.context",
		oteltrace.WithAttributes(attribute.String("stage", "context")),
	)
	defer span.End()

	system, messages := ContextGenerationPrompt(fullDocJSON)
	result, err := client.CallHaiku(ctx, system, messages)
	if err != nil {
		return "", err
	}

	span.SetAttributes(
		attribute.Int("tokens.input", result.InputTokens),
		attribute.Int("tokens.output", result.OutputTokens),
	)

	return result.Text, nil
}
