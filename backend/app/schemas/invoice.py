import re
import datetime as dt
from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel, Money, UtcDateTime, Weight

PaymentMethod = Literal["Cash", "Bank transfer", "Cheque"]


class LineIn(CamelModel):
    date: dt.date | None = None
    tracking: str = Field(default="", max_length=60)
    nature: Literal["WPX", "DOX"] = "WPX"  # WPX parcel / DOX documents
    service: str = Field(default="", max_length=60)
    country: str = Field(default="", max_length=80)
    consignee: str = Field(default="", max_length=190)
    weight: Weight | None = None
    amount: Money


class InvoiceIn(CamelModel):
    customer_id: str
    month: str  # YYYY-MM
    lines: list[LineIn] = Field(min_length=1, max_length=1000)
    prev_balance: Decimal = Field(default=Decimal(0), max_digits=12, decimal_places=2)  # can be negative (credit)
    received: Money = Decimal(0)
    prepared_by: str = Field(default="", max_length=120)

    @field_validator("month")
    @classmethod
    def check_month(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", v):
            raise ValueError("Month must look like 2026-10.")
        return v


class PaymentIn(CamelModel):
    date: dt.date
    amount: Money = Field(gt=0)
    method: PaymentMethod = "Bank transfer"
    reference: str = Field(default="", max_length=120)


class PaymentOut(PaymentIn):
    id: str


class StatusIn(CamelModel):
    """Manual status change from the invoice list (see set_status)."""

    status: Literal["Paid", "Unpaid", "Partial"]
    amount: Money | None = None  # required for Partial


class Totals(CamelModel):
    total: float
    payable: float
    paid: float
    outstanding: float
    status: Literal["Paid", "Partial", "Unpaid"]


class InvoiceOut(CamelModel):
    id: str
    seq: int
    number: str
    customer_id: str
    customer_name: str
    account_no: str
    month: str
    lines: list[LineIn]
    prev_balance: float
    received: Money
    prepared_by: str
    payments: list[PaymentOut]
    totals: Totals
    created_at: UtcDateTime


def totals_of(inv) -> Totals:
    """total = sum of lines; payable = total + previous balance - received before issuing;
    outstanding = payable - payments recorded afterwards. Same as the frontend's invoiceTotals."""
    total = sum((l.amount for l in inv.lines), Decimal(0))
    payable = total + (inv.prev_balance or 0) - (inv.received or 0)
    paid = sum((p.amount for p in inv.payments), Decimal(0))
    outstanding = payable - paid
    status = "Paid" if outstanding <= 0 else "Partial" if paid > 0 else "Unpaid"
    return Totals(total=total, payable=payable, paid=paid, outstanding=outstanding, status=status)


def invoice_out(inv) -> InvoiceOut:
    return InvoiceOut(
        id=inv.id,
        seq=inv.seq,
        number=inv.number,
        customer_id=inv.customer_id,
        customer_name=inv.customer_name,
        account_no=inv.account_no,
        month=inv.month,
        lines=[LineIn.model_validate(l) for l in inv.lines],
        prev_balance=inv.prev_balance,
        received=inv.received,
        prepared_by=inv.prepared_by,
        payments=[PaymentOut.model_validate(p) for p in inv.payments],
        totals=totals_of(inv),
        created_at=inv.created_at,
    )
