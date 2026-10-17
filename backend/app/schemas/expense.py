import datetime as dt

from pydantic import Field

from app.schemas.common import CamelModel, Money, UtcDateTime


class ExpenseIn(CamelModel):
    date: dt.date
    category: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=255)
    amount: Money = Field(gt=0)  # PKR
    method: str = Field(default="Cash", max_length=30)
    paid_to: str = Field(default="", max_length=120)


class ExpenseOut(ExpenseIn):
    id: str
    seq: int
    number: str  # EXP-00001 voucher
    prepared_by: str
    created_at: UtcDateTime
    updated_at: UtcDateTime | None
