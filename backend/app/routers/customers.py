from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from app.deps import DbSession, StaffUser
from app.models import Customer, Invoice
from app.schemas.customer import CustomerIn, CustomerOut
from app.services.audit import changes, record, snapshot
from app.services.numbers import account_no, next_number

router = APIRouter(prefix="/api/customers", tags=["customers"])


def get_or_404(db: DbSession, customer_id: str) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found.")
    return customer


def _clean(body: CustomerIn) -> dict:
    return {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items()}


@router.get("", response_model=list[CustomerOut])
def list_customers(_: StaffUser, db: DbSession, q: str = ""):
    stmt = select(Customer).order_by(Customer.account_seq)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Customer.name.like(like), Customer.account_no.like(like), Customer.phone.like(like), Customer.city.like(like))
        )
    return db.scalars(stmt).all()


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: str, _: StaffUser, db: DbSession):
    return get_or_404(db, customer_id)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(body: CustomerIn, user: StaffUser, db: DbSession):
    seq = next_number(db, "customer")
    customer = Customer(**_clean(body), account_seq=seq, account_no=account_no(seq))
    db.add(customer)
    db.flush()
    record(db, user, "customer.create", "customer", customer.id, f"Added customer {customer.account_no} {customer.name}")
    db.commit()
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: str, body: CustomerIn, user: StaffUser, db: DbSession):
    customer = get_or_404(db, customer_id)
    data = _clean(body)
    before = snapshot(customer, data)
    for field, value in data.items():
        setattr(customer, field, value)
    diff = changes(before, snapshot(customer, data))
    if diff:
        record(db, user, "customer.update", "customer", customer.id, f"Edited customer {customer.account_no} {customer.name}", {"changes": diff})
    db.commit()
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: str, user: StaffUser, db: DbSession):
    customer = get_or_404(db, customer_id)
    # Invoices are financial records, so a billed customer cannot be removed. Their AWBs stay, unlinked.
    if db.scalar(select(Invoice.id).where(Invoice.customer_id == customer_id).limit(1)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This customer has invoices, so it cannot be deleted.")
    record(db, user, "customer.delete", "customer", customer.id, f"Deleted customer {customer.account_no} {customer.name}")
    db.delete(customer)
    db.commit()
