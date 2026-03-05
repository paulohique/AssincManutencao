from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import AppSetting


def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        return None
    return str(row.value)


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = str(value)
        db.add(row)
        return
    row = AppSetting(key=str(key), value=str(value))
    db.add(row)


def get_int_setting(db: Session, key: str, default: int, *, min_value: int = 1, max_value: int = 365) -> int:
    raw = get_setting(db, key)
    if raw is None:
        return int(default)
    try:
        v = int(str(raw).strip())
    except Exception:
        return int(default)
    if v < min_value:
        return int(min_value)
    if v > max_value:
        return int(max_value)
    return int(v)


def get_bool_setting(db: Session, key: str, default: bool = False) -> bool:
    raw = get_setting(db, key)
    if raw is None:
        return bool(default)
    v = str(raw).strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "no", "n", "off"}:
        return False
    return bool(default)
