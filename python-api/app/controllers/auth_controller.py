from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, get_current_user, ldap_authenticate
from app.core.config import settings
from app.core.database import get_db
from app.schemas.schemas import LoginRequest, LoginResponse, UserOut
from app.services.user_service import authenticate_local, ensure_default_admin, to_user_dict, upsert_ldap_user


router = APIRouter(tags=["auth"])


@router.post("/api/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # garante seed do admin/admin
    ensure_default_admin(db)

    username = (payload.username or "").strip()
    password = payload.password or ""

    # 1) Login local (sempre disponível)
    try:
        local_user = authenticate_local(db, username, password)
        user_dict = to_user_dict(local_user)
        token = create_access_token({"sub": user_dict["username"]})
        return LoginResponse(
            access_token=token,
            user=UserOut(**user_dict),
        )
    except Exception:
        pass

    # 2) (Opcional) LDAP/AD no futuro
    if settings.LOGIN_ALLOW_LDAP:
        info = ldap_authenticate(username, password)
        db_user = upsert_ldap_user(
            db,
            username=str(info.get("username")),
            display_name=info.get("display_name"),
            email=info.get("email"),
            groups=list(info.get("groups") or []),
        )
        user_dict = to_user_dict(db_user)
        token = create_access_token({"sub": user_dict["username"]})
        return LoginResponse(access_token=token, user=UserOut(**user_dict))

    # Sem LDAP e sem usuário local
    raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")


@router.get("/api/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return UserOut(
        username=str(user.get("sub")),
        display_name=user.get("display_name"),
        email=user.get("email"),
        groups=list(user.get("groups") or []),
        role=str(user.get("role") or "user"),
        permissions=dict(user.get("permissions") or {}),
    )
