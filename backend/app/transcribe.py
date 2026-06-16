"""Server-side speech-to-text (cross-browser voice answers).

Uses Groq's free `whisper-large-v3-turbo` by default (you already have a GROQ_API_KEY), with an
OpenAI `whisper-1` fallback if only an OpenAI key is present. OpenAI-compatible multipart API.
"""

from __future__ import annotations

import os

from app.config import settings


class TranscribeError(RuntimeError):
    pass


STT_MODEL_GROQ = os.getenv("STT_MODEL", "whisper-large-v3-turbo")
GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
OPENAI_STT_URL = "https://api.openai.com/v1/audio/transcriptions"
MAX_BYTES = 25 * 1024 * 1024  # 25 MB


def _provider() -> tuple[str, str, str]:
    """Return (url, model, api_key) for the available STT provider."""
    groq_key = os.getenv("GROQ_API_KEY") or (settings.llm_api_key if settings.llm_provider == "groq" else "")
    if groq_key:
        return GROQ_STT_URL, STT_MODEL_GROQ, groq_key
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        return OPENAI_STT_URL, "whisper-1", openai_key
    raise TranscribeError("No speech-to-text key configured (set GROQ_API_KEY or OPENAI_API_KEY).")


def transcribe_audio(content: bytes, filename: str = "audio.webm", content_type: str = "audio/webm") -> str:
    """Transcribe an audio clip to text. Raises TranscribeError on failure."""
    if not content:
        return ""
    if len(content) > MAX_BYTES:
        raise TranscribeError("Audio too large (max 25 MB).")

    import httpx

    url, model, key = _provider()
    files = {"file": (filename, content, content_type)}
    data = {"model": model, "response_format": "json", "language": "en"}
    try:
        r = httpx.post(url, headers={"Authorization": f"Bearer {key}"}, files=files, data=data, timeout=120.0)
        r.raise_for_status()
    except httpx.HTTPError as e:  # pragma: no cover - network
        detail = getattr(getattr(e, "response", None), "text", "") or str(e)
        raise TranscribeError(f"Transcription failed: {detail[:300]}") from e
    return str(r.json().get("text", "")).strip()
