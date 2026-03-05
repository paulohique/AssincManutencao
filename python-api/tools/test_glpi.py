import asyncio
import os
import sys

import httpx


sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings


async def main() -> None:
    base_url = settings.GLPI_BASE_URL.rstrip("/")

    has_app_token = bool(getattr(settings, "GLPI_APP_TOKEN", None))
    has_user_token = bool(getattr(settings, "GLPI_USER_TOKEN", None))

    print("GLPI_BASE_URL:", base_url)
    print("GLPI_APP_TOKEN set:", has_app_token)
    print("GLPI_USER_TOKEN set:", has_user_token)

    if not (has_app_token and has_user_token):
        raise SystemExit("Missing GLPI_APP_TOKEN / GLPI_USER_TOKEN in .env")

    timeout = httpx.Timeout(20.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        # initSession
        r = await client.get(
            f"{base_url}/initSession",
            headers={
                "App-Token": settings.GLPI_APP_TOKEN,
                "Authorization": f"user_token {settings.GLPI_USER_TOKEN}",
            },
        )

        if r.status_code != 200:
            print("initSession failed:", r.status_code)
            print(r.text[:1000])
            raise SystemExit(1)

        data = r.json()
        session_token = data.get("session_token")
        if not session_token:
            print("initSession response missing session_token")
            print(data)
            raise SystemExit(1)

        print("initSession OK")

        # Diagnose rights/context
        def _headers():
            return {
                "App-Token": settings.GLPI_APP_TOKEN,
                "Session-Token": session_token,
            }

        async def _get(path: str):
            return await client.get(f"{base_url}/{path.lstrip('/')}", headers=_headers())

        profiles_r = await _get("getMyProfiles")
        if profiles_r.status_code == 200:
            profiles = profiles_r.json()
            print("Profiles:", len(profiles) if isinstance(profiles, list) else profiles)
            active_profile_r = await _get("getActiveProfile")
            if active_profile_r.status_code == 200:
                print("Active profile:", active_profile_r.json())
        else:
            print("getMyProfiles failed:", profiles_r.status_code)

        entities_r = await _get("getMyEntities")
        if entities_r.status_code == 200:
            entities = entities_r.json()
            print("Entities:", len(entities) if isinstance(entities, list) else entities)
            active_entity_r = await _get("getActiveEntities")
            if active_entity_r.status_code == 200:
                print("Active entities:", active_entity_r.json())
        else:
            print("getMyEntities failed:", entities_r.status_code)

        # Minimal read: fetch first computer (range 0-0)
        r2 = await client.get(
            f"{base_url}/Computer",
            headers=_headers(),
            params={"range": "0-0", "expand_dropdowns": "true"},
        )

        if r2.status_code not in (200, 206):
            print("GET /Computer failed:", r2.status_code)
            print(r2.text[:1000])
            raise SystemExit(1)

        computers = r2.json() if r2.content else []
        count = len(computers) if isinstance(computers, list) else 1
        print("GET /Computer OK; items:", count)

        # killSession (best-effort)
        await client.get(
            f"{base_url}/killSession",
            headers={
                "App-Token": settings.GLPI_APP_TOKEN,
                "Session-Token": session_token,
            },
        )

        print("killSession OK")


if __name__ == "__main__":
    asyncio.run(main())
