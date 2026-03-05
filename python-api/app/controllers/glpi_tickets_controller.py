from __future__ import annotations

import asyncio
import time
import logging
import re
import unicodedata
import html
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user

from app.core.auth import require_permission
from app.core.config import settings
from app.core.database import get_db
from app.integrations.glpi_client import GlpiClient
from app.services.settings_service import get_bool_setting, get_int_setting


router = APIRouter(tags=["glpi"])

logger = logging.getLogger(__name__)


_tickets_cache_lock = asyncio.Lock()
_tickets_cache: Dict[str, Dict[str, Any]] = {}


def _cache_key(*, category: str, limit: int) -> str:
    return f"cat={_norm(category)}|limit={int(limit)}"


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    entry = _tickets_cache.get(key)
    if not entry:
        return None
    now = time.time()
    ttl = int(getattr(settings, "GLPI_TICKETS_CACHE_TTL_SECONDS", 30) or 30)
    stale_max = int(getattr(settings, "GLPI_TICKETS_CACHE_STALE_MAX_SECONDS", 600) or 600)
    age = now - float(entry.get("ts") or 0)
    if age <= ttl:
        return entry
    if age <= stale_max:
        return entry
    return None


def _cache_is_fresh(entry: Dict[str, Any]) -> bool:
    now = time.time()
    ttl = int(getattr(settings, "GLPI_TICKETS_CACHE_TTL_SECONDS", 30) or 30)
    age = now - float(entry.get("ts") or 0)
    return age <= ttl


def _cache_set(key: str, payload: Dict[str, Any]) -> None:
    _tickets_cache[key] = {"ts": time.time(), **payload}


def _norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"\s+", " ", s)
    return s


def _dropdown_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("completename", "name", "value", "text"):
            v = value.get(key)
            if isinstance(v, str) and v.strip():
                return v
        return ""
    return str(value)


def _ticket_status_is_open(status: Any) -> bool:
    # GLPI: New=1, Assigned=2, Planned=3, Waiting=4, Solved=5, Closed=6
    try:
        s = int(status)
        return 1 <= s <= 4
    except Exception:
        # Se vier string/dict, tenta algo aproximado (alguns GLPIs retornam label PT-BR)
        st = _norm(_dropdown_str(status))
        if st in {"new", "assigned", "planned", "waiting"}:
            return True

        # PT-BR / variações
        # Novo, Atribuído, Planejado, Pendente / Em espera
        open_tokens = {
            "novo",
            "atribuido",
            "atribuida",
            "planejado",
            "planejada",
            "pendente",
            "aguardando",
            "em espera",
            "em_espera",
            "espera",
        }

        if st in open_tokens:
            return True

        # Heurística: contém palavras-chave
        if any(tok in st for tok in ("novo", "atribu", "planej", "pend")):
            return True

        return False


def _status_label(status: Any) -> str:
    try:
        s = int(status)
    except Exception:
        return "Aberto"

    if s == 1:
        return "Novo"
    if s == 2:
        return "Atribuído"
    if s == 3:
        return "Planejado"
    if s == 4:
        return "Pendente"
    if s == 5:
        return "Solucionado"
    if s == 6:
        return "Fechado"
    return "Desconhecido"


def _parse_glpi_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None

    # GLPI costuma mandar: "YYYY-MM-DD HH:MM:SS" ou ISO.
    # Best-effort; assume UTC quando não há timezone.
    s = s.replace("Z", "+00:00")
    try:
        if "T" not in s and " " in s:
            # tenta converter para ISO (aceito por fromisoformat)
            s_iso = s.replace(" ", "T")
            dt = datetime.fromisoformat(s_iso)
        else:
            dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass

    # Fallback para formatos comuns
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            dt = datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            continue
    return None


