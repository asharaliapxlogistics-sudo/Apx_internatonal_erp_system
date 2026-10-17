"""Today's addresses: customers send one address line per shipment for the day from the portal,
and the office sees them on the admin "Customer Addresses" page."""

import datetime as dt

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import Field, field_validator
from sqlalchemy import select

from app.deps import DbSession, PortalUser, StaffUser
from app.models import Customer, DailyAddress
from app.schemas.common import CamelModel, UtcDateTime, office_now
from app.services.audit import record

portal = APIRouter(prefix="/api/portal/daily-addresses", tags=["customer portal"])
staff = APIRouter(prefix="/api/daily-addresses", tags=["customer addresses"])


class DailyAddressIn(CamelModel):
    address: str = Field(max_length=500)

    @field_validator("address")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = " ".join(v.split())  # one line, single spaces
        if not v:
            raise ValueError("Enter the address.")
        return v


class DailyAddressesIn(CamelModel):
    addresses: list[DailyAddressIn] = Field(min_length=1, max_length=200)


class DailyAddressOut(DailyAddressIn):
    id: str
    day: dt.date
    sent_by: str
    created_at: UtcDateTime


class StaffDailyAddressOut(DailyAddressOut):
    customer_id: str
    customer_name: str
    account_no: str


def _today() -> dt.date:
    return office_now().date()


@portal.get("", response_model=list[DailyAddressOut])
def my_addresses(user: PortalUser, db: DbSession, day: dt.date | None = None):
    stmt = (
        select(DailyAddress)
        .where(DailyAddress.customer_id == user.customer_id, DailyAddress.day == (day or _today()))
        .order_by(DailyAddress.created_at)
    )
    return db.scalars(stmt).all()


@portal.post("", response_model=list[DailyAddressOut], status_code=status.HTTP_201_CREATED)
def send_addresses(body: DailyAddressesIn, user: PortalUser, db: DbSession):
    """Adds one or more addresses to today's list."""
    customer = db.get(Customer, user.customer_id)
    rows = [DailyAddress(customer_id=customer.id, day=_today(), sent_by=user.name, address=a.address) for a in body.addresses]
    db.add_all(rows)
    n = len(rows)
    record(db, user, "daily_address.add", "customer", customer.id,
           f"{customer.name} sent {n} {'address' if n == 1 else 'addresses'} for today")
    db.commit()
    return rows


def _own_today(db: DbSession, user, address_id: str) -> DailyAddress:
    a = db.get(DailyAddress, address_id)
    if not a or a.customer_id != user.customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found.")
    # Earlier days are what the office already worked from, so they stay as sent.
    if a.day != _today():
        raise HTTPException(status.HTTP_409_CONFLICT, "Only today's addresses can be changed.")
    return a


@portal.put("/{address_id}", response_model=DailyAddressOut)
def change_address(address_id: str, body: DailyAddressIn, user: PortalUser, db: DbSession):
    a = _own_today(db, user, address_id)
    a.address = body.address
    db.commit()
    return a


@portal.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_address(address_id: str, user: PortalUser, db: DbSession):
    db.delete(_own_today(db, user, address_id))
    db.commit()


@staff.get("", response_model=list[StaffDailyAddressOut])
def customer_addresses(
    _: StaffUser,
    db: DbSession,
    day: dt.date | None = None,
    customer_id: str | None = Query(None, alias="customerId"),
):
    stmt = (
        select(DailyAddress, Customer.name, Customer.account_no)
        .join(Customer, Customer.id == DailyAddress.customer_id)
        .where(DailyAddress.day == (day or _today()))
        .order_by(Customer.name, DailyAddress.created_at)
    )
    if customer_id:
        stmt = stmt.where(DailyAddress.customer_id == customer_id)
    return [
        StaffDailyAddressOut(
            **DailyAddressOut.model_validate(a).model_dump(),
            customer_id=a.customer_id,
            customer_name=name,
            account_no=account_no,
        )
        for a, name, account_no in db.execute(stmt)
    ]


@staff.delete("")
def clear_addresses(
    user: StaffUser,
    db: DbSession,
    day: dt.date,
    customer_id: str | None = Query(None, alias="customerId"),
):
    """Removes all addresses of one day (optionally one customer's), once the office has booked them."""
    stmt = select(DailyAddress).where(DailyAddress.day == day)
    if customer_id:
        stmt = stmt.where(DailyAddress.customer_id == customer_id)
    rows = db.scalars(stmt).all()
    for a in rows:
        db.delete(a)
    n = len(rows)
    if n:
        c = db.get(Customer, customer_id) if customer_id else None
        who = c.name if c else "all customers"
        record(db, user, "daily_address.clear", "customer", customer_id or "",
               f"Cleared {n} {'address' if n == 1 else 'addresses'} of {day.isoformat()} ({who})")
    db.commit()
    return {"removed": n}
