from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers.auth_controller import router as auth_router
from app.controllers.admin_settings_controller import router as admin_settings_router
from app.controllers.audit_controller import router as audit_router
from app.controllers.dashboard_controller import router as dashboard_router
from app.controllers.devices_controller import router as devices_router
from app.controllers.health_controller import router as health_router
from app.controllers.glpi_tickets_controller import router as glpi_tickets_router
from app.controllers.maintenance_controller import router as maintenance_router
from app.controllers.reports_controller import router as reports_router
from app.controllers.sync_controller import router as sync_router
from app.controllers.users_controller import router as users_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.services.glpi_outbox_service import process_pending
from app.services.user_service import ensure_default_admin


logging.basicConfig(level=logging.INFO)


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Assinc Manutenções API",
    description="API para gerenciamento de manutenção de computadores integrada ao GLPI",
    version="1.0.0",
)


origins = settings.CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(admin_settings_router)
app.include_router(audit_router)
app.include_router(users_router)
app.include_router(sync_router)
app.include_router(dashboard_router)
app.include_router(devices_router)
app.include_router(glpi_tickets_router)
app.include_router(maintenance_router)
app.include_router(reports_router)
app.include_router(health_router)


@app.on_event("startup")
def _startup_seed_admin() -> None:
    db = SessionLocal()
    try:
        ensure_default_admin(db)
    finally:
        db.close()


@app.on_event("startup")
async def _startup_outbox_worker() -> None:
    if not bool(getattr(settings, "GLPI_OUTBOX_WORKER_ENABLED", False)):
        return

    import asyncio

    interval = int(getattr(settings, "GLPI_OUTBOX_PROCESS_INTERVAL_SECONDS", 60) or 60)
    batch = int(getattr(settings, "GLPI_OUTBOX_PROCESS_BATCH_SIZE", 25) or 25)

    async def _loop() -> None:
        while True:
            db = SessionLocal()
            try:
                await process_pending(db, limit=batch)
            except Exception:
                pass
            finally:
                db.close()
            await asyncio.sleep(max(5, interval))

    asyncio.create_task(_loop())
