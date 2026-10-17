from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import Timestamps, UUIDPk


class Address(UUIDPk, Timestamps, Base):
    """A consignee saved in a customer's portal address book."""

    __tablename__ = "addresses"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(190))
    company: Mapped[str] = mapped_column(String(190), default="")
    address: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(80))
    zip: Mapped[str] = mapped_column(String(20), default="")
    country: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(40))
    email: Mapped[str] = mapped_column(String(190), default="")
