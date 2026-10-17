"""Complaints: a customer raises one from the portal (usually about a shipment), then customer and
APX staff talk in its message thread. Staff move it through Open -> In progress -> Resolved."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, PortalUser, StaffUser
from app.models import Awb, Complaint, ComplaintMessage, Customer, User
from app.models.mixins import utcnow
from app.schemas.common import CamelModel, UtcDateTime
from app.services.audit import record
from app.services.numbers import complaint_no, next_number

portal = APIRouter(prefix="/api/portal/complaints", tags=["customer portal"])
staff = APIRouter(prefix="/api/complaints", tags=["complaints"])

Status = Literal["Open", "In progress", "Resolved"]


class MessageIn(CamelModel):
    body: str = Field(max_length=2000)

    @field_validator("body")
    @classmethod
    def body_set(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Write a message.")
        return v


class ComplaintIn(MessageIn):
    awb_number: str = Field(default="", max_length=20)
    subject: str = Field(max_length=150)

    @field_validator("subject")
    @classmethod
    def subject_set(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("Write a subject.")
        return v


class StatusIn(CamelModel):
    status: Status


class MessageOut(CamelModel):
    id: str
    body: str
    from_staff: bool
    author_name: str
    created_at: UtcDateTime


class ComplaintSummary(CamelModel):
    id: str
    number: str
    awb_number: str
    subject: str
    status: str
    created_at: UtcDateTime
    last_message_at: UtcDateTime
    last_from_staff: bool
    message_count: int


class ComplaintOut(ComplaintSummary):
    messages: list[MessageOut]


class StaffComplaintSummary(ComplaintSummary):
    customer_id: str
    customer_name: str
    account_no: str


class StaffComplaintOut(ComplaintOut):
    customer_id: str
    customer_name: str
    account_no: str


def _summary(c: Complaint) -> dict:
    return dict(
        id=c.id, number=c.number, awb_number=c.awb_number, subject=c.subject, status=c.status, created_at=c.created_at,
        last_message_at=c.last_message_at, last_from_staff=c.last_from_staff, message_count=len(c.messages),
    )


def _messages(c: Complaint) -> list[MessageOut]:
    return [MessageOut.model_validate(m) for m in c.messages]


def _add_message(c: Complaint, user: User, body: str, from_staff: bool) -> None:
    c.messages.append(ComplaintMessage(body=body, from_staff=from_staff, author_id=user.id, author_name=user.name))
    c.last_message_at = utcnow()
    c.last_from_staff = from_staff


_LOAD = [selectinload(Complaint.messages)]


# ---- Customer portal ----


def _own(db: DbSession, user, complaint_id: str) -> Complaint:
    c = db.get(Complaint, complaint_id, options=_LOAD)
    if not c or c.customer_id != user.customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found.")
    return c


@portal.get("", response_model=list[ComplaintSummary])
def my_complaints(user: PortalUser, db: DbSession):
    stmt = select(Complaint).where(Complaint.customer_id == user.customer_id).options(*_LOAD).order_by(Complaint.last_message_at.desc())
    return [ComplaintSummary(**_summary(c)) for c in db.scalars(stmt)]


@portal.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
def raise_complaint(body: ComplaintIn, user: PortalUser, db: DbSession):
    awb_number = body.awb_number.strip()
    if awb_number:
        awb = db.get(Awb, awb_number)
        if not awb or awb.customer_id != user.customer_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"AWB {awb_number} is not one of your shipments.")
    seq = next_number(db, "complaint")
    c = Complaint(seq=seq, number=complaint_no(seq), customer_id=user.customer_id, awb_number=awb_number,
                  subject=body.subject, created_by=user.id, messages=[])
    _add_message(c, user, body.body, from_staff=False)
    db.add(c)
    customer = db.get(Customer, user.customer_id)
    about = f" about AWB {awb_number}" if awb_number else ""
    record(db, user, "complaint.create", "complaint", c.number, f"{customer.name} raised {c.number}{about}: {c.subject}")
    db.commit()
    return ComplaintOut(**_summary(c), messages=_messages(c))


@portal.get("/{complaint_id}", response_model=ComplaintOut)
def my_complaint(complaint_id: str, user: PortalUser, db: DbSession):
    c = _own(db, user, complaint_id)
    return ComplaintOut(**_summary(c), messages=_messages(c))


@portal.post("/{complaint_id}/messages", response_model=ComplaintOut)
def customer_reply(complaint_id: str, body: MessageIn, user: PortalUser, db: DbSession):
    c = _own(db, user, complaint_id)
    _add_message(c, user, body.body, from_staff=False)
    if c.status == "Resolved":
        c.status = "Open"  # the customer is not satisfied yet
    db.commit()
    return ComplaintOut(**_summary(c), messages=_messages(c))


# ---- Admin portal ----


def _staff_out(db: DbSession, c: Complaint) -> StaffComplaintOut:
    customer = db.get(Customer, c.customer_id)
    return StaffComplaintOut(**_summary(c), messages=_messages(c), customer_id=c.customer_id,
                             customer_name=customer.name, account_no=customer.account_no)


def _get(db: DbSession, complaint_id: str) -> Complaint:
    c = db.get(Complaint, complaint_id, options=_LOAD)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found.")
    return c


@staff.get("", response_model=list[StaffComplaintSummary])
def list_complaints(
    _: StaffUser,
    db: DbSession,
    status_filter: Status | None = Query(None, alias="status"),
    customer_id: str | None = Query(None, alias="customerId"),
):
    stmt = (
        select(Complaint, Customer.name, Customer.account_no)
        .join(Customer, Customer.id == Complaint.customer_id)
        .options(*_LOAD)
        .order_by(Complaint.last_message_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Complaint.status == status_filter)
    if customer_id:
        stmt = stmt.where(Complaint.customer_id == customer_id)
    return [
        StaffComplaintSummary(**_summary(c), customer_id=c.customer_id, customer_name=name, account_no=account_no)
        for c, name, account_no in db.execute(stmt)
    ]


@staff.get("/{complaint_id}", response_model=StaffComplaintOut)
def get_complaint(complaint_id: str, _: StaffUser, db: DbSession):
    return _staff_out(db, _get(db, complaint_id))


@staff.post("/{complaint_id}/messages", response_model=StaffComplaintOut)
def staff_reply(complaint_id: str, body: MessageIn, user: StaffUser, db: DbSession):
    c = _get(db, complaint_id)
    _add_message(c, user, body.body, from_staff=True)
    if c.status == "Open":
        c.status = "In progress"
    record(db, user, "complaint.reply", "complaint", c.number, f"Replied to {c.number}")
    db.commit()
    return _staff_out(db, c)


@staff.put("/{complaint_id}/status", response_model=StaffComplaintOut)
def set_status(complaint_id: str, body: StatusIn, user: StaffUser, db: DbSession):
    c = _get(db, complaint_id)
    if body.status != c.status:
        record(db, user, "complaint.status", "complaint", c.number, f"{c.number}: {c.status} -> {body.status}")
        c.status = body.status
        db.commit()
    return _staff_out(db, c)
