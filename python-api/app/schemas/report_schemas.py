from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class MaintenanceReportRow(BaseModel):
    computer_id: int
    computer_name: str
    computer_entity: Optional[str] = None
    patrimonio: Optional[str] = None
    serial: Optional[str] = None
    location: Optional[str] = None
    technician: Optional[str] = None
    maintenance_type: str = Field(..., pattern="^(Preventiva|Corretiva)$")
    glpi_ticket_id: Optional[int] = None
    description: Optional[str] = None
    performed_at: datetime


class MaintenanceReportTopTechnician(BaseModel):
    technician: str
    total: int


class MaintenanceReportSummary(BaseModel):
    total_records: int
    total_computers: int
    total_technicians: int
    totals_by_type: Dict[str, int]
    top_technicians: List[MaintenanceReportTopTechnician]


class MaintenanceReportResponse(BaseModel):
    items: List[MaintenanceReportRow]
    total: int
    page: int = 1
    page_size: int = 50
    summary: Optional[MaintenanceReportSummary] = None
