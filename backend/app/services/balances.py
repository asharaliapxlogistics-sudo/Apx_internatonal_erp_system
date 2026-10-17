from collections.abc import Iterable

from app.models import Invoice
from app.schemas.invoice import Totals, totals_of


def latest_per_customer(invoices: Iterable[Invoice]) -> dict[str, Invoice]:
    """Each customer's most recent invoice (highest number)."""
    latest: dict[str, Invoice] = {}
    for inv in invoices:
        if inv.customer_id not in latest or inv.seq > latest[inv.customer_id].seq:
            latest[inv.customer_id] = inv
    return latest


def customer_balances(invoices: Iterable[Invoice]) -> dict[str, tuple[Invoice, Totals]]:
    """What each customer owes now.

    A new invoice carries the previous outstanding forward as its "previous balance", so a customer's
    balance is the outstanding of their latest invoice. Adding up every invoice would count the same
    unpaid amount again on each later invoice.
    """
    return {cid: (inv, totals_of(inv)) for cid, inv in latest_per_customer(invoices).items()}


def total_receivable(invoices: Iterable[Invoice]) -> float:
    return sum(max(0.0, t.outstanding) for _, t in customer_balances(invoices).values())
