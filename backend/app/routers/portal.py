"""Customer portal API. Every endpoint here works only for customer logins (PortalUser)
and only returns the signed-in user's own company records."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, PortalUser
from app.models import Awb, Customer, Invoice, User
from app.routers.settings import COMPANY_FIELDS, _values
from app.schemas.common import CamelModel, LocalDateTime, UtcDateTime, utc_to_office
from app.schemas.invoice import InvoiceOut, invoice_out, totals_of
from app.services.audit import last_logins
from app.services.tracking import group_of, timeline

router = APIRouter(prefix="/api/portal", tags=["customer portal"])
# Public tracking (QR code on the AWB, links customers share): no sign-in.
public = APIRouter(prefix="/api/track", tags=["public tracking"])


class CompanyOut(CamelModel):
    name: str
    account_no: str
    type: str
    contact_person: str
    phone: str
    email: str
    address: str
    city: str
    zip: str
    country: str
    ntn: str


class TeamMember(CamelModel):
    id: str
    name: str
    email: str
    is_active: bool
    last_login: UtcDateTime | None


class PortalMe(CamelModel):
    user: TeamMember
    company: CompanyOut
    team: list[TeamMember]


@router.get("/me", response_model=PortalMe)
def portal_me(user: PortalUser, db: DbSession):
    company = db.get(Customer, user.customer_id)
    team = db.scalars(select(User).where(User.customer_id == user.customer_id, User.role == "customer").order_by(User.name)).all()
    seen = last_logins(db, [u.id for u in team])

    def member(u: User) -> TeamMember:
        return TeamMember(id=u.id, name=u.name, email=u.email, is_active=u.is_active, last_login=seen.get(u.id))

    return PortalMe(user=member(user), company=CompanyOut.model_validate(company), team=[member(u) for u in team])


class TrackEvent(CamelModel):
    status: str
    at: LocalDateTime
    location: str
    remarks: str


class PublicShipment(CamelModel):
    """What anyone with the AWB number may see: status and history, never addresses or prices."""

    number: str
    date: str  # booking day, office time (YYYY-MM-DD)
    city: str
    country: str
    service: str
    status: str
    group: str
    events: list[TrackEvent]  # oldest first


class PortalShipment(PublicShipment):
    consignee: str
    pieces: int
    weight: float
    contents: str
    reference: str


class PortalInvoice(CamelModel):
    id: str
    number: str
    month: str
    issued: str  # office date (YYYY-MM-DD)
    amount: float  # this month's charges
    prev_balance: float
    paid: float  # received before issuing + payments since
    balance: float  # still owed, including earlier months
    status: str


def _public(awb: Awb) -> dict:
    events = timeline(awb)
    last = events[-1]["status"]
    return dict(
        number=awb.number,
        date=utc_to_office(awb.created_at).date().isoformat(),
        city=awb.consignee_city,
        country=awb.consignee_country,
        service=awb.service,
        status=last,
        group=group_of(last),
        events=[TrackEvent(**e) for e in events],
    )


def _portal(awb: Awb) -> PortalShipment:
    return PortalShipment(
        **_public(awb),
        consignee=awb.consignee_name,
        pieces=len(awb.pieces),
        weight=awb.actual_weight,
        contents=awb.product_detail,
        reference=awb.shipper_reference,
    )


_SHIPMENT_LOAD = [selectinload(Awb.pieces), selectinload(Awb.events)]


@router.get("/shipments", response_model=list[PortalShipment])
def portal_shipments(user: PortalUser, db: DbSession):
    stmt = (
        select(Awb)
        .where(Awb.customer_id == user.customer_id, Awb.status != "Void")
        .options(*_SHIPMENT_LOAD)
        .order_by(Awb.created_at.desc())
    )
    return [_portal(a) for a in db.scalars(stmt)]


@router.get("/shipments/{number}", response_model=PortalShipment)
def portal_shipment(number: str, user: PortalUser, db: DbSession):
    awb = db.get(Awb, number, options=_SHIPMENT_LOAD)
    # Another company's AWB looks exactly like a missing one.
    if not awb or awb.status == "Void" or awb.customer_id != user.customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Shipment {number} not found.")
    return _portal(awb)


@router.get("/invoices", response_model=list[PortalInvoice])
def portal_invoices(user: PortalUser, db: DbSession):
    stmt = (
        select(Invoice)
        .where(Invoice.customer_id == user.customer_id)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .order_by(Invoice.seq.desc())
    )
    out = []
    for inv in db.scalars(stmt):
        t = totals_of(inv)
        out.append(PortalInvoice(
            id=inv.id,
            number=inv.number,
            month=inv.month,
            issued=utc_to_office(inv.created_at).date().isoformat(),
            amount=t.total,
            prev_balance=inv.prev_balance,
            paid=float(inv.received or 0) + t.paid,
            balance=t.outstanding,
            status=t.status,
        ))
    return out


@public.get("/{number}", response_model=PublicShipment)
def public_track(number: str, db: DbSession):
    awb = db.get(Awb, number.strip(), options=[selectinload(Awb.events)])
    if not awb or awb.status == "Void":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No shipment found with this number.")
    return PublicShipment(**_public(awb))


# Printing: the same invoice the APX office prints. (Customers cannot print airway bills.)


@router.get("/settings")
def portal_settings(_: PortalUser, db: DbSession):
    """Company letterhead and tracking page address, printed on invoices."""
    v = _values(db)
    return {"company": {f: v.get(f"company_{f}", "") for f in COMPANY_FIELDS}, "trackingUrl": v.get("tracking_url", "")}


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def portal_invoice(invoice_id: str, user: PortalUser, db: DbSession):
    inv = db.get(Invoice, invoice_id, options=[selectinload(Invoice.lines), selectinload(Invoice.payments)])
    if not inv or inv.customer_id != user.customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found.")
    return invoice_out(inv)
