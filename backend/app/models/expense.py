import datetime as dt
from decimal import Decimal

from sqlalchemy import Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import Timestamps, UUIDPk


class Expense(UUIDPk, Timestamps, Base):
    __tablename__ = "expenses"

    seq: Mapped[int] = mapped_column(Integer, unique=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)  # EXP-00001
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(60), index=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # PKR
    method: Mapped[str] = mapped_column(String(30), default="Cash")
    paid_to: Mapped[str] = mapped_column(String(120), default="")
    prepared_by: Mapped[str] = mapped_column(String(120), default="")
