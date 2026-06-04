"""Postgres access (Supabase) — thin psycopg helpers (PRD §9, §11).

MVP uses short-lived connections per call (fine at low traffic). Swap to psycopg_pool later
if needed. All rows come back as dicts.
"""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.config import settings


class DBNotConfigured(RuntimeError):
    pass


_SCHEMA_APPLIED = False


def _normalize_database_url(database_url: str) -> str:
    """Ensure Supabase Postgres URLs always use TLS."""
    parsed = urlparse(database_url)
    host = (parsed.hostname or "").lower()
    if not host.endswith("supabase.co"):
        return database_url

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if "sslmode" in query:
        return database_url

    query["sslmode"] = "require"
    return urlunparse(parsed._replace(query=urlencode(query)))


def db_runtime_info() -> dict:
    """Return safe DB connection diagnostics without secrets."""
    raw = settings.database_url or ""
    if not raw:
        return {
            "database_url_present": False,
            "database_host": None,
            "database_port": None,
            "database_name": None,
            "database_sslmode": None,
        }

    normalized = _normalize_database_url(raw)
    parsed = urlparse(normalized)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    db_name = parsed.path.lstrip("/") or None

    return {
        "database_url_present": True,
        "database_host": parsed.hostname,
        "database_port": parsed.port,
        "database_name": db_name,
        "database_sslmode": query.get("sslmode"),
    }


@contextmanager
def get_conn() -> Iterator[Any]:
    if not settings.database_url:
        raise DBNotConfigured("DATABASE_URL not set — add the Supabase pooler connection string to .env.")
    import psycopg
    from psycopg.rows import dict_row

    conn = psycopg.connect(
        _normalize_database_url(settings.database_url),
        row_factory=dict_row,
        connect_timeout=15,
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def query(sql: str, params: tuple = ()) -> list[dict]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        if cur.description:
            return cur.fetchall()
        return []


def query_one(sql: str, params: tuple = ()) -> dict | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple = ()) -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)


def ping() -> bool:
    """Return True if the DB is reachable."""
    ok, _ = ping_detail()
    return ok


def ping_detail() -> tuple[bool, str | None]:
    """Return DB reachability and a compact error message when unavailable."""
    try:
        return query_one("select 1 as ok") == {"ok": 1}, None
    except Exception as exc:
        return False, str(exc)


def ensure_schema() -> bool:
    """Apply db/schema.sql once per process when DB is configured.

    Returns True when schema application succeeds, False when DB is not configured.
    Raises on SQL/connectivity failures so startup logs show the real root cause.
    """
    global _SCHEMA_APPLIED

    if _SCHEMA_APPLIED:
        return True
    if not settings.database_url:
        return False

    schema_path = Path(__file__).resolve().parents[1] / "db" / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql)

    _SCHEMA_APPLIED = True
    return True
