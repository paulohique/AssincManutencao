from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.schemas.schemas import UserAccessUpdate, UserAdminRow
from app.services.user_service import list_users, to_user_dict, update_user_access


router = APIRouter(tags=["users"])


@router.get("/api/users", response_model=List[UserAdminRow])
async def users_list(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    rows = []
    for u in list_users(db):
        d = to_user_dict(u)
        rows.append(
            UserAdminRow(
                username=d["username"],
                display_name=d.get("display_name"),
                email=d.get("email"),
                role=str(d.get("role") or "user"),
                permissions=dict(d.get("permissions") or {}),
            )
        )
    return rows


@router.put("/api/users/{username}", response_model=UserAdminRow)
async def users_update(
    username: str,
    payload: UserAccessUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    u = update_user_access(
        db,
        username=username,
        role=payload.role,
        can_add_note=payload.add_note,
        can_add_maintenance=payload.add_maintenance,
        can_generate_report=payload.generate_report,
        can_manage_permissions=payload.manage_permissions,
        can_access_glpi_tickets=payload.access_glpi_tickets,
    )
    d = to_user_dict(u)
    return UserAdminRow(
        username=d["username"],
        display_name=d.get("display_name"),
        email=d.get("email"),
        role=str(d.get("role") or "user"),
        permissions=dict(d.get("permissions") or {}),
    )
