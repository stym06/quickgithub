package otel

import (
	"go.opentelemetry.io/otel/metric"
)

// Metric instruments — initialized once via InitMetrics, used throughout the worker.
var (
	// Counters
	LLMCallsTotal   metric.Int64Counter
	LLMInputTokens  metric.Int64Counter
	LLMOutputTokens metric.Int64Counter
	GHAPICallsTotal metric.Int64Counter
	GHRateLimitHits metric.Int64Counter
	IndexingTotal   metric.Int64Counter
	IndexingErrors  metric.Int64Counter

	// Histograms
	LLMLatency       metric.Int64Histogram
	IndexingDuration metric.Int64Histogram
	GHAPILatency     metric.Int64Histogram

	// Float counters
	LLMCostTotal metric.Float64Counter
)

// InitMetrics creates all custom metric instruments from the given meter.
func InitMetrics(meter metric.Meter) error {
	var err error

	LLMCallsTotal, err = meter.Int64Counter("llm.calls.total",
		metric.WithDescription("Total number of LLM API calls"),
	)
	if err != nil {
		return err
	}

	LLMInputTokens, err = meter.Int64Counter("gen_ai.usage.input_tokens",
		metric.WithDescription("Total LLM input tokens consumed"),
	)
	if err != nil {
		return err
	}

	LLMOutputTokens, err = meter.Int64Counter("gen_ai.usage.output_tokens",
		metric.WithDescription("Total LLM output tokens generated"),
	)
	if err != nil {
		return err
	}

	GHAPICallsTotal, err = meter.Int64Counter("github.api.calls.total",
		metric.WithDescription("Total GitHub API calls"),
	)
	if err != nil {
		return err
	}

	GHRateLimitHits, err = meter.Int64Counter("github.api.rate_limit_hits",
		metric.WithDescription("GitHub API rate limit hits"),
	)
	if err != nil {
		return err
	}

	IndexingTotal, err = meter.Int64Counter("indexing.total",
		metric.WithDescription("Total indexing jobs"),
	)
	if err != nil {
		return err
	}

	IndexingErrors, err = meter.Int64Counter("indexing.errors",
		metric.WithDescription("Total indexing errors"),
	)
	if err != nil {
		return err
	}

	LLMLatency, err = meter.Int64Histogram("llm.latency",
		metric.WithDescription("LLM call latency in milliseconds"),
		metric.WithUnit("ms"),
	)
	if err != nil {
		return err
	}

	IndexingDuration, err = meter.Int64Histogram("indexing.duration",
		metric.WithDescription("Indexing job duration in milliseconds"),
		metric.WithUnit("ms"),
	)
	if err != nil {
		return err
	}

	GHAPILatency, err = meter.Int64Histogram("github.api.latency",
		metric.WithDescription("GitHub API call latency in milliseconds"),
		metric.WithUnit("ms"),
	)
	if err != nil {
		return err
	}

	LLMCostTotal, err = meter.Float64Counter("llm.cost.usd",
		metric.WithDescription("Estimated LLM cost in USD"),
	)
	if err != nil {
		return err
	}

	return nil
}
