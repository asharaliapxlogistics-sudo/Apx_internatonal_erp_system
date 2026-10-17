from datetime import datetime

from sqlalchemy import JSON, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import Timestamp, UUIDPk, utcnow


class AuditLog(UUIDPk, Base):
    """Who did what, and when. Rows are only ever added."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_entity", "entity", "entity_id"),)

    at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    user_name: Mapped[str] = mapped_column(String(120), default="")  # kept if the user is later removed
    action: Mapped[str] = mapped_column(String(40), index=True)  # e.g. "awb.void"
    entity: Mapped[str] = mapped_column(String(30))  # customer, awb, invoice, expense, user, settings, login
    entity_id: Mapped[str] = mapped_column(String(64), default="")
    summary: Mapped[str] = mapped_column(String(255))
    details: Mapped[dict | None] = mapped_column(JSON)  # e.g. {"changes": {"phone": ["old", "new"]}}
    ip: Mapped[str] = mapped_column(String(45), default="")
