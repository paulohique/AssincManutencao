import os
import sys

from sqlalchemy import text


sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.database import engine


def main() -> None:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("DB OK:", result.scalar_one())


if __name__ == "__main__":
    main()
