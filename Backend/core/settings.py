"""
Django settings for Projeto Raven project.
"""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key-change-in-production")

APP_VERSION = os.environ.get("APP_VERSION", "")
APP_BUILD_SHA = os.environ.get("APP_BUILD_SHA", "")
APP_BUILD_TIME = os.environ.get("APP_BUILD_TIME", "")

DEBUG = os.environ.get("DEBUG", "True").lower() == "true"
METRICS_ENABLED = os.environ.get("METRICS_ENABLED", "False").lower() == "true"

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,web").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.syndication",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "channels",
    # Local apps
    "apps.common",
    "apps.accounts",
    "apps.blog",
    "apps.forum",
    "apps.media",
    "apps.notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "apps.common.middleware.AdminIPRestrictionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.common.middleware.RequestLoggingMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

USE_SQLITE = os.environ.get("USE_SQLITE", "True").lower() == "true"

_WEAK_PASSWORDS = {"postgres", "changeme", "password", "secret", "raven"}
if not DEBUG:
    if SECRET_KEY == "dev-secret-key-change-in-production":
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DEBUG=False.")
    if USE_SQLITE:
        raise RuntimeError("USE_SQLITE must be False when DEBUG=False.")
    _pg_pass = os.environ.get("POSTGRES_PASSWORD", "postgres")
    if _pg_pass in _WEAK_PASSWORDS:
        raise RuntimeError(
            f"POSTGRES_PASSWORD is set to a known weak value ('{_pg_pass}'). "
            "Set a strong random password before deploying to production."
        )

if USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "projeto_raven"),
            "USER": os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = os.environ.get("STATIC_ROOT", BASE_DIR / "staticfiles")

MEDIA_URL = os.environ.get("MEDIA_URL", "/media/")
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", BASE_DIR / "mediafiles")

# Public URL base used to build absolute media/image URLs returned by the API.
# Must be set in production (e.g. https://projetoraven.cloud) so that the
# Next.js BFF — which calls Django internally via http://django:8000 — receives
# browser-accessible URLs instead of internal hostnames.
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")

# Limit file upload size to 10 MB per file / per request.
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get("FILE_UPLOAD_MAX_MEMORY_SIZE", 10 * 1024 * 1024))
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get("DATA_UPLOAD_MAX_MEMORY_SIZE", 10 * 1024 * 1024))

if not DEBUG:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
            },
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "anon":            os.environ.get("REST_THROTTLE_ANON",            "300/min"),
        "user":            os.environ.get("REST_THROTTLE_USER",            "600/min"),
        "login":           os.environ.get("REST_THROTTLE_LOGIN",           "10/min"),
        "register":        os.environ.get("REST_THROTTLE_REGISTER",        "3/hour"),
        "password_reset":  os.environ.get("REST_THROTTLE_PASSWORD_RESET",  "3/hour"),
        "password_change": os.environ.get("REST_THROTTLE_PASSWORD_CHANGE", "5/minute"),
        "otp":             os.environ.get("REST_THROTTLE_OTP",             "5/minute"),
        "forum_post":      os.environ.get("REST_THROTTLE_FORUM_POST",      "20/minute"),
        "blog_post":       os.environ.get("REST_THROTTLE_BLOG_POST",       "10/minute"),
        "comment":         os.environ.get("REST_THROTTLE_COMMENT",         "10/minute"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Projeto Raven API",
    "DESCRIPTION": "Backend API for Projeto Raven — Blog & Forum Platform",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_PATCH": True,
}

REST_THROTTLING_ENABLED = os.environ.get(
    "REST_THROTTLING_ENABLED",
    "False" if DEBUG else "True",
).lower() == "true"
if REST_THROTTLING_ENABLED:
    REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ]

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "RS256",
    "SIGNING_KEY": None,
    "VERIFYING_KEY": None,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

private_key_path = Path(os.environ.get("JWT_PRIVATE_KEY_PATH", BASE_DIR / "keys" / "private.pem"))
public_key_path = Path(os.environ.get("JWT_PUBLIC_KEY_PATH", BASE_DIR / "keys" / "public.pem"))

private_key_env = os.environ.get("JWT_PRIVATE_KEY")
public_key_env = os.environ.get("JWT_PUBLIC_KEY")

if private_key_env and public_key_env:
    SIMPLE_JWT["SIGNING_KEY"] = private_key_env
    SIMPLE_JWT["VERIFYING_KEY"] = public_key_env
else:
    if not private_key_path.exists() or not public_key_path.exists():
        if DEBUG:
            try:
                from cryptography.hazmat.primitives import serialization
                from cryptography.hazmat.primitives.asymmetric import rsa
            except Exception as e:
                raise RuntimeError("JWT keys missing and cryptography is not installed.") from e

            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            )
            public_pem = private_key.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            private_key_path.parent.mkdir(parents=True, exist_ok=True)
            private_key_path.write_bytes(private_pem)
            public_key_path.write_bytes(public_pem)
        else:
            raise RuntimeError("JWT RSA keys not found. Provide JWT_PRIVATE_KEY/JWT_PUBLIC_KEY or JWT_*_KEY_PATH.")

    SIMPLE_JWT["SIGNING_KEY"] = private_key_path.read_text()
    SIMPLE_JWT["VERIFYING_KEY"] = public_key_path.read_text()

CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "True").lower() == "true"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_REFERRER_POLICY = "same-origin"
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "0"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
    SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "False").lower() == "true"
    if SECURE_HSTS_SECONDS == 0:
        import warnings
        warnings.warn(
            "SECURE_HSTS_SECONDS is 0 — HSTS is disabled. "
            "Set SECURE_HSTS_SECONDS=31536000 once HTTPS is confirmed working.",
            RuntimeWarning,
            stacklevel=2,
        )

