import datetime as dt

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.deps import DbSession, StaffUser
from app.models import Expense
from app.schemas.common import office_now
from app.schemas.expense import ExpenseIn, ExpenseOut
from app.services.audit import changes, record, snapshot
from app.services.numbers import expense_no, next_number

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def get_or_404(db: DbSession, expense_id: str) -> Expense:
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found.")
    return expense


def _clean(body: ExpenseIn) -> dict:
    # Money already spent: a voucher dated in the future is a typing mistake.
    if body.date > office_now().date():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The expense date cannot be in the future.")
    return {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items()}


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    _: StaffUser,
    db: DbSession,
    date_from: dt.date | None = Query(None, alias="from"),
    date_to: dt.date | None = Query(None, alias="to"),
    category: str | None = None,
):
    stmt = select(Expense).order_by(Expense.date.desc(), Expense.created_at.desc())
    if date_from:
        stmt = stmt.where(Expense.date >= date_from)
    if date_to:
        stmt = stmt.where(Expense.date <= date_to)
    if category:
        stmt = stmt.where(Expense.category == category)
    return db.scalars(stmt).all()


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: str, _: StaffUser, db: DbSession):
    return get_or_404(db, expense_id)


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(body: ExpenseIn, user: StaffUser, db: DbSession):
    seq = next_number(db, "expense")
    expense = Expense(**_clean(body), seq=seq, number=expense_no(seq), prepared_by=user.name)
    db.add(expense)
    db.flush()
    record(db, user, "expense.create", "expense", expense.id, f"Added {expense.number}: {expense.category} Rs {expense.amount:,.2f}")
    db.commit()
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: str, body: ExpenseIn, user: StaffUser, db: DbSession):
    expense = get_or_404(db, expense_id)
    data = _clean(body)
    before = snapshot(expense, data)
    for field, value in data.items():
        setattr(expense, field, value)
    diff = changes(before, snapshot(expense, data))
    if diff:
        record(db, user, "expense.update", "expense", expense.id, f"Edited {expense.number}", {"changes": diff})
    db.commit()
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: str, user: StaffUser, db: DbSession):
    expense = get_or_404(db, expense_id)
    record(db, user, "expense.delete", "expense", expense.id, f"Deleted {expense.number}: {expense.category} Rs {expense.amount:,.2f}")
    db.delete(expense)
    db.commit()
