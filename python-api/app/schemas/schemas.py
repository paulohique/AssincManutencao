from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class ComputerBase(BaseModel):
    name: str
    entity: Optional[str] = None
    patrimonio: Optional[str] = None
    serial: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None


class ComputerCreate(ComputerBase):
    glpi_id: int
    glpi_data: Optional[Dict[str, Any]] = None


class ComputerOut(BaseModel):
    id: int
    glpi_id: int
    name: str
    entity: Optional[str]
    patrimonio: Optional[str]
    serial: Optional[str]
    location: Optional[str]
    status: Optional[str]
    last_maintenance: Optional[datetime]
    next_maintenance: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ComponentBase(BaseModel):
    component_type: str
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    capacity: Optional[str] = None


class ComponentOut(ComponentBase):
    id: int
    computer_id: int
    component_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class MaintenanceCreate(BaseModel):
    computer_id: int
    maintenance_type: str = Field(..., pattern="^(Preventiva|Corretiva)$")
    glpi_ticket_id: int = Field(..., ge=1)
    description: str = Field(..., min_length=1)
    performed_at: datetime
    technician: Optional[str] = None
    next_due_days: Optional[int] = None

    @field_validator("description")
    @classmethod
    def _description_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Descrição é obrigatória")
        return v


class MaintenanceUpdate(BaseModel):
    maintenance_type: Optional[str] = Field(None, pattern="^(Preventiva|Corretiva)$")
    description: Optional[str] = None
    performed_at: Optional[datetime] = None
    technician: Optional[str] = None
    next_due_days: Optional[int] = None

    @field_validator("description")
    @classmethod
    def _description_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Descrição é obrigatória")
        return v


class MaintenanceOut(BaseModel):
    id: int
    computer_id: int
    maintenance_type: str
    glpi_ticket_id: Optional[int] = None
    description: str
    performed_at: datetime
    technician: Optional[str]
    next_due: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class MaintenanceAuditOut(BaseModel):
    id: int
    maintenance_id: int
    action: Optional[str] = None
    computer_id: Optional[int] = None
    edited_at: datetime
    edited_by_username: str
    edited_by_display_name: Optional[str] = None
    edited_by_role: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    snapshot: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class MaintenanceAuditRowOut(MaintenanceAuditOut):
    computer_name: Optional[str] = None


class MaintenanceAuditListResponse(BaseModel):
    items: list[MaintenanceAuditRowOut]
    total: int
    page: int
    page_size: int


class NoteCreate(BaseModel):
    content: str
    author: str = "Sistema"


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    author: Optional[str] = None


class NoteOut(BaseModel):
    id: int
    computer_id: int
    author: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeviceRow(BaseModel):
    id: int
    glpi_id: int
    name: str
    maintenance_status: str
    last_maintenance: Optional[str]
    next_maintenance: Optional[str]


class DevicesPage(BaseModel):
    items: List[DeviceRow]
    page: int
    page_size: int
    total: int


class DeviceDetail(BaseModel):
    id: int
    glpi_id: int
    name: str
    serial: Optional[str]
    location: Optional[str]
    entity: Optional[str]
    patrimonio: Optional[str]
    status: Optional[str]
    last_maintenance: Optional[datetime]
    next_maintenance: Optional[datetime]

    class Config:
        from_attributes = True


class SyncResult(BaseModel):
    computers_synced: int
    components_synced: int
    message: str


class SyncStatus(BaseModel):
    running: bool
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    computers_synced: int = 0
    components_synced: int = 0
    current_glpi_id: Optional[int] = None
    message: Optional[str] = None
    last_error: Optional[str] = None


class GlpiPushComputersRequest(BaseModel):
    computer_ids: List[int]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    groups: List[str] = []
    role: str = "user"
    permissions: Dict[str, bool] = {}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserAdminRow(BaseModel):
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    permissions: Dict[str, bool]


class UserAccessUpdate(BaseModel):
    role: str = Field(..., pattern="^(admin|auditor|user|tecnico)$")
    add_note: bool = False
    add_maintenance: bool = False
    generate_report: bool = False
    manage_permissions: bool = False
    access_glpi_tickets: bool = False


# Dashboard
class DashboardMetrics(BaseModel):
    total_computers: int
    preventive_done_computers: int
    preventive_needed_computers: int
    corrective_done_total: int
    corrective_done_computers: int
    status_ok_computers: int
    status_late_computers: int
    status_pending_computers: int
    corrective_open_computers: int
