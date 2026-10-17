import datetime as dt
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User
from app.models.audit import AuditLog


def _plain(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    return v


def snapshot(obj, fields) -> dict:
    """Current values of some fields, for diffing before and after a change."""
    return {f: _plain(getattr(obj, f)) for f in fields}


def changes(before: dict, after: dict) -> dict:
    """{field: [old, new]} for the fields that changed."""
    return {k: [before.get(k), after.get(k)] for k in after if before.get(k) != after.get(k)}


def last_logins(db: Session, user_ids: list[str]) -> dict:
    """Most recent successful sign-in per user, from the audit log."""
    if not user_ids:
        return {}
    rows = db.execute(
        select(AuditLog.user_id, func.max(AuditLog.at))
        .where(AuditLog.action == "auth.login", AuditLog.user_id.in_(user_ids))
        .group_by(AuditLog.user_id)
    ).all()
    return dict(rows)


def record(
    db: Session,
    user: User | None,
    action: str,
    entity: str,
    entity_id: str,
    summary: str,
    details: dict | None = None,
    ip: str = "",
) -> None:
    """Adds an audit entry to the session; it is saved by the caller's commit, together with the change."""
    db.add(
        AuditLog(
            user_id=user.id if user else None,
            user_name=user.name if user else "",
            action=action,
            entity=entity,
            entity_id=str(entity_id),
            summary=summary[:255],
            details=details or None,
            ip=ip,
        )
    )
