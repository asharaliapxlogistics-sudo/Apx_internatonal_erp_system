from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import Timestamp, Timestamps, UUIDPk, utcnow


class Awb(Timestamps, Base):
    """Airway bill. Every non-void AWB is also a shipment that gets tracked."""

    __tablename__ = "awbs"

    number: Mapped[str] = mapped_column(String(20), primary_key=True)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    account_no: Mapped[str] = mapped_column(String(20), default="")
    service: Mapped[str] = mapped_column(String(60))
    bag_number: Mapped[str] = mapped_column(String(30), default="")
    shipper_reference: Mapped[str] = mapped_column(String(60), default="")
    actual_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    declared_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))  # USD
    product_detail: Mapped[str] = mapped_column(String(255), default="")
    comments: Mapped[str] = mapped_column(String(255), default="")
    fragile: Mapped[bool] = mapped_column(Boolean, default=False)

    shipper_name: Mapped[str] = mapped_column(String(190))
    shipper_company: Mapped[str] = mapped_column(String(190), default="")
    shipper_address: Mapped[str] = mapped_column(String(255))
    shipper_city: Mapped[str] = mapped_column(String(80))
    shipper_zip: Mapped[str] = mapped_column(String(20), default="")
    shipper_country: Mapped[str] = mapped_column(String(80))
    shipper_phone: Mapped[str] = mapped_column(String(40))
    shipper_email: Mapped[str] = mapped_column(String(190), default="")
    shipper_ntn_cnic: Mapped[str] = mapped_column(String(30), default="")

    consignee_name: Mapped[str] = mapped_column(String(190), index=True)
    consignee_company: Mapped[str] = mapped_column(String(190), default="")
    consignee_address: Mapped[str] = mapped_column(String(255))
    consignee_city: Mapped[str] = mapped_column(String(80))
    consignee_zip: Mapped[str] = mapped_column(String(20), default="")
    consignee_country: Mapped[str] = mapped_column(String(80))
    consignee_phone: Mapped[str] = mapped_column(String(40))
    consignee_email: Mapped[str] = mapped_column(String(190), default="")

    status: Mapped[str] = mapped_column(String(10), default="Active")  # Active / Void
    void_reason: Mapped[str] = mapped_column(String(255), default="")
    voided_at: Mapped[datetime | None] = mapped_column(DateTime)

    # The delivery partner's own tracking (e.g. DPD).
    carrier: Mapped[str] = mapped_column(String(40), default="")
    carrier_tracking: Mapped[str] = mapped_column(String(255), default="", index=True)

    # Customs invoice printed with the AWB: its heading (Gift / Commercial / ...) and item lines.
    invoice_type: Mapped[str] = mapped_column(String(20), default="Gift")

    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    pieces: Mapped[list["AwbPiece"]] = relationship(
        back_populates="awb", cascade="all, delete-orphan", order_by="AwbPiece.position"
    )
    items: Mapped[list["AwbItem"]] = relationship(
        back_populates="awb", cascade="all, delete-orphan", order_by="AwbItem.position", lazy="selectin"
    )
    events: Mapped[list["TrackingEvent"]] = relationship(
        back_populates="awb", cascade="all, delete-orphan", order_by="(TrackingEvent.at, TrackingEvent.created_at)"
    )


class AwbPiece(Base):
    __tablename__ = "awb_pieces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    awb_number: Mapped[str] = mapped_column(ForeignKey("awbs.number", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    length: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))  # cm
    width: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    height: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))

    awb: Mapped[Awb] = relationship(back_populates="pieces")


class AwbItem(Base):
    """One line of the customs invoice: what is inside, its HS code and value (USD)."""

    __tablename__ = "awb_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    awb_number: Mapped[str] = mapped_column(ForeignKey("awbs.number", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(190))
    hs_code: Mapped[str] = mapped_column(String(20), default="")
    unit: Mapped[str] = mapped_column(String(20), default="Piece(s)")
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # USD

    awb: Mapped[Awb] = relationship(back_populates="items")


class TrackingEvent(UUIDPk, Base):
    """A status update. "Booked" is not stored; it comes from the AWB's created_at."""

    __tablename__ = "tracking_events"

    awb_number: Mapped[str] = mapped_column(ForeignKey("awbs.number", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(30), index=True)
    at: Mapped[datetime] = mapped_column(DateTime)  # local time entered by staff
    location: Mapped[str] = mapped_column(String(120), default="")
    remarks: Mapped[str] = mapped_column(String(255), default="")
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by_name: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)

    awb: Mapped[Awb] = relationship(back_populates="events")
