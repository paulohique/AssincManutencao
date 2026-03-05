from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from app.core.config import settings


router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Assinc Manutenções API",
        "auth_enabled": bool(settings.AUTH_ENABLED),
        "timestamp": datetime.utcnow().isoformat(),
    }
