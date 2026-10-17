from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, StaffUser
from app.models import Awb, AwbItem, AwbPiece, Customer
from app.models.mixins import utcnow
from app.schemas.awb import AwbIn, AwbOut, Customs, VoidIn, awb_out, party_columns
from app.services.audit import record
from app.services.numbers import next_number

router = APIRouter(prefix="/api/awbs", tags=["air waybills"])


def item_rows(customs: Customs) -> list[AwbItem]:
    return [
        AwbItem(position=n, description=i.description, hs_code=i.hs_code, unit=i.unit, quantity=i.quantity, unit_price=i.unit_price)
        for n, i in enumerate(customs.items)
    ]


def get_or_404(db: DbSession, number: str) -> Awb:
    awb = db.get(Awb, number, options=[selectinload(Awb.pieces)])
    if not awb:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"AWB {number} not found.")
    return awb


@router.get("", response_model=list[AwbOut])
def list_awbs(_: StaffUser, db: DbSession, q: str = "", customer_id: str | None = Query(None, alias="customerId")):
    stmt = select(Awb).options(selectinload(Awb.pieces)).order_by(Awb.created_at.desc())
    if customer_id:
        stmt = stmt.where(Awb.customer_id == customer_id)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Awb.number.like(like), Awb.shipper_name.like(like), Awb.consignee_name.like(like),
                Awb.consignee_country.like(like), Awb.service.like(like))
        )
    return [awb_out(a) for a in db.scalars(stmt)]


@router.get("/{number}", response_model=AwbOut)
def get_awb(number: str, _: StaffUser, db: DbSession):
    return awb_out(get_or_404(db, number))


@router.post("", response_model=AwbOut, status_code=status.HTTP_201_CREATED)
def create_awb(body: AwbIn, user: StaffUser, db: DbSession):
    if body.customer_id and not db.get(Customer, body.customer_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Customer account not found.")
    awb = Awb(
        number=str(next_number(db, "awb")),
        customer_id=body.customer_id or None,
        account_no=body.account_no.strip(),
        service=body.service.strip(),
        bag_number=body.bag_number.strip(),
        shipper_reference=body.shipper_reference.strip(),
        actual_weight=body.actual_weight,
        # With item lines, the declared value is their total, so the AWB and the customs invoice agree.
        declared_value=body.total() if body.items else body.declared_value,
        invoice_type=body.invoice_type,
        items=item_rows(body),
        product_detail=body.product_detail.strip(),
        comments=body.comments.strip(),
        fragile=body.fragile,
        **party_columns("shipper", body.shipper),
        **party_columns("consignee", body.consignee),
        pieces=[AwbPiece(position=i, length=p.length, width=p.width, height=p.height) for i, p in enumerate(body.pieces)],
        created_by=user.id,
    )
    db.add(awb)
    record(db, user, "awb.create", "awb", awb.number,
           f"Created AWB {awb.number}: {awb.shipper_name} to {awb.consignee_name}, {awb.consignee_country} ({awb.service})")
    db.commit()
    return awb_out(awb)


@router.put("/{number}/customs", response_model=AwbOut)
def set_customs(number: str, body: Customs, user: StaffUser, db: DbSession):
    """Replaces the customs invoice type and items (AWBs are otherwise not edited after saving)."""
    awb = get_or_404(db, number)
    awb.invoice_type = body.invoice_type
    awb.items = item_rows(body)
    if body.items:
        awb.declared_value = body.total()
    record(db, user, "awb.customs", "awb", number,
           f"Customs invoice for AWB {number}: {body.invoice_type}, {len(body.items)} items, USD {awb.declared_value or 0}")
    db.commit()
    return awb_out(awb)


@router.post("/{number}/void", response_model=AwbOut)
def void_awb(number: str, body: VoidIn, user: StaffUser, db: DbSession):
    awb = get_or_404(db, number)
    if awb.status == "Void":
        raise HTTPException(status.HTTP_409_CONFLICT, f"AWB {number} is already void.")
    awb.status = "Void"
    awb.void_reason = body.reason.strip()
    awb.voided_at = utcnow()
    record(db, user, "awb.void", "awb", number, f"Voided AWB {number}: {awb.void_reason}")
    db.commit()
    return awb_out(awb)


@router.post("/{number}/restore", response_model=AwbOut)
def restore_awb(number: str, user: StaffUser, db: DbSession):
    """Undo a void: the AWB becomes Active again and shows up as a shipment."""
    awb = get_or_404(db, number)
    if awb.status != "Void":
        raise HTTPException(status.HTTP_409_CONFLICT, f"AWB {number} is not void.")
    reason = awb.void_reason
    awb.status = "Active"
    awb.void_reason = ""
    awb.voided_at = None
    record(db, user, "awb.restore", "awb", number, f"Removed void from AWB {number} (was: {reason})")
    db.commit()
    return awb_out(awb)


@router.delete("/{number}", status_code=status.HTTP_204_NO_CONTENT)
def delete_awb(number: str, user: StaffUser, db: DbSession):
    awb = get_or_404(db, number)
    record(db, user, "awb.delete", "awb", number, f"Deleted AWB {number} ({awb.shipper_name} to {awb.consignee_name})")
    # Pieces and tracking history go with it (ON DELETE CASCADE).
    db.delete(awb)
    db.commit()
