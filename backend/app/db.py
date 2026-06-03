"""Postgres access (Supabase) — thin psycopg helpers (PRD §9, §11).

MVP uses short-lived connections per call (fine at low traffic). Swap to psycopg_pool later
if needed. All rows come back as dicts.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from app.config import settings


class DBNotConfigured(RuntimeError):
    pass


@contextmanager
def get_conn() -> Iterator[Any]:
    if not settings.database_url:
        raise DBNotConfigured("DATABASE_URL not set — add the Supabase pooler connection string to .env.")
    import psycopg
    from psycopg.rows import dict_row

    conn = psycopg.connect(settings.database_url, row_factory=dict_row, connect_timeout=15)
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
    try:
        return query_one("select 1 as ok") == {"ok": 1}
    except Exception:
        return False
