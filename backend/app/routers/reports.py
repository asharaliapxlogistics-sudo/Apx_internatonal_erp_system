"""Management reports. Admins only, since they show company finances.

Dates are office calendar dates (YYYY-MM-DD). Invoices belong to their billing month; payments and
expenses to their own date; shipments to the day their AWB was booked.
"""

import datetime as dt
import math
from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import AdminUser, DbSession
from app.models import Awb, Customer, Expense, Invoice
from app.schemas.common import office_day_bounds_utc, office_now, utc_to_office
from app.schemas.invoice import totals_of
from app.services.balances import customer_balances
from app.services.tracking import group_of, timeline

router = APIRouter(prefix="/api/reports", tags=["reports"])

GROUP_LABELS = {"booked": "Booked", "transit": "In transit", "customs": "Customs hold", "delivered": "Delivered", "exception": "Exceptions"}
AGE_BUCKETS = [(30, "0–30 days"), (60, "31–60 days"), (90, "61–90 days"), (None, "Over 90 days")]


def _range(date_from: dt.date | None, date_to: dt.date | None) -> tuple[dt.date, dt.date]:
    """Defaults to the current month; rejects a reversed range."""
    today = office_now().date()
    start = date_from or today.replace(day=1)
    end = date_to or today
    if start > end:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The start date is after the end date.")
    return start, end


def _months(start: dt.date, end: dt.date) -> list[str]:
    months, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return months


def _money(v) -> float:
    return round(float(v or 0), 2)


def _ranked(groups: dict[str, dict], key: str) -> list[dict]:
    return sorted(({"name": k, **v} for k, v in groups.items()), key=lambda r: (-r[key], r["name"]))


def chargeable_weight(awb: Awb) -> float:
    """Larger of actual and volumetric weight (L×W×H / 5000 per piece, rounded up), as on the AWB."""
    volumetric = sum(
        math.ceil(float(p.length) * float(p.width) * float(p.height) / 5000)
        for p in awb.pieces
        if p.length and p.width and p.height
    )
    return max(float(awb.actual_weight), volumetric)


@router.get("/shipments")
def shipments_report(
    _: AdminUser,
    db: DbSession,
    date_from: dt.date | None = Query(None, alias="from"),
    date_to: dt.date | None = Query(None, alias="to"),
    customer_id: str | None = Query(None, alias="customerId"),
):
    start, end = _range(date_from, date_to)
    stmt = (
        select(Awb)
        .where(Awb.status != "Void")
        .where(Awb.created_at >= office_day_bounds_utc(start)[0], Awb.created_at <= office_day_bounds_utc(end)[1])
        .options(selectinload(Awb.pieces), selectinload(Awb.events))
        .order_by(Awb.created_at)
    )
    if customer_id:
        stmt = stmt.where(Awb.customer_id == customer_id)
    awbs = db.scalars(stmt).all()
    names = dict(db.execute(select(Customer.id, Customer.name)).all())

    zero = lambda: {"shipments": 0, "pieces": 0, "weight": 0.0}  # noqa: E731
    by_service, by_country, by_customer = defaultdict(zero), defaultdict(zero), defaultdict(zero)
    by_status = defaultdict(int)
    rows = []
    for a in awbs:
        weight = chargeable_weight(a)
        last = timeline(a)[-1]
        customer = names.get(a.customer_id, "No account (walk-in)")
        for bucket, key in ((by_service, a.service), (by_country, a.consignee_country), (by_customer, customer)):
            bucket[key]["shipments"] += 1
            bucket[key]["pieces"] += len(a.pieces)
            bucket[key]["weight"] += weight
        by_status[group_of(last["status"])] += 1
        rows.append({
            "number": a.number,
            "date": utc_to_office(a.created_at).date().isoformat(),
            "customer": customer,
            "shipper": a.shipper_name,
            "consignee": a.consignee_name,
            "country": a.consignee_country,
            "service": a.service,
            "pieces": len(a.pieces),
            "chargeableWeight": weight,
            "status": last["status"],
        })

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "totals": {
            "shipments": len(awbs),
            "pieces": sum(r["pieces"] for r in rows),
            "actualWeight": sum(float(a.actual_weight) for a in awbs),
            "chargeableWeight": sum(r["chargeableWeight"] for r in rows),
            "declaredValue": _money(sum((a.declared_value or 0) for a in awbs)),
        },
        "byService": _ranked(by_service, "shipments"),
        "byCountry": _ranked(by_country, "shipments"),
        "byCustomer": _ranked(by_customer, "shipments"),
        "byStatus": [{"name": label, "shipments": by_status[g]} for g, label in GROUP_LABELS.items()],
        "rows": rows,
    }


