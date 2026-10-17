from decimal import Decimal
from typing import Annotated

from pydantic import Field, PlainSerializer, model_validator

from app.schemas.common import CamelModel, Dimension, Money, UtcDateTime, Weight
from app.schemas.validators import NtnOrCnic, OptionalEmail, is_pakistan, letters, phone_for, pk_postal


class Party(CamelModel):
    name: str = Field(min_length=1, max_length=190)
    company: str = Field(default="", max_length=190)
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=80)
    zip: str = Field(default="", max_length=20)
    country: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=1, max_length=40)
    email: str = Field(default="", max_length=190)
    ntn_cnic: str = Field(default="", max_length=30)  # shipper only


class PartyIn(Party):
    """Shipper or consignee as typed on the AWB form. Pakistani parties need a Pakistani phone
    number and a 5-digit postal code; others need a full international number."""

    name: letters("Name") = Field(min_length=1, max_length=190)
    city: letters("City") = Field(min_length=1, max_length=80)
    email: OptionalEmail = Field(default="", max_length=190)
    ntn_cnic: NtnOrCnic = Field(default="", max_length=30)

    @model_validator(mode="after")
    def check(self):
        self.phone = phone_for(self.country, self.phone)
        if is_pakistan(self.country):
            self.zip = pk_postal(self.zip)
        return self


class Piece(CamelModel):
    length: Dimension | None = None  # cm
    width: Dimension | None = None
    height: Dimension | None = None


INVOICE_TYPES = ("Gift", "Commercial")

Quantity = Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2), PlainSerializer(float, return_type=float)]


class Item(CamelModel):
    """One customs invoice line (prices in USD)."""

    description: str = Field(min_length=1, max_length=190)
    hs_code: str = Field(default="", max_length=20)
    unit: str = Field(default="Piece(s)", max_length=20)
    quantity: Quantity
    unit_price: Money


class Customs(CamelModel):
    invoice_type: str = "Gift"
    items: list[Item] = Field(default=[], max_length=50)

    @model_validator(mode="after")
    def check_customs(self):
        if self.invoice_type not in INVOICE_TYPES:
            raise ValueError(f"Invoice type must be one of: {', '.join(INVOICE_TYPES)}")
        for i in self.items:
            i.description, i.hs_code, i.unit = i.description.strip(), i.hs_code.strip(), i.unit.strip() or "Piece(s)"
        return self

    def total(self) -> Decimal:
        return sum((i.quantity * i.unit_price for i in self.items), Decimal(0)).quantize(Decimal("0.01"))


class AwbBase(Customs):
    customer_id: str | None = None
    account_no: str = Field(default="", max_length=20)
    service: str = Field(min_length=1, max_length=60)
    bag_number: str = Field(default="", max_length=30)
    shipper_reference: str = Field(default="", max_length=60)
    actual_weight: Weight
    declared_value: Money | None = None  # USD
    product_detail: str = Field(min_length=1, max_length=255)
    comments: str = Field(default="", max_length=255)
    fragile: bool = False
    shipper: Party
    consignee: Party
    pieces: list[Piece] = Field(min_length=1, max_length=200)


class AwbIn(AwbBase):
    shipper: PartyIn
    consignee: PartyIn

    @model_validator(mode="after")
    def check(self):
        if self.actual_weight <= 0:
            raise ValueError("Enter the actual weight in kg (more than 0).")
        if self.actual_weight > 5000:
            raise ValueError("Actual weight looks too high. Check the kg value.")
        for i, p in enumerate(self.pieces, start=1):
            dims = [p.length, p.width, p.height]
            if any(d is not None for d in dims) and not all(d and d > 0 for d in dims):
                raise ValueError(f"Piece {i}: enter length, width and height (all more than 0), or leave all three empty.")
        return self


class AwbOut(AwbBase):
    number: str
    status: str  # Active / Void
    void_reason: str
    voided_at: UtcDateTime | None
    carrier: str
    carrier_tracking: str
    created_at: UtcDateTime


class VoidIn(CamelModel):
    reason: str = Field(min_length=1, max_length=255)


PARTY_FIELDS = ("name", "company", "address", "city", "zip", "country", "phone", "email")


def awb_out(awb) -> AwbOut:
    """Database row (flat shipper_*/consignee_* columns) -> API shape with nested parties."""

    def party(prefix: str) -> Party:
        data = {f: getattr(awb, f"{prefix}_{f}") for f in PARTY_FIELDS}
        data["ntn_cnic"] = awb.shipper_ntn_cnic if prefix == "shipper" else ""
        return Party(**data)

    return AwbOut(
        number=awb.number,
        customer_id=awb.customer_id,
        account_no=awb.account_no,
        service=awb.service,
        bag_number=awb.bag_number,
        shipper_reference=awb.shipper_reference,
        actual_weight=awb.actual_weight,
        declared_value=awb.declared_value,
        product_detail=awb.product_detail,
        comments=awb.comments,
        fragile=awb.fragile,
        shipper=party("shipper"),
        consignee=party("consignee"),
        pieces=[Piece(length=p.length, width=p.width, height=p.height) for p in awb.pieces],
        status=awb.status,
        void_reason=awb.void_reason,
        voided_at=awb.voided_at,
        carrier=awb.carrier,
        carrier_tracking=awb.carrier_tracking,
        created_at=awb.created_at,
        invoice_type=awb.invoice_type,
        items=[
            Item(description=i.description, hs_code=i.hs_code, unit=i.unit, quantity=i.quantity, unit_price=i.unit_price)
            for i in awb.items
        ],
    )


def party_columns(prefix: str, party: Party) -> dict:
    cols = {f"{prefix}_{f}": getattr(party, f).strip() for f in PARTY_FIELDS}
    if prefix == "shipper":
        cols["shipper_ntn_cnic"] = party.ntn_cnic.strip()
    return cols

