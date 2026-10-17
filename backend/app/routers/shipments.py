from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, StaffUser
from app.models import Awb, TrackingEvent
from app.schemas.awb import awb_out
from app.schemas.common import utc_to_office
from app.schemas.tracking import CarrierIn, EventIn, EventOut, ShipmentOut
from app.services.audit import changes, record
from app.services.tracking import group_of, timeline

# Every non-void AWB is a shipment.
router = APIRouter(prefix="/api/shipments", tags=["shipments"])


def shipment_out(awb: Awb) -> ShipmentOut:
    events = [EventOut(**e) for e in timeline(awb)]
    last = events[-1]
    return ShipmentOut(
        awb=awb_out(awb),
        carrier=awb.carrier,
        carrier_tracking=awb.carrier_tracking,
        events=events,
        last=last,
        status=last.status,
        group=group_of(last.status),
    )


def _load(db: DbSession, number: str) -> Awb:
    awb = db.get(Awb, number, options=[selectinload(Awb.pieces), selectinload(Awb.events)])
    if not awb or awb.status == "Void":
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Shipment {number} not found or void.")
    return awb


@router.get("", response_model=list[ShipmentOut])
def list_shipments(_: StaffUser, db: DbSession, customer_id: str | None = Query(None, alias="customerId")):
    stmt = (
        select(Awb)
        .where(Awb.status != "Void")
        .options(selectinload(Awb.pieces), selectinload(Awb.events))
        .order_by(Awb.created_at.desc())
    )
    if customer_id:
        stmt = stmt.where(Awb.customer_id == customer_id)
    return [shipment_out(a) for a in db.scalars(stmt)]


@router.get("/{number}", response_model=ShipmentOut)
def get_shipment(number: str, _: StaffUser, db: DbSession):
    return shipment_out(_load(db, number))


@router.post("/events", response_model=list[str])
def add_event(body: EventIn, user: StaffUser, db: DbSession):
    """Adds the same update to every AWB listed. All or nothing: unknown or void numbers reject the whole batch."""
    booked = dict(db.execute(select(Awb.number, Awb.created_at).where(Awb.number.in_(body.numbers), Awb.status != "Void")).all())
    missing = [n for n in body.numbers if n not in booked]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Not found or void: {', '.join(missing)}")
    # An update dated before booking would sort under "Booked" and silently leave the status unchanged.
    too_early = [n for n in body.numbers if body.at < utc_to_office(booked[n]).replace(second=0, microsecond=0)]
    if too_early:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"The date and time is before these AWBs were booked: {', '.join(too_early)}. Check the date.",
        )
    for number in body.numbers:
        db.add(
            TrackingEvent(
                awb_number=number,
                status=body.status,
                at=body.at,
                location=body.location.strip(),
                remarks=body.remarks.strip(),
                created_by=user.id,
                created_by_name=user.name,
            )
        )
        where = f" at {body.location.strip()}" if body.location.strip() else ""
        record(db, user, "shipment.status", "awb", number, f"{number}: {body.status}{where}", {"at": body.at.isoformat(), "remarks": body.remarks.strip()})
    db.commit()
    return body.numbers


@router.delete("/{number}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(number: str, event_id: str, user: StaffUser, db: DbSession):
    event = db.get(TrackingEvent, event_id)
    if not event or event.awb_number != number:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Update not found.")
    record(db, user, "shipment.status_delete", "awb", number, f"{number}: removed the \"{event.status}\" update", {"at": event.at.isoformat()})
    db.delete(event)
    db.commit()


@router.put("/{number}/carrier", response_model=ShipmentOut)
def set_carrier(number: str, body: CarrierIn, user: StaffUser, db: DbSession):
    awb = _load(db, number)
    before = {"carrier": awb.carrier, "carrier_tracking": awb.carrier_tracking}
    awb.carrier = body.carrier.strip()
    awb.carrier_tracking = body.carrier_tracking.strip()
    diff = changes(before, {"carrier": awb.carrier, "carrier_tracking": awb.carrier_tracking})
    if diff:
        record(db, user, "shipment.carrier", "awb", number, f"{number}: carrier {awb.carrier} {awb.carrier_tracking}".strip(), {"changes": diff})
    db.commit()
    return shipment_out(awb)
