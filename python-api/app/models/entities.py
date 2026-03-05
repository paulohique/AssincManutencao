from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Computer(Base):
    __tablename__ = "computers"

    id = Column(Integer, primary_key=True, index=True)
    glpi_id = Column(Integer, unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    entity = Column(String(255))
    patrimonio = Column(String(100), index=True)
    serial = Column(String(255))
    location = Column(String(255))
    status = Column(String(50))
    last_maintenance = Column(DateTime, nullable=True)
    next_maintenance = Column(DateTime, nullable=True)
    glpi_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    components = relationship(
        "ComputerComponent",
        back_populates="computer",
        cascade="all, delete-orphan",
    )
    maintenance_history = relationship(
        "MaintenanceHistory",
        back_populates="computer",
        cascade="all, delete-orphan",
    )
    notes = relationship(
        "ComputerNote",
        back_populates="computer",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_computer_name_entity", "name", "entity"),)


class ComputerComponent(Base):
    __tablename__ = "computer_components"

    id = Column(Integer, primary_key=True, index=True)
    computer_id = Column(
        Integer,
        ForeignKey("computers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_type = Column(String(50), nullable=False)
    name = Column(String(255))
    manufacturer = Column(String(255))
    model = Column(String(255))
    serial = Column(String(255))
    capacity = Column(String(100))
    component_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    computer = relationship("Computer", back_populates="components")


class MaintenanceHistory(Base):
    __tablename__ = "maintenance_history"

    id = Column(Integer, primary_key=True, index=True)
    computer_id = Column(
        Integer,
        ForeignKey("computers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    maintenance_type = Column(String(20), nullable=False)
    glpi_ticket_id = Column(Integer, nullable=True, index=True)
    description = Column(Text)
    performed_at = Column(DateTime, nullable=False)
    technician = Column(String(255))
    next_due = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    computer = relationship("Computer", back_populates="maintenance_history")

    __table_args__ = (Index("idx_maintenance_type_date", "maintenance_type", "performed_at"),)


class MaintenanceHistoryAudit(Base):
    __tablename__ = "maintenance_history_audit"

    id = Column(Integer, primary_key=True, index=True)
    maintenance_id = Column(
        Integer,
        ForeignKey("maintenance_history.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(20), nullable=False, default="update", index=True)
    computer_id = Column(Integer, nullable=True, index=True)
    edited_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    edited_by_username = Column(String(255), nullable=False)
    edited_by_display_name = Column(String(255), nullable=True)
    edited_by_role = Column(String(32), nullable=True)
    changes = Column(JSON, nullable=True)
    snapshot = Column(JSON, nullable=True)

    __table_args__ = (Index("idx_maintenance_audit_mid_date", "maintenance_id", "edited_at"),)


class ComputerNote(Base):
    __tablename__ = "computer_notes"

    id = Column(Integer, primary_key=True, index=True)
    computer_id = Column(
        Integer,
        ForeignKey("computers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    computer = relationship("Computer", back_populates="notes")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=True)

    display_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    groups = Column(JSON, nullable=True)

    # Roles: admin | auditor | user
    role = Column(String(32), nullable=False, default="user", index=True)

    # Permission flags (admin pode tudo; os demais começam false)
    can_add_note = Column(Boolean, nullable=False, default=False)
    can_add_maintenance = Column(Boolean, nullable=False, default=False)
    can_generate_report = Column(Boolean, nullable=False, default=False)
    can_manage_permissions = Column(Boolean, nullable=False, default=False)
    can_access_glpi_tickets = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_users_role", "role"),
    )


class GlpiFollowupOutbox(Base):
    __tablename__ = "glpi_followup_outbox"

    id = Column(Integer, primary_key=True, index=True)
    maintenance_id = Column(Integer, ForeignKey("maintenance_history.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_id = Column(Integer, nullable=False, index=True)
    content = Column(Text, nullable=False)

    # pending | sent
    status = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_outbox_status_created", "status", "created_at"),
    )


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(128), unique=True, nullable=False, index=True)
    value = Column(String(255), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index("idx_app_settings_key", "key"),)
