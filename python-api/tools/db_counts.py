import os
import sys

from sqlalchemy import text


# Ensure python-api is on sys.path when running from repo root
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.database import engine

with engine.connect() as c:
    computers = c.execute(text("select count(*) from computers")).scalar()
    components = c.execute(text("select count(*) from computer_components")).scalar()

print({"computers": int(computers or 0), "components": int(components or 0)})
