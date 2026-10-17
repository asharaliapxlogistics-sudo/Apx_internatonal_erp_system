import datetime as dt
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import Timestamp, Timestamps, UUIDPk, utcnow


class Invoice(UUIDPk, Timestamps, Base):
    __tablename__ = "invoices"

    seq: Mapped[int] = mapped_column(Integer, unique=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)  # INV-00001
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), index=True)
    # Copied at issue time so the invoice keeps showing what was printed.
    customer_name: Mapped[str] = mapped_column(String(190))
    account_no: Mapped[str] = mapped_column(String(20))
    month: Mapped[str] = mapped_column(CHAR(7), index=True)  # YYYY-MM
    prev_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    received: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)  # received before issuing
    prepared_by: Mapped[str] = mapped_column(String(120), default="")

    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceLine.position"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="(Payment.date, Payment.created_at)"
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    date: Mapped[dt.date | None] = mapped_column(Date)
    tracking: Mapped[str] = mapped_column(String(60), default="")
    nature: Mapped[str] = mapped_column(String(10), default="WPX")  # WPX parcel / DOX documents
    service: Mapped[str] = mapped_column(String(60), default="")
    country: Mapped[str] = mapped_column(String(80), default="")
    consignee: Mapped[str] = mapped_column(String(190), default="")
    weight: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    invoice: Mapped[Invoice] = relationship(back_populates="lines")


class Payment(UUIDPk, Base):
    __tablename__ = "payments"

    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    date: Mapped[dt.date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[str] = mapped_column(String(30))
    reference: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)

    invoice: Mapped[Invoice] = relationship(back_populates="payments")