_LOG_FORMAT = os.environ.get("LOG_FORMAT", "json" if not DEBUG else "text")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "request_id": {"()": "apps.common.middleware.RequestIdFilter"},
    },
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s",
        },
        "text": {
            "format": "{levelname} {asctime} {name} [{request_id}] {message}",
            "style": "{",
        },
        "detailed": {
            "format": "{levelname} {asctime} [{name}] [{request_id}] {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": _LOG_FORMAT,
            "filters": ["request_id"],
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "django.request.structured": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "apps.accounts.email_backend.DatabaseEmailBackend")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@localhost")
ACCOUNTS_FALLBACK_EMAIL_BACKEND = os.environ.get(
    "ACCOUNTS_FALLBACK_EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "",
)
EMAIL_SETTINGS_ENCRYPTION_SALT = os.environ.get("EMAIL_SETTINGS_ENCRYPTION_SALT", "change-me-email-salt")
if not DEBUG and EMAIL_SETTINGS_ENCRYPTION_SALT == "change-me-email-salt":
    raise RuntimeError("EMAIL_SETTINGS_ENCRYPTION_SALT must be set when DEBUG=False.")

ACCOUNTS_EMAIL_VERIFY_CODE_EXPIRES_MINUTES = int(os.environ.get("ACCOUNTS_EMAIL_VERIFY_CODE_EXPIRES_MINUTES", "10"))
ACCOUNTS_PASSWORD_RESET_CODE_EXPIRES_MINUTES = int(os.environ.get("ACCOUNTS_PASSWORD_RESET_CODE_EXPIRES_MINUTES", "10"))
ACCOUNTS_OTP_MAX_ATTEMPTS = int(os.environ.get("ACCOUNTS_OTP_MAX_ATTEMPTS", "10"))
ACCOUNTS_OTP_COOLDOWN_SECONDS = int(os.environ.get("ACCOUNTS_OTP_COOLDOWN_SECONDS", "60"))
ACCOUNTS_OTP_MAX_PER_HOUR = int(os.environ.get("ACCOUNTS_OTP_MAX_PER_HOUR", "10"))
ACCOUNTS_OTP_MAX_PER_HOUR_PER_IP = int(os.environ.get("ACCOUNTS_OTP_MAX_PER_HOUR_PER_IP", "50"))
ACCOUNTS_OTP_CLEANUP_AFTER_DAYS = int(os.environ.get("ACCOUNTS_OTP_CLEANUP_AFTER_DAYS", "7"))

# Fernet key for encrypting TOTP secrets at rest. Generate with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# In dev a key is derived from SECRET_KEY automatically; set this in production.
TOTP_ENCRYPTION_KEY = os.environ.get("TOTP_ENCRYPTION_KEY", "")

ACCOUNTS_LOGIN_MAX_FAILURES = int(os.environ.get("ACCOUNTS_LOGIN_MAX_FAILURES", "5"))
ACCOUNTS_LOGIN_LOCKOUT_SECONDS = int(os.environ.get("ACCOUNTS_LOGIN_LOCKOUT_SECONDS", "900"))

# ---------------------------------------------------------------------------
# Django Channels (WebSocket / ASGI)
# ---------------------------------------------------------------------------
ASGI_APPLICATION = "core.asgi.application"
_CHANNEL_LAYER_URL = REDIS_URL or "redis://localhost:6379/3"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [os.environ.get("CHANNEL_LAYER_URL", _CHANNEL_LAYER_URL)]},
    }
}

# ---------------------------------------------------------------------------
# Sentry
# ---------------------------------------------------------------------------
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    def _sentry_traces_sampler(sampling_context):
        base_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
        low_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE_LOW", "0.01"))

        tx = sampling_context.get("transaction_context") or {}
        name = (tx.get("name") or "").lower()

        if "/api/health" in name or "/admin" in name or "/cron" in name:
            return low_rate
        return base_rate

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sampler=_sentry_traces_sampler,
        send_default_pii=False,
        environment="development" if DEBUG else "production",
        release=APP_BUILD_SHA or APP_VERSION or None,
    )

# ---------------------------------------------------------------------------
# Web Push (VAPID)
# ---------------------------------------------------------------------------
# Generate keys once with: python -c "from pywebpush import Vapid; v = Vapid(); v.generate_keys(); print('PRIVATE:', v.private_key); print('PUBLIC:', v.public_key)"
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_ADMIN_EMAIL = os.environ.get("VAPID_ADMIN_EMAIL", "admin@projetoraven.com")

# ---------------------------------------------------------------------------
# Admin / Schema access control
# ---------------------------------------------------------------------------
# Lista de IPs com acesso ao /admin/ e /api/schema/.
# Vazia = sem restrição (qualquer IP pode acessar — proteja por autenticação).
# Ex: ADMIN_ALLOWED_IPS=1.2.3.4,5.6.7.8
ADMIN_ALLOWED_IPS = [
    ip.strip()
    for ip in os.environ.get("ADMIN_ALLOWED_IPS", "").split(",")
    if ip.strip()
]

# Habilita endpoints /api/schema/, /swagger-ui/ e /redoc/.
# Padrão: True em DEBUG, False em produção (defina SCHEMA_ENABLED=True para re-habilitar).
SCHEMA_ENABLED = os.environ.get("SCHEMA_ENABLED", str(DEBUG)).lower() == "true"

