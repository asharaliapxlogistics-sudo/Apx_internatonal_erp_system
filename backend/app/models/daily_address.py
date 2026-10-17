import datetime as dt

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import Timestamps, UUIDPk


class DailyAddress(UUIDPk, Timestamps, Base):
    """One address line a customer sends from the portal for that day's shipments.
    The office sees them on the admin "Customer Addresses" page."""

    __tablename__ = "daily_addresses"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    day: Mapped[dt.date] = mapped_column(Date, index=True)  # office calendar day
    address: Mapped[str] = mapped_column(String(500))
    sent_by: Mapped[str] = mapped_column(String(120), default="")
