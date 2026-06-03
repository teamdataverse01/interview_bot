"""Apply db/schema.sql to the configured Postgres (Supabase). Idempotent.

    python -m db.migrate
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402

SCHEMA = Path(__file__).resolve().parent / "schema.sql"


def main() -> int:
    if not settings.database_url:
        print("ERROR: DATABASE_URL not configured (need SUPABASE_URL + DATABASE_PASSWORD).", file=sys.stderr)
        return 2
    import psycopg

    sql = SCHEMA.read_text(encoding="utf-8")
    print(f"Connecting to Postgres and applying {SCHEMA.name} ...")
    with psycopg.connect(settings.database_url, connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("Schema applied successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
