from sqlalchemy import BigInteger, cast, func, select
from sqlalchemy.orm import Session

from app.models import Awb, Complaint, Customer, Expense, Invoice, Setting

# Each series has a row in `settings` holding its first number. Locking that row
# (SELECT ... FOR UPDATE) makes two simultaneous saves take turns, so they never get the same number.
SERIES = {
    "customer": ("customer_first_account", Customer.account_seq),
    "awb": ("awb_first_number", cast(Awb.number, BigInteger)),
    "invoice": ("invoice_first_number", Invoice.seq),
    "expense": ("expense_first_number", Expense.seq),
    "complaint": ("complaint_first_number", Complaint.seq),
}


def next_number(db: Session, series: str) -> int:
    """Next number in a series. Call inside the transaction that saves the record."""
    key, column = SERIES[series]
    setting = db.scalar(select(Setting).where(Setting.key == key).with_for_update())
    first = int(setting.value) if setting else 1
    last = db.scalar(select(func.max(column)))
    return max(int(last or 0), first - 1) + 1


def account_no(seq: int) -> str:
    return f"APX-{seq}"


def invoice_no(seq: int) -> str:
    return f"INV-{seq:05d}"


def expense_no(seq: int) -> str:
    return f"EXP-{seq:05d}"


def complaint_no(seq: int) -> str:
    return f"CMP-{seq:05d}"
