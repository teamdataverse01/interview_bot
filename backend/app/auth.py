"""Auth — verify a Supabase access token and resolve the app user (PRD §10).

The frontend authenticates with Supabase Auth and sends the user's access token as
`Authorization: Bearer <token>`. We verify it by asking Supabase `GET /auth/v1/user`
(so we don't need the JWT secret), then ensure a matching `profiles` + `credits` row exists.

Local dev: send `Authorization: Bearer dev` (only when APP_ENV != production) to act as a
fixed dev user, so the API is testable without a real frontend login.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from dataclasses import dataclass

from app.config import settings

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
DEV_USER_EMAIL = "dev@dataverse.local"

_DEMO_NS = uuid.UUID("da000000-0000-4000-8000-000000000001")


@dataclass
class User:
    id: str
    email: str
    is_admin: bool = False
    is_demo: bool = False


# --- demo session tokens (single-use code grants a signed, code-scoped token) ----
def demo_user_id(code: str) -> str:
    """Deterministic, isolated user id for a demo code (so its session can't be reused)."""
    return str(uuid.uuid5(_DEMO_NS, code))


def sign_demo_token(code: str) -> str:
    """Return an unforgeable token `demo.<code>.<sig>` for a redeemed code."""
    sig = hmac.new(settings.demo_secret.encode(), code.encode(), hashlib.sha256).hexdigest()[:32]
    return f"demo.{code}.{sig}"


def _verify_demo_token(token: str) -> str | None:
    """Return the code if the demo token signature is valid, else None."""
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "demo":
        return None
    code, sig = parts[1], parts[2]
    expected = hmac.new(settings.demo_secret.encode(), code.encode(), hashlib.sha256).hexdigest()[:32]
    return code if hmac.compare_digest(sig, expected) else None


def _verify_supabase_token(token: str) -> tuple[str, str] | None:
    """Return (user_id, email) if the token is valid per Supabase, else None."""
    if not settings.supabase_url:
        return None
    import httpx

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    headers = {"Authorization": f"Bearer {token}", "apikey": settings.supabase_anon_key}
    try:
        r = httpx.get(url, headers=headers, timeout=15)
        if r.status_code != 200:
            return None
        data = r.json()
        return data.get("id"), data.get("email", "")
    except httpx.HTTPError:
        return None


def resolve_user(auth_header: str | None) -> User | None:
    """Resolve the authenticated user from an Authorization header (or None)."""
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()

    # Demo token (single-use code-scoped identity) — valid even in demo mode.
    if token.startswith("demo."):
        code = _verify_demo_token(token)
        if not code:
            return None
        uid = demo_user_id(code)
        is_admin = _ensure_profile(uid, f"demo+{code}@dataverse.local")
        return User(id=uid, email="demo", is_admin=is_admin, is_demo=True)

    # Local dev shortcut (disabled in production AND in demo mode).
    if token == "dev" and settings.dev_bypass_enabled:
        _ensure_profile(DEV_USER_ID, DEV_USER_EMAIL)
        return User(id=DEV_USER_ID, email=DEV_USER_EMAIL, is_admin=True)

    verified = _verify_supabase_token(token)
    if not verified or not verified[0]:
        return None
    uid, email = verified
    is_admin = _ensure_profile(uid, email)
    return User(id=uid, email=email, is_admin=is_admin)


def _ensure_profile(user_id: str, email: str) -> bool:
    """Create profile + starter credits on first sight; return is_admin.

    Accounts whose email is in ADMIN_EMAILS are promoted to admin with unlimited credits.
    """
    from app.db import query_one

    is_admin_email = (email or "").strip().lower() in settings.admin_emails
    try:
        row = query_one("select is_admin from public.profiles where id = %s", (user_id,))
        if row is None:
            query_one(
                "insert into public.profiles (id, email, is_admin) values (%s, %s, %s) "
                "on conflict (id) do nothing returning is_admin",
                (user_id, email, is_admin_email),
            )
            query_one(
                "insert into public.credits (user_id, balance) values (%s, %s) "
                "on conflict (user_id) do nothing returning balance",
                (user_id, 999999 if is_admin_email else 3),
            )
            return is_admin_email
        # Existing profile: keep admin flag in sync with the configured admin list.
        if is_admin_email and not row.get("is_admin"):
            query_one("update public.profiles set is_admin = true where id = %s returning id", (user_id,))
            query_one("update public.credits set balance = 999999 where user_id = %s returning user_id", (user_id,))
            return True
        return bool(row.get("is_admin"))
    except Exception:
        # If the DB isn't reachable yet, don't block dev auth resolution.
        return user_id == DEV_USER_ID
