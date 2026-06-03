"""Provider-agnostic LLM gateway (PRD §8).

A single `chat()` entry point behind which OpenRouter / OpenAI / Anthropic all look identical.
Switch providers/models via env vars only (see app.config). Most free models (DeepSeek, Qwen on
OpenRouter) speak the OpenAI Chat Completions format, which is the default path here.

`chat_json()` requests strict-JSON output and parses it — used by the Evaluation Engine (M3),
which must return a deterministic scorecard.

Network deps (`httpx`) are imported lazily so this module imports cleanly with no key/deps set
(e.g. while running the M1 parser/retriever offline).
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

_DUR_RE = re.compile(r"(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?|(?:([\d.]+)ms)")


def _parse_duration(s: str) -> float:
    """Parse a Groq rate-limit duration like '1h0m28.8s' or '205ms' into seconds."""
    if not s:
        return 0.0
    s = s.strip()
    if s.endswith("ms") and "s" not in s[:-2]:
        try:
            return float(s[:-2]) / 1000.0
        except ValueError:
            return 0.0
    h = m = sec = 0.0
    mh = re.search(r"(\d+)h", s)
    mm = re.search(r"(\d+)m(?!s)", s)
    ms = re.search(r"([\d.]+)s", s)
    if mh:
        h = float(mh.group(1))
    if mm:
        m = float(mm.group(1))
    if ms:
        sec = float(ms.group(1))
    return h * 3600 + m * 60 + sec

from app.config import PROVIDER_BASE_URLS, provider_chain, settings

# Retry config for transient rate-limit / overload responses (free tiers hit these).
_RETRY_STATUS = {429, 500, 502, 503}
# Statuses that should trigger failover to the next provider (after retries are exhausted).
_FAILOVER_STATUS = {429, 500, 502, 503, 404}
_MAX_RETRIES = 5
# Cap a single backoff wait. Free-tier token-per-minute limits often need ~45-60s to clear,
# so the cap must exceed a minute boundary or we retry too early and give up.
_MAX_BACKOFF = 65


class LLMError(RuntimeError):
    pass


class _ProviderUnavailable(Exception):
    """Raised internally when a provider is rate-limited/down so we can fail over."""


def _headers(provider: str, key: str) -> dict[str, str]:
    h = {"Authorization": f"Bearer {key}"}
    if provider == "openrouter":
        # OpenRouter asks for these for attribution; harmless elsewhere.
        h["HTTP-Referer"] = "https://dataverse.ai"
        h["X-Title"] = "Dataverse AI Interview Coach"
    return h


def _call_provider(prov: dict, payload: dict, messages, temperature, max_tokens, response_format) -> str:
    """One provider attempt with internal retry/backoff. Raises _ProviderUnavailable to fail over."""
    import httpx  # lazy import

    base = prov["base_url"] or PROVIDER_BASE_URLS.get(prov["provider"], "")
    url = f"{base.rstrip('/')}/chat/completions"
    body = dict(payload, model=prov["model"])
    headers = _headers(prov["provider"], prov["key"])

    resp = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = httpx.post(url, json=body, headers=headers, timeout=60.0)
        except httpx.HTTPError as e:  # pragma: no cover - network
            if attempt < _MAX_RETRIES:
                time.sleep(2 ** attempt)
                continue
            raise _ProviderUnavailable(f"{prov['provider']}: connection error: {e}")

        if resp.status_code in _RETRY_STATUS and attempt < _MAX_RETRIES:
            # Prefer Retry-After; else provider rate-limit reset header; else exponential backoff.
            retry_after = float(resp.headers.get("retry-after", 0) or 0)
            reset = _parse_duration(
                resp.headers.get("x-ratelimit-reset-tokens", "")
                or resp.headers.get("x-ratelimit-reset-requests", "")
            )
            wait = (retry_after or reset or (2 ** attempt)) + 1.0
            # If the wait is long (daily cap), don't burn time — fail over immediately.
            if wait > _MAX_BACKOFF:
                raise _ProviderUnavailable(f"{prov['provider']}: rate-limited (reset ~{int(wait)}s)")
            time.sleep(wait)
            continue
        break

    if resp.status_code in _FAILOVER_STATUS:
        raise _ProviderUnavailable(f"{prov['provider']}: HTTP {resp.status_code}")
    if resp.status_code >= 400:
        raise LLMError(f"LLM request failed ({prov['provider']} HTTP {resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise LLMError(f"Unexpected LLM response shape from {prov['provider']}: {data}") from e


def chat(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int = 1200,
    response_format: dict | None = None,
) -> str:
    """Send a chat completion and return the assistant text, failing over across providers.

    Tries the configured provider first, then any other provider with a key in .env (PRD §8).
    `messages` is the OpenAI format: [{"role": "system"|"user"|"assistant", "content": "..."}].
    """
    chain = provider_chain()
    if not chain:
        raise LLMError(
            "No LLM key configured. Set LLM_PROVIDER + a provider key (e.g. GROQ_API_KEY / "
            "MISTRAL_API_KEY) in .env. See .env.example."
        )

    payload: dict[str, Any] = {
        "messages": messages,
        "temperature": settings.llm_temperature if temperature is None else temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        payload["response_format"] = response_format

    errors: list[str] = []
    for prov in chain:
        if model and prov is chain[0]:
            prov = dict(prov, model=model)  # honor explicit per-call model on the primary
        try:
            return _call_provider(prov, payload, messages, temperature, max_tokens, response_format)
        except _ProviderUnavailable as e:
            errors.append(str(e))
            continue  # fail over to the next provider
    raise LLMError("All providers unavailable: " + "; ".join(errors))


_JSON_BLOCK = re.compile(r"\{.*\}", re.S)


def _repair_json(raw: str) -> dict | None:
    """Best-effort recovery of a truncated JSON object (e.g. cut off by max_tokens).

    Closes an unterminated trailing string and balances open brackets/braces, then parses.
    Returns None if it still can't be parsed.
    """
    start = raw.find("{")
    if start == -1:
        return None
    s = raw[start:]
    # If we're inside an unterminated string, close it.
    in_str = False
    esc = False
    stack: list[str] = []
    for ch in s:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]" and stack:
            stack.pop()
    repaired = s
    if in_str:
        repaired += '"'
    # Drop a dangling key with no value (… "key":  ) by trimming to last complete pair.
    repaired = re.sub(r',\s*"[^"]*"\s*:\s*$', "", repaired)
    repaired += "".join(reversed(stack))
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        return None


def chat_json(messages: list[dict[str, str]], **kw) -> dict:
    """Chat and parse a JSON object out of the response (tolerant of fences/truncation)."""
    kw.setdefault("response_format", {"type": "json_object"})
    raw = chat(messages, **kw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = _JSON_BLOCK.search(raw)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        repaired = _repair_json(raw)
        if repaired is not None:
            return repaired
        raise LLMError(f"Model did not return valid JSON:\n{raw[:500]}")
