import asyncio
import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal  # noqa: E402
from app.services.glpi_outbox_service import process_pending  # noqa: E402


async def main() -> None:
    limit = int(os.getenv("GLPI_OUTBOX_PROCESS_BATCH_SIZE", "25"))

    db = SessionLocal()
    try:
        res = await process_pending(db, limit=limit)
        print(res)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
