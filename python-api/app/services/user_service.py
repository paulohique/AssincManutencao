from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.passwords import hash_password, verify_password
from app.models import User


ROLE_ADMIN = "admin"
ROLE_AUDITOR = "auditor"
ROLE_USER = "user"
ROLE_TECNICO = "tecnico"


def role_defaults(role: str) -> Dict[str, bool]:
    if role == ROLE_ADMIN:
        return {
            "can_add_note": True,
            "can_add_maintenance": True,
            "can_generate_report": True,
            "can_manage_permissions": True,
            "can_access_glpi_tickets": True,
        }
    if role == ROLE_AUDITOR:
        return {
            "can_add_note": False,
            "can_add_maintenance": False,
            "can_generate_report": True,
            "can_manage_permissions": False,
            "can_access_glpi_tickets": False,
        }
    if role == ROLE_TECNICO:
        return {
            "can_add_note": True,
            "can_add_maintenance": True,
            "can_generate_report": False,
            "can_manage_permissions": False,
            "can_access_glpi_tickets": True,
        }
    return {
        "can_add_note": False,
        "can_add_maintenance": False,
        "can_generate_report": False,
        "can_manage_permissions": False,
        "can_access_glpi_tickets": False,
    }


def ensure_default_admin(db: Session) -> User:
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        return existing

    defaults = role_defaults(ROLE_ADMIN)
    u = User(
        username="admin",
        password_hash=hash_password("admin"),
        role=ROLE_ADMIN,
        display_name="Administrador",
        email=None,
        groups=[],
        **defaults,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def authenticate_local(db: Session, username: str, password: str) -> User:
    user = get_user_by_username(db, username)
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")

    user.updated_at = datetime.utcnow()
    db.commit()
    return user


def upsert_ldap_user(
    db: Session,
    *,
    username: str,
    display_name: Optional[str],
    email: Optional[str],
    groups: Optional[List[str]],
) -> User:
    # Regra do projeto: novos usuários (vindos do LDAP no futuro) começam como user sem permissões.
    user = get_user_by_username(db, username)
    if not user:
        defaults = role_defaults(ROLE_USER)
        user = User(
            username=username,
            password_hash=None,
            role=ROLE_USER,
            display_name=display_name,
            email=email,
            groups=groups or [],
            **defaults,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    user.display_name = display_name
    user.email = email
    user.groups = groups or []
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def list_users(db: Session) -> List[User]:
    return db.query(User).order_by(User.username.asc()).all()


def update_user_access(
    db: Session,
    *,
    username: str,
    role: str,
    can_add_note: bool,
    can_add_maintenance: bool,
    can_generate_report: bool,
    can_manage_permissions: bool,
    can_access_glpi_tickets: bool,
) -> User:
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if username == "admin" and role != ROLE_ADMIN:
        raise HTTPException(status_code=400, detail="O usuário admin não pode perder o papel de administrador")

    user.role = role
    user.can_add_note = bool(can_add_note)
    user.can_add_maintenance = bool(can_add_maintenance)
    user.can_generate_report = bool(can_generate_report)
    user.can_manage_permissions = bool(can_manage_permissions)
    user.can_access_glpi_tickets = bool(can_access_glpi_tickets)
    user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)
    return user


def to_user_dict(user: User) -> Dict[str, Any]:
    return {
        "username": user.username,
        "display_name": user.display_name,
        "email": user.email,
        "groups": list(user.groups or []),
        "role": user.role,
        "permissions": {
            "add_note": bool(user.can_add_note),
            "add_maintenance": bool(user.can_add_maintenance),
            "generate_report": bool(user.can_generate_report),
            "manage_permissions": bool(user.can_manage_permissions),
            "access_glpi_tickets": bool(getattr(user, "can_access_glpi_tickets", False)),
        },
    }
