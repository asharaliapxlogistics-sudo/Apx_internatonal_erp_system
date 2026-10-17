from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.deps import AdminUser, DbSession
from app.models import Customer, User
from app.schemas.auth import PasswordReset, UserCreate, UserOut, UserUpdate
from app.security import hash_password
from app.services.audit import changes, last_logins, record, snapshot

# Staff and customer-portal accounts. Admins only.
router = APIRouter(prefix="/api/users", tags=["users"])


def _get(db: DbSession, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    return user


def _active_admins(db: DbSession) -> int:
    return db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.is_active.is_(True)))


@router.get("", response_model=list[UserOut])
def list_users(_: AdminUser, db: DbSession, customer_id: str | None = Query(None, alias="customerId")):
    """All logins, or one customer's portal logins with `customerId`."""
    stmt = select(User).order_by(User.name)
    if customer_id:
        stmt = stmt.where(User.customer_id == customer_id, User.role == "customer")
    users = db.scalars(stmt).all()
    seen = last_logins(db, [u.id for u in users])
    return [UserOut.model_validate(u).model_copy(update={"last_login": seen.get(u.id)}) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, admin: AdminUser, db: DbSession):
    email = body.email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists.")
    if body.role == "customer" and not (body.customer_id and db.get(Customer, body.customer_id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A customer login must be linked to a customer account.")
    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role=body.role,
        customer_id=body.customer_id if body.role == "customer" else None,
    )
    db.add(user)
    db.flush()
    record(db, admin, "user.create", "user", user.id, f"Added {user.name} ({user.email}) as {user.role}")
    db.commit()
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UserUpdate, admin: AdminUser, db: DbSession):
    user = _get(db, user_id)
    losing_admin = user.role == "admin" and user.is_active and (
        (body.role and body.role != "admin") or body.is_active is False
    )
    if losing_admin and _active_admins(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one active admin must remain.")
    if user.id == admin.id and body.is_active is False:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot disable your own account.")
    # A customer login can never become staff (it would see every customer), and staff never become customers.
    if body.role and (body.role == "customer") != (user.role == "customer"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A staff account and a customer login cannot be switched into each other.")
    before = snapshot(user, ("name", "role", "is_active"))
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    diff = changes(before, snapshot(user, before))
    if diff:
        if "is_active" in diff:
            summary = f"{'Enabled' if user.is_active else 'Disabled'} {user.name}"
        elif "role" in diff:
            summary = f"Made {user.name} {user.role}"
        else:
            summary = f"Updated {user.name}"
        record(db, admin, "user.update", "user", user.id, summary, {"changes": diff})
    db.commit()
    return user


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(user_id: str, body: PasswordReset, admin: AdminUser, db: DbSession):
    user = _get(db, user_id)
    user.password_hash = hash_password(body.new_password)
    record(db, admin, "user.reset_password", "user", user.id, f"Reset the password of {user.name}")
    db.commit()
