"""Django settings for Kothay Milbe. All deployment values come from backend/.env."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env(name, default=None):
    value = os.environ.get(name, default)
    if value is None:
        raise ImproperlyConfigured(f"Missing environment variable {name} (see backend/.env.example)")
    return value


def env_bool(name, default="False"):
    return env(name, default).strip().lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


SECRET_KEY = env("SECRET_KEY")
DEBUG = env_bool("DEBUG")
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "catalog",
    "orders",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DB_ENGINE = env("DB_ENGINE", "sqlite").strip().lower()
if DB_ENGINE == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
elif DB_ENGINE == "postgres":
    # Empty HOST and PASSWORD = peer authentication over the local Unix socket.
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME", "kothaymilbe"),
            "USER": env("DB_USER", "kothaymilbe"),
            "PASSWORD": env("DB_PASSWORD", ""),
            "HOST": env("DB_HOST", ""),
            "PORT": env("DB_PORT", ""),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    raise ImproperlyConfigured("DB_ENGINE must be 'sqlite' or 'postgres'")

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "bn"
TIME_ZONE = "Asia/Dhaka"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # Public API without login; no session auth means no CSRF on POST.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": (
        ["rest_framework.renderers.JSONRenderer", "rest_framework.renderers.BrowsableAPIRenderer"]
        if DEBUG
        else ["rest_framework.renderers.JSONRenderer"]
    ),
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
    "UNAUTHENTICATED_USER": None,
    # Order attempts per customer IP (see orders/throttles.py).
    "DEFAULT_THROTTLE_RATES": {"orders": "10/hour"},
}

# File cache so every Gunicorn worker shares the same throttle counters.
# On the server CACHE_DIR is an absolute path owned by the kothaymilbe user.
CACHE_DIR = Path(os.environ.get("CACHE_DIR", "").strip() or BASE_DIR / ".cache").resolve()
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": CACHE_DIR,
    }
}

if not DEBUG:
    # Caddy terminates HTTPS and forwards X-Forwarded-Proto.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
