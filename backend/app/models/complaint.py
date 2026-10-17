from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import Timestamp, Timestamps, UUIDPk, utcnow

COMPLAINT_STATUSES = ("Open", "In progress", "Resolved")


class Complaint(UUIDPk, Timestamps, Base):
    """A complaint a customer raises from the portal, usually about one shipment.
    Customer and APX staff talk in its message thread."""

    __tablename__ = "complaints"

    seq: Mapped[int] = mapped_column(Integer, unique=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)  # CMP-00001
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    awb_number: Mapped[str] = mapped_column(String(20), default="", index=True)  # empty = general complaint
    subject: Mapped[str] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(20), default="Open", index=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # Time of the latest message, for sorting and "new reply" hints.
    last_message_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow, index=True)
    last_from_staff: Mapped[bool] = mapped_column(Boolean, default=False)

    messages: Mapped[list["ComplaintMessage"]] = relationship(
        back_populates="complaint", cascade="all, delete-orphan", order_by="ComplaintMessage.created_at"
    )


class ComplaintMessage(UUIDPk, Base):
    __tablename__ = "complaint_messages"

    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    from_staff: Mapped[bool] = mapped_column(Boolean, default=False)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    author_name: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)

    complaint: Mapped[Complaint] = relationship(back_populates="messages")
