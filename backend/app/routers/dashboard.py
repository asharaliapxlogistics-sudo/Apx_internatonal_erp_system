from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, StaffUser
from app.models import Awb, Complaint, Customer, Expense, Invoice
from app.schemas.common import office_day_bounds_utc, office_now
from app.schemas.invoice import totals_of
from app.services.balances import customer_balances, total_receivable
from app.services.tracking import group_of, timeline

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(_: StaffUser, db: DbSession, customer_id: str | None = Query(None, alias="customerId")):
    """Same figures as the frontend dashboard. "Today" and "this month" use the office time zone."""
    now = office_now()
    today = now.date()
    month = now.strftime("%Y-%m")
    day_start, day_end = office_day_bounds_utc(today)
    month_start = office_day_bounds_utc(today.replace(day=1))[0]

    awb_stmt = select(Awb).where(Awb.status != "Void").options(selectinload(Awb.events))
    inv_stmt = select(Invoice).options(selectinload(Invoice.lines), selectinload(Invoice.payments))
    complaint_stmt = select(func.count()).select_from(Complaint).where(Complaint.status != "Resolved")
    if customer_id:
        awb_stmt = awb_stmt.where(Awb.customer_id == customer_id)
        inv_stmt = inv_stmt.where(Invoice.customer_id == customer_id)
        complaint_stmt = complaint_stmt.where(Complaint.customer_id == customer_id)
    awbs = db.scalars(awb_stmt).all()
    invoices = db.scalars(inv_stmt).all()

    last_events = [timeline(a)[-1] for a in awbs]
    groups = [group_of(e["status"]) for e in last_events]
    totals = [totals_of(i) for i in invoices]

    expenses = Decimal(0)
    if not customer_id:  # company expenses are not per customer
        month_first = today.replace(day=1)
        expenses = db.scalar(select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.date >= month_first)) or 0

    return {
        "customers": {
            "total": db.scalar(select(func.count()).select_from(Customer)),
            "newThisMonth": db.scalar(select(func.count()).select_from(Customer).where(Customer.created_at >= month_start)),
        },
        "today": {
            "bookings": sum(1 for a in awbs if day_start <= a.created_at <= day_end),
            "inTransit": groups.count("transit"),
            "customsHold": groups.count("customs"),
            "delivered": sum(1 for e in last_events if e["status"] == "Delivered" and _is_day(e["at"], today)),
            "exceptions": groups.count("exception"),
        },
        "month": {
            "receivables": total_receivable(invoices),
            "revenue": sum(t.total for t, i in zip(totals, invoices) if i.month == month),
            "expenses": float(expenses),
        },
        "actions": {
            "missingDocs": 0,
            "weightCorrections": 0,
            # Customers whose latest invoice still has a balance.
            "unpaidInvoices": sum(1 for _, t in customer_balances(invoices).values() if t.outstanding > 0),
            # Complaints not yet resolved.
            "openComplaints": db.scalar(complaint_stmt),
        },
        "scoped": bool(customer_id),
    }


def _is_day(at: datetime, day) -> bool:
    return at.date() == day