def _invoices(db: DbSession, customer_id: str | None = None) -> list[Invoice]:
    stmt = select(Invoice).options(selectinload(Invoice.lines), selectinload(Invoice.payments))
    if customer_id:
        stmt = stmt.where(Invoice.customer_id == customer_id)
    return db.scalars(stmt).all()


@router.get("/sales")
def sales_report(
    _: AdminUser,
    db: DbSession,
    date_from: dt.date | None = Query(None, alias="from"),
    date_to: dt.date | None = Query(None, alias="to"),
    customer_id: str | None = Query(None, alias="customerId"),
):
    """Invoiced = invoices for billing months in the range; collected = payments dated in the range."""
    start, end = _range(date_from, date_to)
    months = _months(start, end)
    invoices = _invoices(db, customer_id)
    in_range = sorted((i for i in invoices if months[0] <= i.month <= months[-1]), key=lambda i: i.seq)
    payments = [(i, p) for i in invoices for p in i.payments if start <= p.date <= end]

    by_month = {m: {"invoiced": 0.0, "collected": 0.0} for m in months}
    by_customer = defaultdict(lambda: {"invoiced": 0.0, "collected": 0.0, "balance": 0.0})
    by_method = defaultdict(float)
    for inv in in_range:
        total = totals_of(inv).total
        by_month[inv.month]["invoiced"] += total
        by_customer[inv.customer_name]["invoiced"] += total
    for inv, p in payments:
        by_month[p.date.strftime("%Y-%m")]["collected"] += float(p.amount)
        by_customer[inv.customer_name]["collected"] += float(p.amount)
        by_method[p.method] += float(p.amount)
    balances = customer_balances(invoices)
    for inv, t in balances.values():
        if inv.customer_name in by_customer:
            by_customer[inv.customer_name]["balance"] = max(0.0, t.outstanding)

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "totals": {
            "invoices": len(in_range),
            "invoiced": _money(sum(r["invoiced"] for r in by_month.values())),
            "collected": _money(sum(float(p.amount) for _, p in payments)),
            "balanceNow": _money(sum(max(0.0, t.outstanding) for _, t in balances.values())),
        },
        "byMonth": [{"month": m, **{k: _money(v) for k, v in by_month[m].items()}} for m in months],
        "byCustomer": [{**r, **{k: _money(r[k]) for k in ("invoiced", "collected", "balance")}} for r in _ranked(by_customer, "invoiced")],
        "byMethod": [{"name": k, "amount": _money(v)} for k, v in sorted(by_method.items(), key=lambda kv: -kv[1])],
        "rows": [
            {
                "id": i.id,
                "number": i.number,
                "customer": i.customer_name,
                "accountNo": i.account_no,
                "month": i.month,
                "total": (t := totals_of(i)).total,
                "paid": t.paid,
                "outstanding": t.outstanding,
                "status": t.status,
            }
            for i in in_range
        ],
    }


