try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
except ImportError:
    Counter = None
    Histogram = None
    Gauge = None
    generate_latest = None
    CONTENT_TYPE_LATEST = None


REQUEST_COUNT = None
REQUEST_LATENCY = None
HEALTHCHECK = None
CELERY_WORKERS_UP = None
CELERY_QUEUE_BACKLOG = None
DB_CONNECTIONS = None
REDIS_STREAM_GROUP_PENDING = None
REDIS_STREAM_GROUP_LAG = None
REDIS_STREAM_LENGTH = None


def _ensure_http_metrics():
    global REQUEST_COUNT
    global REQUEST_LATENCY

    if Counter is None:
        return None

    if REQUEST_COUNT is None:
        REQUEST_COUNT = Counter(
            "http_requests_total",
            "Total HTTP requests",
            ["method", "endpoint", "status_code"],
        )

    if REQUEST_LATENCY is None:
        REQUEST_LATENCY = Histogram(
            "http_request_duration_seconds",
            "HTTP request latency in seconds",
            ["method", "endpoint"],
            buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
        )

    return True


def observe_http_request(method: str, endpoint: str, status_code: int, duration_seconds: float) -> None:
    if _ensure_http_metrics() is None:
        return

    endpoint = endpoint or "unknown"
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status_code=str(status_code)).inc()
    REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration_seconds)


def _ensure_infra_metrics():
    global HEALTHCHECK
    global CELERY_WORKERS_UP
    global CELERY_QUEUE_BACKLOG
    global DB_CONNECTIONS
    global REDIS_STREAM_GROUP_PENDING
    global REDIS_STREAM_GROUP_LAG
    global REDIS_STREAM_LENGTH

    if Gauge is None:
        return None

    if HEALTHCHECK is None:
        HEALTHCHECK = Gauge(
            "django_healthcheck",
            "Healthcheck status (1 ok, 0 fail)",
            ["check"],
        )

    if CELERY_WORKERS_UP is None:
        CELERY_WORKERS_UP = Gauge(
            "celery_workers_up",
            "Number of celery workers responding to inspect",
        )

    if CELERY_QUEUE_BACKLOG is None:
        CELERY_QUEUE_BACKLOG = Gauge(
            "celery_queue_backlog",
            "Approx backlog by queue in broker",
            ["queue"],
        )

    if DB_CONNECTIONS is None:
        DB_CONNECTIONS = Gauge(
            "db_connections",
            "Current database connections",
            ["db"],
        )

    if REDIS_STREAM_GROUP_PENDING is None:
        REDIS_STREAM_GROUP_PENDING = Gauge(
            "redis_stream_group_pending",
            "Pending entries in redis streams consumer group",
            ["stream", "group"],
        )

    if REDIS_STREAM_GROUP_LAG is None:
        REDIS_STREAM_GROUP_LAG = Gauge(
            "redis_stream_group_lag",
            "Consumer group lag (entries behind) for stream",
            ["stream", "group"],
        )

    if REDIS_STREAM_LENGTH is None:
        REDIS_STREAM_LENGTH = Gauge(
            "redis_stream_length",
            "Total entries in a redis stream",
            ["stream"],
        )

    return True


def _collect_health_checks():
    from django.core.cache import caches
    from django.db import connections
    from django.conf import settings

    db_ok = False
    try:
        conn = connections["default"]
        conn.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False
    HEALTHCHECK.labels(check="db").set(1 if db_ok else 0)

    cache_ok = False
    try:
        cache = caches["default"]
        cache.set("__healthcheck__", "1", timeout=2)
        cache_ok = cache.get("__healthcheck__") == "1"
    except Exception:
        cache_ok = False
    HEALTHCHECK.labels(check="cache").set(1 if cache_ok else 0)

    redis_ok = True
    redis_url = getattr(settings, "REDIS_URL", "").strip()
    if redis_url:
        try:
            from django_redis import get_redis_connection

            r = get_redis_connection("default")
            r.ping()
            redis_ok = True
        except Exception:
            redis_ok = False
    HEALTHCHECK.labels(check="redis").set(1 if redis_ok else 0)

    celery_ok = False
    workers = 0
    try:
        from celery import current_app

        inspect = current_app.control.inspect()
        stats = inspect.stats() or {}
        workers = len(stats)
        celery_ok = workers > 0
    except Exception:
        celery_ok = False
        workers = 0
    HEALTHCHECK.labels(check="celery").set(1 if celery_ok else 0)
    CELERY_WORKERS_UP.set(workers)


def _collect_db_connection_metrics():
    from django.db import connections

    conn = connections["default"]
    if conn.vendor != "postgresql":
        return

    count = None
    try:
        with conn.cursor() as cursor:
            cursor.execute("select count(*) from pg_stat_activity where datname = current_database();")
            count = cursor.fetchone()[0]
    except Exception:
        count = None

    if count is not None:
        DB_CONNECTIONS.labels(db="default").set(int(count))


def _collect_celery_queue_backlog():
    import redis
    from django.conf import settings

    broker = getattr(settings, "CELERY_BROKER_URL", "") or ""
    if not (broker.startswith("redis://") or broker.startswith("rediss://")):
        return

    queue_names = []
    for q in getattr(settings, "CELERY_TASK_QUEUES", ()) or ():
        name = getattr(q, "name", None)
        if name:
            queue_names.append(name)

    if not queue_names:
        queue_names = [getattr(settings, "CELERY_TASK_DEFAULT_QUEUE", "celery")]

    r = redis.from_url(broker, decode_responses=True)
    for q in sorted(set(queue_names)):
        try:
            CELERY_QUEUE_BACKLOG.labels(queue=q).set(int(r.llen(q)))
        except Exception:
            continue


def _collect_redis_stream_metrics():
    import os
    import redis

    redis_url = os.environ.get("REDIS_STREAM_URL") or os.environ.get("REDIS_URL") or "redis://localhost:6379/4"
    stream = os.environ.get("GAMESERVER_COMMAND_STREAM", "stream:django->gs")
    dlq_stream = os.environ.get("GAMESERVER_COMMAND_DLQ_STREAM", "stream:django->gs:dlq")

    r = redis.from_url(redis_url, decode_responses=True)
    try:
        REDIS_STREAM_LENGTH.labels(stream=stream).set(int(r.xlen(stream)))
    except Exception:
        pass
    try:
        REDIS_STREAM_LENGTH.labels(stream=dlq_stream).set(int(r.xlen(dlq_stream)))
    except Exception:
        pass

    try:
        groups = r.xinfo_groups(stream)
    except Exception:
        return

    for g in groups:
        name = str(g.get("name", ""))
        pending = g.get("pending", None)
        lag = g.get("lag", None)

        if pending is not None:
            REDIS_STREAM_GROUP_PENDING.labels(stream=stream, group=name).set(int(pending))
        if lag is not None:
            REDIS_STREAM_GROUP_LAG.labels(stream=stream, group=name).set(int(lag))



def get_metrics_view():
    if Counter is None:
        return None

    def metrics_view(request):
        from django.http import HttpResponse
        if _ensure_infra_metrics() is not None:
            try:
                _collect_health_checks()
                _collect_db_connection_metrics()
                _collect_celery_queue_backlog()
                _collect_redis_stream_metrics()
            except Exception:
                pass
        return HttpResponse(generate_latest(), content_type=CONTENT_TYPE_LATEST)

    return metrics_view



def get_metrics_collector():
    if _ensure_http_metrics() is None:
        return None

    return {
        "request_count": REQUEST_COUNT,
        "request_latency": REQUEST_LATENCY,
    }
