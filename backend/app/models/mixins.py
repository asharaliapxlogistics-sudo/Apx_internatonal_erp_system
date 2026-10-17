import uuid
from datetime import UTC, datetime

from sqlalchemy import CHAR, DateTime
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    # MySQL DATETIME has no time zone, so every timestamp is stored as naive UTC.
    return datetime.now(UTC).replace(tzinfo=None)


# Record timestamps keep microseconds, so entries saved in the same second still sort in order.
Timestamp = DateTime().with_variant(DATETIME(fsp=6), "mysql")


def new_id() -> str:
    return str(uuid.uuid4())


class UUIDPk:
    # Same UUID ids the frontend already uses, so browser data can be imported as-is.
    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_id)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(Timestamp, onupdate=utcnow)
