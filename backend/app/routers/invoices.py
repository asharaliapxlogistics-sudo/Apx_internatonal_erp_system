from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, StaffUser
from app.models import Customer, Invoice, InvoiceLine, Payment
from app.schemas.common import office_now
from app.schemas.invoice import InvoiceIn, InvoiceOut, PaymentIn, StatusIn, invoice_out, totals_of
from app.services.audit import record
from app.services.numbers import invoice_no, next_number

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

_LOAD = [selectinload(Invoice.lines), selectinload(Invoice.payments)]


def get_or_404(db: DbSession, invoice_id: str) -> Invoice:
    inv = db.get(Invoice, invoice_id, options=_LOAD)
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found.")
    return inv


@router.get("", response_model=list[InvoiceOut])
def list_invoices(
    _: StaffUser,
    db: DbSession,
    customer_id: str | None = Query(None, alias="customerId"),
    month: str | None = None,
):
    stmt = select(Invoice).options(*_LOAD).order_by(Invoice.seq.desc())
    if customer_id:
        stmt = stmt.where(Invoice.customer_id == customer_id)
    if month:
        stmt = stmt.where(Invoice.month == month)
    return [invoice_out(i) for i in db.scalars(stmt)]


@router.get("/last-outstanding")
def last_outstanding(_: StaffUser, db: DbSession, customer_id: str = Query(alias="customerId")) -> float:
    """Outstanding of the customer's latest invoice: the next invoice's previous balance."""
    latest = db.scalar(select(Invoice).options(*_LOAD).where(Invoice.customer_id == customer_id).order_by(Invoice.seq.desc()))
    return totals_of(latest).outstanding if latest else 0.0


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: str, _: StaffUser, db: DbSession):
    return invoice_out(get_or_404(db, invoice_id))


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(body: InvoiceIn, user: StaffUser, db: DbSession):
    customer = db.get(Customer, body.customer_id)
    if not customer:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Customer account not found.")
    seq = next_number(db, "invoice")
    inv = Invoice(
        seq=seq,
        number=invoice_no(seq),
        customer_id=customer.id,
        customer_name=customer.name,
        account_no=customer.account_no,
        month=body.month,
        prev_balance=body.prev_balance,
        received=body.received,
        prepared_by=body.prepared_by.strip() or user.name,
        lines=[InvoiceLine(position=i, **l.model_dump()) for i, l in enumerate(body.lines)],
    )
    db.add(inv)
    db.flush()
    total = sum(l.amount for l in body.lines)
    record(db, user, "invoice.create", "invoice", inv.id, f"Issued {inv.number} to {customer.name} for {body.month}: Rs {total:,.2f}")
    db.commit()
    return invoice_out(get_or_404(db, inv.id))


@router.post("/{invoice_id}/payments", response_model=InvoiceOut)
def add_payment(invoice_id: str, body: PaymentIn, user: StaffUser, db: DbSession):
    inv = get_or_404(db, invoice_id)
    inv.payments.append(Payment(**body.model_dump()))
    record(db, user, "invoice.payment", "invoice", inv.id, f"Payment Rs {body.amount:,.2f} ({body.method}) on {inv.number}", {"date": body.date.isoformat(), "reference": body.reference})
    db.commit()
    return invoice_out(get_or_404(db, invoice_id))


@router.post("/{invoice_id}/status", response_model=InvoiceOut)
def set_status(invoice_id: str, body: StatusIn, user: StaffUser, db: DbSession):
    """Paid = pay the full outstanding, Unpaid = remove all payments, Partial = record the given amount."""
    inv = get_or_404(db, invoice_id)
    today = office_now().date()
    outstanding = Decimal(str(totals_of(inv).outstanding))
    if body.status == "Unpaid":
        inv.payments.clear()
    elif body.status == "Paid" and outstanding > 0:
        inv.payments.append(Payment(date=today, amount=outstanding, method="Cash", reference="Marked as paid"))
    elif body.status == "Partial":
        if not body.amount:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter the amount received.")
        inv.payments.append(Payment(date=today, amount=body.amount, method="Cash", reference="Partial payment"))
    extra = f" (Rs {body.amount:,.2f})" if body.status == "Partial" else ""
    record(db, user, "invoice.status", "invoice", inv.id, f"Marked {inv.number} as {body.status}{extra}")
    db.commit()
    return invoice_out(get_or_404(db, invoice_id))


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(invoice_id: str, user: StaffUser, db: DbSession):
    inv = get_or_404(db, invoice_id)
    record(db, user, "invoice.delete", "invoice", inv.id, f"Deleted {inv.number} ({inv.customer_name}, {inv.month})")
    db.delete(inv)
    db.commit()
