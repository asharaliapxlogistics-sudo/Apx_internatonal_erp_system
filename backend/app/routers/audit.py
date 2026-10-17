import datetime as dt

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.deps import AdminUser, DbSession
from app.models.audit import AuditLog
from app.schemas.common import UtcDateTime, CamelModel, office_day_bounds_utc

router = APIRouter(prefix="/api/audit", tags=["audit log"])


class AuditOut(CamelModel):
    id: str
    at: UtcDateTime
    user_id: str | None
    user_name: str
    action: str
    entity: str
    entity_id: str
    summary: str
    details: dict | None
    ip: str


class AuditPage(CamelModel):
    total: int
    rows: list[AuditOut]


@router.get("", response_model=AuditPage)
def audit_log(
    _: AdminUser,
    db: DbSession,
    date_from: dt.date | None = Query(None, alias="from"),
    date_to: dt.date | None = Query(None, alias="to"),
    user_id: str | None = Query(None, alias="userId"),
    entity: str | None = None,
    q: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Newest first. `q` searches the summary and record id (e.g. an AWB or invoice number)."""
    filters = []
    if date_from:
        filters.append(AuditLog.at >= office_day_bounds_utc(date_from)[0])
    if date_to:
        filters.append(AuditLog.at <= office_day_bounds_utc(date_to)[1])
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if entity:
        filters.append(AuditLog.entity == entity)
    if q.strip():
        like = f"%{q.strip()}%"
        filters.append(or_(AuditLog.summary.like(like), AuditLog.entity_id.like(like), AuditLog.user_name.like(like)))

    total = db.scalar(select(func.count()).select_from(AuditLog).where(*filters))
    rows = db.scalars(select(AuditLog).where(*filters).order_by(AuditLog.at.desc()).limit(limit).offset(offset)).all()
    return AuditPage(total=total, rows=rows)
