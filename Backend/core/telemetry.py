"""OpenTelemetry bootstrap — called once from AppConfig.ready() via common/apps.py.

Instrumentation is skipped when OTEL_ENABLED is not set to "true" (safe for
dev, CI, and test environments).  All OTLP settings are standard env vars:

  OTEL_ENABLED=true
  OTEL_SERVICE_NAME=raven-backend
  OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
  OTEL_TRACES_SAMPLE_RATE=0.1   (float, default 0.1 = 10%)
"""
import logging
import os

logger = logging.getLogger(__name__)


def setup():
    if os.environ.get("OTEL_ENABLED", "").lower() != "true":
        return

    try:
        _configure()
    except Exception as exc:
        logger.warning("OpenTelemetry setup failed (non-fatal): %s", exc)


def _configure():
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

    service_name = os.environ.get("OTEL_SERVICE_NAME", "raven-backend")
    sample_rate  = float(os.environ.get("OTEL_TRACES_SAMPLE_RATE", "0.1"))
    endpoint     = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    resource = Resource(attributes={SERVICE_NAME: service_name})
    sampler  = TraceIdRatioBased(sample_rate)

    provider = TracerProvider(resource=resource, sampler=sampler)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True)))

    trace.set_tracer_provider(provider)

    # Auto-instrumentations
    _instrument_django()
    _instrument_celery()
    _instrument_psycopg2()
    _instrument_redis()

    logger.info(
        "OpenTelemetry configured: service=%s endpoint=%s sample_rate=%.2f",
        service_name, endpoint, sample_rate,
    )


def _instrument_django():
    try:
        from opentelemetry.instrumentation.django import DjangoInstrumentor
        DjangoInstrumentor().instrument()
    except ImportError:
        pass


def _instrument_celery():
    try:
        from opentelemetry.instrumentation.celery import CeleryInstrumentor
        CeleryInstrumentor().instrument()
    except ImportError:
        pass


def _instrument_psycopg2():
    try:
        from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
        Psycopg2Instrumentor().instrument()
    except ImportError:
        pass


def _instrument_redis():
    try:
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        RedisInstrumentor().instrument()
    except ImportError:
        pass
