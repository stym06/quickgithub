"""OpenTelemetry metrics — mirrors the Go worker's metric instruments exactly."""

import logging

from opentelemetry import metrics
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource

from .config import settings

logger = logging.getLogger(__name__)

# ── Metric instruments (module-level, set by init()) ──

# Counters
llm_calls_total: metrics.Counter
llm_input_tokens: metrics.Counter
llm_output_tokens: metrics.Counter
indexing_total: metrics.Counter
indexing_errors: metrics.Counter

# Histograms
llm_latency: metrics.Histogram
indexing_duration: metrics.Histogram

# Float counters
llm_cost_total: metrics.Counter

_provider: MeterProvider | None = None


def init() -> None:
    """Initialize OpenTelemetry metrics with OTLP HTTP exporter."""
    global _provider
    global llm_calls_total, llm_input_tokens, llm_output_tokens
    global indexing_total, indexing_errors
    global llm_latency, indexing_duration
    global llm_cost_total

    resource = Resource.create({"service.name": "quickgithub-worker"})

    exporter = OTLPMetricExporter(
        endpoint=f"{settings.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics",
    )
    reader = PeriodicExportingMetricReader(exporter)
    _provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(_provider)

    meter = _provider.get_meter("quickgithub-worker")

    # Counters — same names as Go worker
    llm_calls_total = meter.create_counter(
        "llm.calls.total",
        description="Total number of LLM API calls",
    )
    llm_input_tokens = meter.create_counter(
        "gen_ai.usage.input_tokens",
        description="Total LLM input tokens consumed",
    )
    llm_output_tokens = meter.create_counter(
        "gen_ai.usage.output_tokens",
        description="Total LLM output tokens generated",
    )
    indexing_total = meter.create_counter(
        "indexing.total",
        description="Total indexing jobs",
    )
    indexing_errors = meter.create_counter(
        "indexing.errors",
        description="Total indexing errors",
    )

    # Histograms
    llm_latency = meter.create_histogram(
        "llm.latency",
        description="LLM call latency in milliseconds",
        unit="ms",
    )
    indexing_duration = meter.create_histogram(
        "indexing.duration",
        description="Indexing job duration in milliseconds",
        unit="ms",
    )

    # Float counter
    llm_cost_total = meter.create_counter(
        "llm.cost.usd",
        description="Estimated LLM cost in USD",
    )

    logger.info("OpenTelemetry initialized (endpoint=%s)", settings.OTEL_EXPORTER_OTLP_ENDPOINT)


def shutdown() -> None:
    """Flush and shut down the meter provider."""
    global _provider
    if _provider is not None:
        _provider.shutdown()
        _provider = None


def record_llm_metrics(
    model: str,
    input_tokens: int,
    output_tokens: int,
    duration_ms: int,
    cost_usd: float,
) -> None:
    """Record metrics for a single LLM agent pass."""
    system = "openai" if model.startswith(("gpt", "o1", "o3")) else "anthropic"
    attrs = {
        "gen_ai.request.model": model,
        "gen_ai.system": system,
    }
    llm_calls_total.add(1, attrs)
    llm_input_tokens.add(input_tokens, attrs)
    llm_output_tokens.add(output_tokens, attrs)
    llm_latency.record(duration_ms, attrs)
    if cost_usd > 0:
        llm_cost_total.add(cost_usd, attrs)


def record_indexing_success(repo_full_name: str, duration_ms: int) -> None:
    """Record a successful indexing job."""
    attrs = {"repo.full_name": repo_full_name}
    indexing_total.add(1, {**attrs, "status": "success"})
    indexing_duration.record(duration_ms, attrs)


def record_indexing_failure(repo_full_name: str, duration_ms: int) -> None:
    """Record a failed indexing job."""
    attrs = {"repo.full_name": repo_full_name}
    indexing_total.add(1, {**attrs, "status": "failed"})
    indexing_errors.add(1, attrs)
    indexing_duration.record(duration_ms, attrs)
