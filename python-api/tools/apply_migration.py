from __future__ import annotations

import os
import sys
from pathlib import Path

import pymysql
from pymysql.constants import CLIENT

# Allows: python python-api/tools/apply_migration.py python-api/migrations/xxx.sql
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: apply_migration.py <path/to/migration.sql>")
        return 2

    mig_path = Path(sys.argv[1]).resolve()
    if not mig_path.exists():
        print(f"Migration file not found: {mig_path}")
        return 2

    sql = mig_path.read_text(encoding="utf-8")

    host = os.getenv("DB_HOST", settings.DB_HOST)
    port = int(os.getenv("DB_PORT", settings.DB_PORT))
    user = os.getenv("DB_USER", settings.DB_USER)
    password = os.getenv("DB_PASSWORD", settings.DB_PASSWORD)
    db = os.getenv("DB_NAME", settings.DB_NAME)

    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=db,
            charset="utf8mb4",
            autocommit=True,
            client_flag=CLIENT.MULTI_STATEMENTS,
        )
    except Exception as e:
        print(f"DB connection failed ({user}@{host}:{port}/{db}): {e}")
        return 1

    try:
        with conn.cursor() as cur:
            try:
                cur.execute(sql)
            except pymysql.err.OperationalError as e:
                print(f"Migration failed: {e}")
                return 1
            except pymysql.err.InternalError as e:
                # e.args: (code, msg)
                code = int(e.args[0]) if e.args else 0
                msg = str(e.args[1]) if len(e.args) > 1 else str(e)
                if code == 1060 or "Duplicate column name" in msg:
                    print("OK (already applied): duplicate column")
                    return 0
                if code == 1061 or "Duplicate key name" in msg:
                    print("OK (already applied): duplicate index")
                    return 0
                print(f"Migration failed: ({code}) {msg}")
                return 1

        print("OK: migration applied")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
