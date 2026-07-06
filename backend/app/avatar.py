"""Live talking-avatar video via D-ID (paid). Env-gated: set DID_API_KEY to enable.

Turns text (an interview question or the debrief) into a short talking-head MP4. Low-cost way to
preview the "live avatar" experience before committing to a streaming avatar (HeyGen/D-ID Agents).
"""

from __future__ import annotations

import base64
import time

from app.config import settings

DID_BASE = "https://api.d-id.com"


class AvatarError(RuntimeError):
    pass


def avatar_enabled() -> bool:
    return bool(settings.did_api_key)


def _auth_header() -> str:
    key = settings.did_api_key
    # D-ID keys are used as HTTP Basic. If given as "email:key", base64-encode it; else use as-is.
    if ":" in key and not key.strip().endswith("=="):
        return "Basic " + base64.b64encode(key.encode()).decode()
    return "Basic " + key


def speak(text: str, voice_id: str = "en-US-JennyNeural") -> str:
    """Create a talking-head video from `text`; return the result MP4 URL. Blocks until ready."""
    if not avatar_enabled():
        raise AvatarError("Avatar is not configured (set DID_API_KEY).")
    if not text.strip():
        raise AvatarError("No text to speak.")

    import httpx

    headers = {"Authorization": _auth_header(), "Content-Type": "application/json"}
    body = {
        "source_url": settings.avatar_image_url,
        "script": {
            "type": "text",
            "input": text[:1000],
            "provider": {"type": "microsoft", "voice_id": voice_id},
        },
        "config": {"stitch": True},
    }
    try:
        r = httpx.post(f"{DID_BASE}/talks", headers=headers, json=body, timeout=30)
        r.raise_for_status()
        talk_id = r.json()["id"]
    except httpx.HTTPError as e:  # pragma: no cover - network
        detail = getattr(getattr(e, "response", None), "text", "") or str(e)
        raise AvatarError(f"Avatar create failed: {detail[:300]}") from e

    # Poll for completion (D-ID renders in a few seconds).
    for _ in range(30):
        time.sleep(1.5)
        g = httpx.get(f"{DID_BASE}/talks/{talk_id}", headers=headers, timeout=30)
        if g.status_code != 200:
            continue
        data = g.json()
        status = data.get("status")
        if status == "done" and data.get("result_url"):
            return data["result_url"]
        if status == "error":
            raise AvatarError(f"Avatar render error: {str(data.get('error'))[:200]}")
    raise AvatarError("Avatar render timed out. Please try again.")