@router.get("/balances")
def balances_report(_: AdminUser, db: DbSession, customer_id: str | None = Query(None, alias="customerId")):
    """What each customer owes now (their latest invoice's outstanding), and how old it is."""
    today = office_now().date()
    invoices = _invoices(db, customer_id)
    last_payment: dict[str, dt.date] = {}
    for inv in invoices:
        for p in inv.payments:
            if inv.customer_id not in last_payment or p.date > last_payment[inv.customer_id]:
                last_payment[inv.customer_id] = p.date

    rows = []
    for cid, (inv, t) in customer_balances(invoices).items():
        if t.outstanding <= 0:
            continue
        days = (today - utc_to_office(inv.created_at).date()).days
        bucket = next(label for limit, label in AGE_BUCKETS if limit is None or days <= limit)
        rows.append({
            "customerId": cid,
            "customer": inv.customer_name,
            "accountNo": inv.account_no,
            "invoiceId": inv.id,
            "invoice": inv.number,
            "month": inv.month,
            "issued": utc_to_office(inv.created_at).date().isoformat(),
            "days": days,
            "age": bucket,
            "balance": t.outstanding,
            "lastPayment": last_payment[cid].isoformat() if cid in last_payment else None,
        })
    rows.sort(key=lambda r: -r["balance"])
    return {
        "asOf": today.isoformat(),
        "totals": {"customers": len(rows), "balance": _money(sum(r["balance"] for r in rows))},
        "byAge": [
            {"name": label, "customers": sum(1 for r in rows if r["age"] == label), "balance": _money(sum(r["balance"] for r in rows if r["age"] == label))}
            for _, label in AGE_BUCKETS
        ],
        "rows": rows,
    }


@router.get("/expenses")
def expenses_report(
    _: AdminUser,
    db: DbSession,
    date_from: dt.date | None = Query(None, alias="from"),
    date_to: dt.date | None = Query(None, alias="to"),
):
    start, end = _range(date_from, date_to)
    expenses = db.scalars(
        select(Expense).where(Expense.date >= start, Expense.date <= end).order_by(Expense.date, Expense.seq)
    ).all()
    by_category, by_method = defaultdict(float), defaultdict(float)
    by_month = {m: 0.0 for m in _months(start, end)}
    for e in expenses:
        by_category[e.category] += float(e.amount)
        by_method[e.method] += float(e.amount)
        by_month[e.date.strftime("%Y-%m")] += float(e.amount)
    amount_rows = lambda d: [{"name": k, "amount": _money(v)} for k, v in sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))]  # noqa: E731
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "totals": {"entries": len(expenses), "amount": _money(sum(float(e.amount) for e in expenses))},
        "byCategory": amount_rows(by_category),
        "byMethod": amount_rows(by_method),
        "byMonth": [{"month": m, "amount": _money(v)} for m, v in by_month.items()],
        "rows": [
            {"id": e.id, "number": e.number, "date": e.date.isoformat(), "category": e.category,
             "description": e.description, "paidTo": e.paid_to, "method": e.method, "amount": _money(e.amount)}
            for e in expenses
        ],
    }


@router.get("/profit-loss")
def profit_loss_report(
    _: AdminUser,
    db: DbSession,
    date_from: dt.date | None = Query(None, alias="from"),
    date_to: dt.date | None = Query(None, alias="to"),
):
    """Per month: revenue (invoiced shipments, excluding carried balances) minus expenses = profit.
    Collected minus expenses shows the cash actually left."""
    start, end = _range(date_from, date_to)
    months = _months(start, end)
    first_day, last_day = dt.date.fromisoformat(f"{months[0]}-01"), end
    table = {m: {"revenue": Decimal(0), "collected": Decimal(0), "expenses": Decimal(0)} for m in months}

    for inv in _invoices(db):
        if inv.month in table:
            table[inv.month]["revenue"] += sum((l.amount for l in inv.lines), Decimal(0))
        for p in inv.payments:
            if start <= p.date <= end:
                table[p.date.strftime("%Y-%m")]["collected"] += p.amount
    for e in db.scalars(select(Expense).where(Expense.date >= max(first_day, start), Expense.date <= last_day)):
        table[e.date.strftime("%Y-%m")]["expenses"] += e.amount

    rows = [
        {
            "month": m,
            "revenue": _money(v["revenue"]),
            "expenses": _money(v["expenses"]),
            "profit": _money(v["revenue"] - v["expenses"]),
            "collected": _money(v["collected"]),
            "cash": _money(v["collected"] - v["expenses"]),
        }
        for m, v in table.items()
    ]
    totals = {k: _money(sum(r[k] for r in rows)) for k in ("revenue", "expenses", "profit", "collected", "cash")}
    return {"from": start.isoformat(), "to": end.isoformat(), "totals": totals, "rows": rows}
