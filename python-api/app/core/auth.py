from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
import ipaddress
from typing import Any, Callable, Dict, List, Optional

import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import User


def _jwt_now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(payload: Dict[str, Any]) -> str:
    now = _jwt_now()
    exp = now + timedelta(minutes=int(settings.JWT_EXPIRES_MINUTES))

    to_encode = {
        **payload,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    secret = settings.JWT_SECRET
    if not secret or secret == "change-me":
        raise HTTPException(status_code=500, detail="JWT_SECRET não configurado")

    return jwt.encode(to_encode, secret, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


security = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # Modo temporário: permite desativar a exigência de autenticação via env.
    # Mantém o resto do código/rotas intacto e facilita reativar no futuro.
    if not settings.AUTH_ENABLED:
        return {"sub": "anonymous", "auth_disabled": True, "role": "anonymous", "permissions": {}}

    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Não autenticado")

    payload = decode_access_token(creds.credentials)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    return {
        "sub": user.username,
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


def _normalize_group_dns(member_of: Any) -> List[str]:
    if not member_of:
        return []
    if isinstance(member_of, str):
        return [member_of]
    if isinstance(member_of, (list, tuple)):
        return [str(x) for x in member_of]
    return [str(member_of)]


def ldap_authenticate(username: str, password: str) -> Dict[str, Any]:
    """Autentica no AD via bind.

    - NÃO grava nada no LDAP/AD.
    - Retorna dados básicos do usuário e grupos (DNs) se base_dn estiver configurado.
    """
    if not settings.LDAP_SERVER:
        raise HTTPException(status_code=503, detail="LDAP_SERVER não configurado")

    from ldap3 import ALL, Connection, Server

    bind_user = username.strip()
    if "\\" not in bind_user and "@" not in bind_user and settings.LDAP_DOMAIN:
        bind_user = f"{bind_user}@{settings.LDAP_DOMAIN}"

    server = Server(
        settings.LDAP_SERVER,
        get_info=ALL,
        use_ssl=bool(settings.LDAP_USE_SSL),
        connect_timeout=int(settings.LDAP_CONNECT_TIMEOUT_SECONDS),
    )

    try:
        conn = Connection(server, user=bind_user, password=password, auto_bind=True)
    except Exception:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")

    user_info: Dict[str, Any] = {
        "username": username.strip(),
        "display_name": None,
        "email": None,
        "groups": [],
    }

    base_dn = (settings.LDAP_BASE_DN or "").strip()
    sam = username.split("\\")[-1].split("@")[0]
    if base_dn:
        try:
            conn.search(
                search_base=base_dn,
                search_filter=f"(&(objectClass=user)(sAMAccountName={sam}))",
                attributes=["displayName", "mail", "memberOf"],
            )
            if conn.entries:
                entry = conn.entries[0]
                user_info["display_name"] = str(getattr(entry, "displayName", "") or "") or None
                user_info["email"] = str(getattr(entry, "mail", "") or "") or None
                user_info["groups"] = _normalize_group_dns(getattr(entry, "memberOf", None))
        except Exception:
            pass

    try:
        conn.unbind()
    except Exception:
        pass

    return user_info


def require_permission(permission: str) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    def _dep(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if not settings.AUTH_ENABLED:
            return user
        if user.get("role") == "admin":
            return user
        perms = user.get("permissions") or {}
        if not bool(perms.get(permission)):
            raise HTTPException(status_code=403, detail="Sem permissão")
        return user

    return _dep


def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not settings.AUTH_ENABLED:
        return user
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    return user


def require_glpi_webhook_token(
    x_glpi_webhook_token: Optional[str] = Header(None, alias="X-Glpi-Webhook-Token"),
) -> Dict[str, Any]:
    expected = (getattr(settings, "GLPI_WEBHOOK_TOKEN", None) or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="GLPI_WEBHOOK_TOKEN não configurado")

    got = (x_glpi_webhook_token or "").strip()
    if not got or not secrets.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="Webhook token inválido")

    # Retorna um "principal" simples para logs/uso futuro.
    return {"sub": "glpi-webhook", "role": "system"}


def require_glpi_webhook_network(request: Request) -> Dict[str, Any]:
    """Opcional: restringe o webhook por IP/CIDR.

    Observação: se houver proxy/reverse-proxy na frente (Nginx/Traefik),
    `request.client.host` pode ser o IP do proxy. Nesse caso, prefira
    restringir no firewall/reverse-proxy, ou configure corretamente proxy headers.
    """

    raw = (getattr(settings, "GLPI_WEBHOOK_ALLOWED_IPS", None) or "").strip()
    if not raw:
        return {"net": "any"}

    client_ip = None
    try:
        if request.client and request.client.host:
            client_ip = ipaddress.ip_address(str(request.client.host))
    except Exception:
        client_ip = None

    if client_ip is None:
        raise HTTPException(status_code=403, detail="IP do cliente não identificado")

    allowed = [x.strip() for x in raw.split(",") if x.strip()]
    for entry in allowed:
        try:
            if "/" in entry:
                net = ipaddress.ip_network(entry, strict=False)
                if client_ip in net:
                    return {"net": entry}
            else:
                if client_ip == ipaddress.ip_address(entry):
                    return {"net": entry}
        except Exception:
            continue

    raise HTTPException(status_code=403, detail="IP não permitido")