def _require_glpi_tickets_access(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    # Se auth estiver desabilitado, permite.
    if not bool(getattr(settings, "AUTH_ENABLED", False)):
        return user

    role = str(user.get("role") or "")
    if role == "admin":
        return user
    if role == "auditor":
        raise HTTPException(status_code=403, detail="Sem permissão")

    perms = user.get("permissions") or {}
    if not bool(perms.get("access_glpi_tickets")):
        raise HTTPException(status_code=403, detail="Sem permissão")
    return user


class GlpiFollowupCreate(BaseModel):
    content: str = Field(..., min_length=1)


@router.get("/api/glpi/tickets/open")
async def list_open_tickets(
    limit: int = Query(20, ge=1, le=20),
    category: str = Query("computador"),
    _user=Depends(require_permission("add_maintenance")),
) -> Dict[str, Any]:
    """Lista tickets abertos para seleção no registro de manutenção.

    Retorna somente campos essenciais: id (número) e título.
    """
    cache_key = _cache_key(category=category, limit=limit)

    async with _tickets_cache_lock:
        cached = _cache_get(cache_key)

    if cached and _cache_is_fresh(cached):
        return {"items": cached.get("items") or [], "total": int(cached.get("total") or 0)}

    glpi = GlpiClient()
    try:
        # Busca um pouco mais para aumentar a chance de pegar os mais recentes,
        # mas retorna somente os últimos `limit`.
        tickets = await glpi.get_open_tickets(limit=max(200, limit))
    except Exception as e:
        if cached:
            return {"items": cached.get("items") or [], "total": int(cached.get("total") or 0)}
        raise HTTPException(status_code=502, detail=f"Falha ao consultar GLPI: {e}")

    try:
        raw_ids = []
        for t in tickets[-3:]:
            if isinstance(t, dict):
                raw_ids.append({"id": t.get("id"), "status": t.get("status"), "cat": _dropdown_str(t.get("itilcategories_id"))})
        logger.info("GLPI raw last 3 tickets (id/status/cat): %s", raw_ids)
    except Exception:
        pass

    wanted_cat = _norm(category)

    items: List[Dict[str, Any]] = []
    for t in tickets:
        if not isinstance(t, dict):
            continue

        if not _ticket_status_is_open(t.get("status")):
            continue

        cat_raw = t.get("itilcategories_id")
        cat_name = _norm(_dropdown_str(cat_raw))
        if wanted_cat and cat_name and wanted_cat not in cat_name:
            continue

        ticket_id = t.get("id")
        try:
            ticket_id_int = int(ticket_id)
        except Exception:
            continue
        if ticket_id_int <= 0:
            continue

        title = t.get("name") or t.get("title") or t.get("subject") or ""
        title = str(title).strip()
        if title:
            title = html.unescape(title)
            # Alguns títulos do GLPI vêm com separador hierárquico (ex.: "SSP > Defesa Civil").
            # Padroniza removendo o caractere '>' para não aparecer como '&#62;' ou '>'.
            title = title.replace(">", "-")
            title = re.sub(r"\s*-\s*", " - ", title)
            title = re.sub(r"\s+", " ", title).strip()

        items.append({"id": ticket_id_int, "title": title})

    # Ordena por id desc (mais recentes primeiro)
    items.sort(key=lambda x: x.get("id", 0), reverse=True)
    items = items[:limit]

    try:
        logger.info("GLPI filtered tickets (showing up to 3): %s", items[:3])
    except Exception:
        pass

    payload = {"items": items, "total": len(items)}
    async with _tickets_cache_lock:
        _cache_set(cache_key, payload)
    return payload


@router.get("/api/glpi/tickets/queue")
async def list_ticket_queue(
    limit: int = Query(50, ge=1, le=100),
    category: str = Query("computador"),
    _user=Depends(_require_glpi_tickets_access),
) -> Dict[str, Any]:
    """Fila de chamados do GLPI para a Home.

    Retorna tickets Novos/Abertos (status 1-4) filtrados por categoria (ex.: computador).
    """
    glpi = GlpiClient()
    try:
        tickets = await glpi.get_open_tickets(limit=max(300, limit))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar GLPI: {e}")

    wanted_cat = _norm(category)

    items: List[Dict[str, Any]] = []
    for t in tickets:
        if not isinstance(t, dict):
            continue
        if not _ticket_status_is_open(t.get("status")):
            continue

        cat_raw = t.get("itilcategories_id")
        cat_name = _norm(_dropdown_str(cat_raw))
        if wanted_cat and cat_name and wanted_cat not in cat_name:
            continue

        try:
            ticket_id = int(t.get("id"))
        except Exception:
            continue
        if ticket_id <= 0:
            continue

        title = t.get("name") or t.get("title") or t.get("subject") or ""
        title = html.unescape(str(title or "").strip())
        title = title.replace(">", "-")
        title = re.sub(r"\s*\-\s*", " - ", title)
        title = re.sub(r"\s+", " ", title).strip()

        status = t.get("status")
        requester = _dropdown_str(t.get("users_id_recipient"))
        assigned = _dropdown_str(t.get("users_id_assign"))
        updated_at = t.get("date_mod") or t.get("date") or t.get("date_creation")
        created_at = t.get("date_creation") or t.get("date")
        priority = t.get("priority")

        items.append(
            {
                "id": ticket_id,
                "title": title,
                "status": int(status) if str(status).isdigit() else status,
                "status_label": _status_label(status),
                "category": _dropdown_str(cat_raw),
                "requester": requester,
                "assigned_to": assigned,
                "created_at": created_at,
                "updated_at": updated_at,
                "priority": priority,
            }
        )

    items.sort(key=lambda x: x.get("id", 0), reverse=True)
    items = items[:limit]

    # Enriquecer com nomes dos usuários atribuídos (Ticket_User type=2)
    # Best-effort, com limite de concorrência para não sobrecarregar o GLPI.
    sem = asyncio.Semaphore(10)

    async def _enrich_assigned(it: Dict[str, Any]) -> None:
        try:
            tid = int(it.get("id") or 0)
        except Exception:
            return
        if tid <= 0:
            return

        async with sem:
            try:
                actor_names = await glpi.get_ticket_assigned_user_names(tid)
            except Exception:
                actor_names = []

        primary = str(it.get("assigned_to") or "").strip()
        names: List[str] = []
        seen: set[str] = set()

        if primary:
            k = primary.lower()
            if k not in seen:
                seen.add(k)
                names.append(primary)

        for n in actor_names:
            n = (n or "").strip()
            if not n:
                continue
            k = n.lower()
            if k in seen:
                continue
            seen.add(k)
            names.append(n)

        if names:
            it["assigned_to"] = ", ".join(names)

    await asyncio.gather(*[_enrich_assigned(it) for it in items])

    return {"items": items, "total": len(items)}


@router.get("/api/glpi/tickets/alerts")
async def list_ticket_alerts(
    category: str = Query("computador"),
    db: Session = Depends(get_db),
    _user=Depends(_require_glpi_tickets_access),
) -> Dict[str, Any]:
    """Alertas para SLA de pop-up.

    - unassigned: tickets abertos sem responsável há N dias (desde a criação)
    - stale: tickets abertos sem movimentação há N dias (desde a última atualização)
    """

    enabled = get_bool_setting(db, "glpi_alerts_enabled", False)
    unassigned_days = get_int_setting(db, "glpi_unassigned_alert_days", 5)
    stale_days = get_int_setting(db, "glpi_stale_alert_days", 5)

    if not enabled:
        return {
            "enabled": False,
            "thresholds": {"unassigned_days": unassigned_days, "stale_days": stale_days},
            "unassigned": [],
            "stale": [],
            "total_unassigned": 0,
            "total_stale": 0,
        }

    glpi = GlpiClient()
    try:
        tickets = await glpi.get_open_tickets(limit=500)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar GLPI: {e}")

    wanted_cat = _norm(category)
    now = datetime.now(timezone.utc)

    unassigned: List[Dict[str, Any]] = []
    stale: List[Dict[str, Any]] = []

    for t in tickets:
        if not isinstance(t, dict):
            continue
        if not _ticket_status_is_open(t.get("status")):
            continue

        cat_raw = t.get("itilcategories_id")
        cat_name = _norm(_dropdown_str(cat_raw))
        if wanted_cat and cat_name and wanted_cat not in cat_name:
            continue

        try:
            ticket_id = int(t.get("id"))
        except Exception:
            continue
        if ticket_id <= 0:
            continue

        title = t.get("name") or t.get("title") or t.get("subject") or ""
        title = html.unescape(str(title or "").strip())
        title = title.replace(">", "-")
        title = re.sub(r"\s*\-\s*", " - ", title)
        title = re.sub(r"\s+", " ", title).strip()

        requester = _dropdown_str(t.get("users_id_recipient"))
        assigned_to = _dropdown_str(t.get("users_id_assign"))
        created_raw = t.get("date_creation") or t.get("date")
        updated_raw = t.get("date_mod") or t.get("date") or t.get("date_creation")
        created_dt = _parse_glpi_datetime(created_raw)
        updated_dt = _parse_glpi_datetime(updated_raw)

        base_item = {
            "id": ticket_id,
            "title": title,
            "status": int(t.get("status")) if str(t.get("status")).isdigit() else t.get("status"),
            "status_label": _status_label(t.get("status")),
            "category": _dropdown_str(cat_raw),
            "requester": requester or None,
            "assigned_to": assigned_to or None,
            "created_at": created_raw,
            "updated_at": updated_raw,
            "priority": t.get("priority"),
        }

        # Sem atribuição: considera "vazio" ou "0".
        is_unassigned = not str(assigned_to or "").strip() or str(assigned_to).strip() in {"0", "-"}
        if is_unassigned and created_dt is not None:
            age_days = int((now - created_dt).total_seconds() // 86400)
            if age_days >= int(unassigned_days):
                unassigned.append({**base_item, "age_days": age_days})

        # Sem movimentação: usa última atualização.
        if updated_dt is not None:
            stale_age_days = int((now - updated_dt).total_seconds() // 86400)
            if stale_age_days >= int(stale_days):
                stale.append({**base_item, "stale_days": stale_age_days})

    unassigned.sort(key=lambda x: x.get("age_days", 0), reverse=True)
    stale.sort(key=lambda x: x.get("stale_days", 0), reverse=True)

    return {
        "enabled": True,
        "thresholds": {"unassigned_days": unassigned_days, "stale_days": stale_days},
        "unassigned": unassigned,
        "stale": stale,
        "total_unassigned": len(unassigned),
        "total_stale": len(stale),
    }


@router.get("/api/glpi/tickets/{ticket_id}/followups")
async def list_ticket_followups(
    ticket_id: int,
    _user=Depends(_require_glpi_tickets_access),
) -> Dict[str, Any]:
    glpi = GlpiClient()
    try:
        rows = await glpi.get_ticket_followups(int(ticket_id), limit=100)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar GLPI: {e}")

    items: List[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        try:
            fid = int(r.get("id"))
        except Exception:
            fid = None

        content = r.get("content") or r.get("comment") or r.get("text") or ""
        content = str(content or "").strip()
        if content:
            content = html.unescape(content)

        author = _dropdown_str(r.get("users_id") or r.get("users_id_editor") or r.get("users_id_author"))
        created_at = r.get("date_creation") or r.get("date") or r.get("date_mod")

        items.append(
            {
                "id": fid,
                "author": author or None,
                "created_at": str(created_at) if created_at is not None else None,
                "content": content,
            }
        )

    return {"items": items, "total": len(items)}


@router.post("/api/glpi/tickets/{ticket_id}/followups")
async def add_ticket_followup_endpoint(
    ticket_id: int,
    payload: GlpiFollowupCreate,
    user: Dict[str, Any] = Depends(_require_glpi_tickets_access),
) -> Dict[str, Any]:
    content = str(payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Conteúdo é obrigatório")

    # Se auth estiver habilitado, assina a mensagem para facilitar auditoria no GLPI
    if bool(getattr(settings, "AUTH_ENABLED", False)):
        who = (user.get("display_name") or user.get("sub") or "").strip()
        if who:
            content = f"{content}\n\n— {who}"

    glpi = GlpiClient()
    try:
        await glpi.add_ticket_followup(int(ticket_id), content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao adicionar acompanhamento no GLPI: {e}")

    return {"ok": True}


@router.get("/api/glpi/tickets/{ticket_id}/attachments")
async def list_ticket_attachments(
    ticket_id: int,
    _user=Depends(_require_glpi_tickets_access),
) -> Dict[str, Any]:
    glpi = GlpiClient()
    try:
        rows = await glpi.get_ticket_attachments(int(ticket_id), limit=100)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar GLPI: {e}")

    items: List[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue

        try:
            rid = int(r.get("id"))
        except Exception:
            rid = None

        doc_raw = r.get("documents_id")
        doc_name = _dropdown_str(doc_raw).strip()
        doc_id: Optional[int] = None
        if isinstance(doc_raw, int):
            doc_id = int(doc_raw)
        elif isinstance(doc_raw, str):
            try:
                doc_id = int(doc_raw)
            except Exception:
                doc_id = None
        elif isinstance(doc_raw, dict):
            raw_id = doc_raw.get("id")
            try:
                doc_id = int(raw_id) if raw_id is not None else None
            except Exception:
                doc_id = None

        filename: Optional[str] = None
        if doc_id:
            try:
                d = await glpi.get_document(doc_id)
                filename = (d.get("filename") or d.get("filepath") or d.get("name") or None)
                if not doc_name:
                    doc_name = _dropdown_str(d.get("name") or d.get("completename") or "").strip()
            except Exception:
                pass

        items.append(
            {
                "id": rid,
                "document_id": doc_id,
                "name": doc_name or None,
                "filename": str(filename) if filename else None,
            }
        )

    return {"items": items, "total": len(items)}


@router.get("/api/glpi/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: int,
    category: str = Query("computador"),
    _user=Depends(_require_glpi_tickets_access),
) -> Dict[str, Any]:
    """Detalhe do ticket (somente categoria esperada)."""
    glpi = GlpiClient()
    try:
        t = await glpi.get_ticket(int(ticket_id))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar GLPI: {e}")

    if not t:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")

    wanted_cat = _norm(category)
    cat_raw = t.get("itilcategories_id")
    cat_name = _norm(_dropdown_str(cat_raw))
    if wanted_cat and cat_name and wanted_cat not in cat_name:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")

    status = t.get("status")
    content = t.get("content") or t.get("description") or ""
    content = html.unescape(str(content or "").strip())

    title = t.get("name") or t.get("title") or t.get("subject") or ""
    title = html.unescape(str(title or "").strip())

    # Usuários atribuídos (atores)
    assigned_primary = _dropdown_str(t.get("users_id_assign"))
    try:
        assigned_actor_names = await glpi.get_ticket_assigned_user_names(int(ticket_id))
    except Exception:
        assigned_actor_names = []

    assigned_names: List[str] = []
    seen: set[str] = set()
    if assigned_primary:
        k = assigned_primary.strip().lower()
        if k:
            seen.add(k)
            assigned_names.append(assigned_primary.strip())
    for n in assigned_actor_names:
        n = (n or "").strip()
        if not n:
            continue
        k = n.lower()
        if k in seen:
            continue
        seen.add(k)
        assigned_names.append(n)

    return {
        "id": int(t.get("id") or ticket_id),
        "title": title,
        "status": int(status) if str(status).isdigit() else status,
        "status_label": _status_label(status),
        "category": _dropdown_str(cat_raw),
        "content": content,
        "requester": _dropdown_str(t.get("users_id_recipient")),
        "assigned_to": ", ".join(assigned_names) if assigned_names else "",
        "created_at": t.get("date_creation") or t.get("date"),
        "updated_at": t.get("date_mod") or t.get("date"),
        "priority": t.get("priority"),
        "urgency": t.get("urgency"),
        "impact": t.get("impact"),
        "raw": {
            "entities_id": t.get("entities_id"),
            "locations_id": t.get("locations_id"),
        },
    }


@router.post("/api/glpi/tickets/{ticket_id}/assign-to-me")
async def assign_ticket_to_me(
    ticket_id: int,
    category: str = Query("computador"),
    user: Dict[str, Any] = Depends(_require_glpi_tickets_access),
) -> Dict[str, Any]:
    """Atribui o ticket ao usuário logado (via lookup no GLPI)."""
    if user.get("auth_disabled"):
        raise HTTPException(status_code=403, detail="Atribuição indisponível com AUTH_ENABLED=false")

    username = str(user.get("sub") or "").strip()
    email = str(user.get("email") or "").strip() or None
    if not username:
        raise HTTPException(status_code=401, detail="Não autenticado")

    glpi = GlpiClient()

    # Valida categoria do ticket antes de tentar atribuir.
    try:
        t = await glpi.get_ticket(int(ticket_id))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar GLPI: {e}")

    if not t:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")

    wanted_cat = _norm(category)
    cat_raw = t.get("itilcategories_id")
    cat_name = _norm(_dropdown_str(cat_raw))
    if wanted_cat and cat_name and wanted_cat not in cat_name:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")

    # Resolve user id no GLPI.
    try:
        glpi_user_id = await glpi.find_user_id(username=username, email=email)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao localizar usuário no GLPI: {e}")

    if not glpi_user_id:
        raise HTTPException(status_code=404, detail=f"Usuário '{username}' não encontrado no GLPI")

    ok, msg = await glpi.assign_ticket_to_user(ticket_id=int(ticket_id), user_id=int(glpi_user_id))
    if not ok:
        raise HTTPException(status_code=502, detail=msg)

    # Confirmação best-effort: re-busca o ticket para ver quem ficou como técnico principal.
    assigned_to = None
    try:
        t2 = await glpi.get_ticket(int(ticket_id))
        assigned_to = _dropdown_str(t2.get("users_id_assign"))
    except Exception:
        assigned_to = None

    return {
        "ok": True,
        "message": msg,
        "ticket_id": int(ticket_id),
        "glpi_user_id": int(glpi_user_id),
        "assigned_to": assigned_to,
    }
