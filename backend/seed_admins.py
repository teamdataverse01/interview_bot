"""Create/refresh the admin accounts in Supabase Auth + mark them admin with unlimited credits.

    python seed_admins.py

Uses the Supabase service key (admin API). Idempotent: re-running updates the password and
ensures the profile is admin. Passwords can be overridden via env (see ADMINS below).
"""

from __future__ import annotations

import os
import sys

import httpx

from app.config import settings
from app.db import query_one

ADMINS = [
    ("msalaudeen@dataversesolutions.org", os.getenv("ADMIN1_PASSWORD", "mozzicato")),
    ("tolaniyan@dataversesolutions.org", os.getenv("ADMIN2_PASSWORD", "temi1000")),
]


def _headers() -> dict:
    key = settings.supabase_service_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _find_user(base: str, email: str) -> dict | None:
    r = httpx.get(f"{base}/auth/v1/admin/users", headers=_headers(), params={"per_page": 200}, timeout=30)
    r.raise_for_status()
    for u in r.json().get("users", []):
        if (u.get("email") or "").lower() == email.lower():
            return u
    return None


def main() -> int:
    base = settings.supabase_url.rstrip("/")
    if not base or not settings.supabase_service_key:
        print("ERROR: SUPABASE_URL / service key not configured.", file=sys.stderr)
        return 2

    for email, password in ADMINS:
        email = email.lower()
        # Create (email pre-confirmed). If it already exists, update the password instead.
        r = httpx.post(
            f"{base}/auth/v1/admin/users",
            headers=_headers(),
            json={"email": email, "password": password, "email_confirm": True},
            timeout=30,
        )
        if r.status_code in (200, 201):
            uid = r.json()["id"]
            action = "created"
        else:
            existing = _find_user(base, email)
            if not existing:
                print(f"  ! {email}: create failed ({r.status_code}) {r.text[:160]}")
                continue
            uid = existing["id"]
            httpx.put(
                f"{base}/auth/v1/admin/users/{uid}",
                headers=_headers(),
                json={"password": password, "email_confirm": True},
                timeout=30,
            )
            action = "updated"

        # Promote to admin with unlimited credits.
        query_one(
            "insert into public.profiles (id, email, is_admin) values (%s, %s, true) "
            "on conflict (id) do update set is_admin = true, email = excluded.email returning id",
            (uid, email),
        )
        query_one(
            "insert into public.credits (user_id, balance) values (%s, 999999) "
            "on conflict (user_id) do update set balance = 999999 returning user_id",
            (uid,),
        )
        print(f"  ✓ {email} — {action}, admin + unlimited credits")

    print("Done. Admins can sign in with email/password on the login page.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
