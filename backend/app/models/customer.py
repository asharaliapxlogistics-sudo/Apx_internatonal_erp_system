from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import Timestamps, UUIDPk

CUSTOMER_TYPES = ("Corporate", "E-commerce", "Walk-in")


class Customer(UUIDPk, Timestamps, Base):
    __tablename__ = "customers"

    account_seq: Mapped[int] = mapped_column(Integer, unique=True)
    account_no: Mapped[str] = mapped_column(String(20), unique=True)  # APX-1001
    type: Mapped[str] = mapped_column(String(20), default="Corporate")
    name: Mapped[str] = mapped_column(String(190), index=True)
    contact_person: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(190), default="")
    address: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(80), default="")
    zip: Mapped[str] = mapped_column(String(20), default="")
    country: Mapped[str] = mapped_column(String(80), default="Pakistan")
    ntn: Mapped[str] = mapped_column(String(30), default="")
    strn: Mapped[str] = mapped_column(String(30), default="")
    cnic: Mapped[str] = mapped_column(String(20), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
