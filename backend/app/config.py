"""Runtime settings, all env-driven (PRD §8, §11).

Free now -> paid later is a *config* change, not a code change. Nothing here hardcodes a
provider or model. A local `.env` is loaded if python-dotenv is present (optional).

An existing root-level `.env` with provider-specific key names (OPENROUTER_API_KEY,
GROQ_API_KEY, MISTRAL_API_KEY, GEMINI_API_KEY, ...) works as-is: pick the provider via
LLM_PROVIDER and the matching key is found automatically.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:  # optional convenience in local dev
    from dotenv import load_dotenv  # type: ignore

    # Load both backend/.env and the project-root .env (backend wins on conflicts).
    _here = Path(__file__).resolve()
    load_dotenv(_here.parents[2] / ".env")               # project-root .env (loaded first)
    load_dotenv(_here.parents[1] / ".env", override=True)  # backend/.env overrides
except Exception:  # pragma: no cover - dotenv is optional
    pass


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default)


# Provider -> base URL (all expose OpenAI-compatible Chat Completions).
PROVIDER_BASE_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
    "mistral": "https://api.mistral.ai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
}

# Provider -> env var holding its key (so an existing .env "just works").
_PROVIDER_KEY_ENV = {
    "openrouter": "OPENROUTER_API_KEY",
    "groq": "GROQ_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}

# Provider -> sensible free default model (used if LLM_MODEL is left unset).
PROVIDER_DEFAULT_MODEL = {
    "openrouter": "meta-llama/llama-3.3-70b-instruct:free",
    "groq": "llama-3.3-70b-versatile",
    "mistral": "mistral-small-latest",
    "gemini": "gemini-2.0-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-4-6",
}


def _resolve_key(provider: str) -> str:
    """Explicit LLM_API_KEY wins; otherwise fall back to the provider-specific key var."""
    return os.getenv("LLM_API_KEY", "") or os.getenv(_PROVIDER_KEY_ENV.get(provider, ""), "")


def _resolve_model(provider: str) -> str:
    """Explicit LLM_MODEL wins; otherwise the provider's free default."""
    return os.getenv("LLM_MODEL", "") or PROVIDER_DEFAULT_MODEL.get(provider, "")


def _first_env(*names: str) -> str:
    """Return the first non-empty env var among `names` (accepts varied .env naming)."""
    for n in names:
        v = os.getenv(n, "")
        if v:
            return v
    return ""


def _project_ref(url: str) -> str:
    """Extract the Supabase project ref from its URL (https://<ref>.supabase.co)."""
    if not url:
        return ""
    host = url.split("://", 1)[-1].split("/", 1)[0]
    return host.split(".", 1)[0]


def _resolve_database_url() -> str:
    """Use DATABASE_URL if given; else build the direct connection from ref + password."""
    explicit = os.getenv("DATABASE_URL", "")
    if explicit:
        return explicit
    url = _first_env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    pwd = os.getenv("DATABASE_PASSWORD", "")
    ref = _project_ref(url)
    if ref and pwd:
        from urllib.parse import quote

        return f"postgresql://postgres:{quote(pwd, safe='')}@db.{ref}.supabase.co:5432/postgres"
    return ""


_PROVIDER = _get("LLM_PROVIDER", "openrouter").lower()


@dataclass(frozen=True)
class Settings:
    # --- LLM (chat) ---
    llm_provider: str = _PROVIDER  # openrouter|groq|mistral|gemini|openai|anthropic
    llm_model: str = _resolve_model(_PROVIDER)
    llm_api_key: str = _resolve_key(_PROVIDER)
    llm_base_url: str = _get("LLM_BASE_URL", "")  # override for self-host/proxy
    llm_temperature: float = float(_get("LLM_TEMPERATURE", "0.6"))

    # --- Embeddings (RAG) ---
    embed_provider: str = _get("EMBED_PROVIDER", "tfidf")  # tfidf | fastembed | openai
    embed_model: str = _get("EMBED_MODEL", "BAAI/bge-small-en-v1.5")

    # --- Infra (Supabase) ---
    database_url: str = _resolve_database_url()  # Postgres + pgvector
    supabase_url: str = _first_env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    supabase_anon_key: str = _first_env("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    supabase_service_key: str = _first_env("SUPABASE_SERVICE_KEY", "APIKEY", "SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = _get("SUPABASE_JWT_SECRET", "")  # optional; auth can verify via API
    port: int = int(_get("PORT", "8000"))
    app_env: str = _get("APP_ENV", "development")
    # Comma-separated allowed CORS origins (the frontend URL in prod); "*" allows all.
    cors_origins: str = _get("CORS_ORIGINS", "*")
    # Demo mode: gate access behind single-use codes and DISABLE the `Bearer dev` bypass.
    demo_mode: bool = _get("DEMO_MODE", "false").lower() in ("1", "true", "yes")
    # Secret used to sign demo session tokens (falls back to the service key).
    demo_secret: str = _get("DEMO_SECRET", "") or _first_env("SUPABASE_SERVICE_KEY", "APIKEY") or "dataverse-demo"

    @property
    def dev_bypass_enabled(self) -> bool:
        """The `Bearer dev` shortcut is allowed only outside production AND outside demo mode."""
        return self.app_env != "production" and not self.demo_mode

    @property
    def has_llm(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def has_db(self) -> bool:
        return bool(self.database_url)

    @property
    def has_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)


settings = Settings()

# Preferred order to fall back through when the active provider is rate-limited / down.
# (OpenRouter last — its free tier 429s aggressively.)
FAILOVER_ORDER = ["mistral", "gemini", "groq", "openrouter", "openai", "anthropic"]


def provider_chain() -> list[dict]:
    """Ordered providers to try: the configured one first, then any others that have a key.

    Each entry: {provider, model, key, base_url}. Enables automatic failover across the free
    keys in .env so one exhausted daily cap doesn't break the app.
    """
    chain: list[dict] = []
    seen: set[str] = set()

    def add(provider: str, model: str = "") -> None:
        provider = provider.lower()
        if provider in seen:
            return
        key = _resolve_key(provider)
        if not key:
            return
        chain.append({
            "provider": provider,
            "model": model or PROVIDER_DEFAULT_MODEL.get(provider, ""),
            "key": key,
            "base_url": (settings.llm_base_url.rstrip("/") if settings.llm_base_url and provider == settings.llm_provider
                         else PROVIDER_BASE_URLS.get(provider, "")),
        })
        seen.add(provider)

    add(settings.llm_provider, settings.llm_model)  # configured provider first
    for p in FAILOVER_ORDER:
        add(p)
    return chain
