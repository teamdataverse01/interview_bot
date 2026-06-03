"""Auth — verify a Supabase access token and resolve the app user (PRD §10).

The frontend authenticates with Supabase Auth and sends the user's access token as
`Authorization: Bearer <token>`. We verify it by asking Supabase `GET /auth/v1/user`
(so we don't need the JWT secret), then ensure a matching `profiles` + `credits` row exists.

Local dev: send `Authorization: Bearer dev` (only when APP_ENV != production) to act as a
fixed dev user, so the API is testable without a real frontend login.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
DEV_USER_EMAIL = "dev@dataverse.local"


@dataclass
class User:
    id: str
    email: str
    is_admin: bool = False


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

    # Local dev shortcut.
    if token == "dev" and settings.app_env != "production":
        _ensure_profile(DEV_USER_ID, DEV_USER_EMAIL)
        return User(id=DEV_USER_ID, email=DEV_USER_EMAIL, is_admin=True)

    verified = _verify_supabase_token(token)
    if not verified or not verified[0]:
        return None
    uid, email = verified
    is_admin = _ensure_profile(uid, email)
    return User(id=uid, email=email, is_admin=is_admin)


def _ensure_profile(user_id: str, email: str) -> bool:
    """Create profile + starter credits on first sight; return is_admin."""
    from app.db import query_one

    try:
        row = query_one("select is_admin from public.profiles where id = %s", (user_id,))
        if row is None:
            query_one(
                "insert into public.profiles (id, email) values (%s, %s) "
                "on conflict (id) do nothing returning is_admin",
                (user_id, email),
            )
            query_one(
                "insert into public.credits (user_id) values (%s) on conflict (user_id) do nothing returning balance",
                (user_id,),
            )
            return False
        return bool(row.get("is_admin"))
    except Exception:
        # If the DB isn't reachable yet, don't block dev auth resolution.
        return user_id == DEV_USER_ID
