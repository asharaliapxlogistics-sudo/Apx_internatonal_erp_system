from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func, select

from app.config import settings
from app.deps import CurrentUser, DbSession
from app.models import User
from app.schemas.auth import ChangePasswordIn, LoginIn, LoginOut, UserOut
from app.security import create_token, hash_password, login_limiter, verify_password
from app.services.audit import record

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, request: Request, db: DbSession):
    email = body.email.strip().lower()
    ip = request.client.host if request.client else ""
    key = f"{email}|{ip}"
    if login_limiter.is_locked(key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many wrong attempts. Try again in {settings.login_lock_minutes} minutes.",
        )

    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not verify_password(body.password, user.password_hash if user else None) or not user.is_active:
        login_limiter.fail(key)
        record(db, None, "auth.login_failed", "login", "", f"Failed sign-in for {email}", ip=ip)
        db.commit()
        # Same message whether the email or the password is wrong, so emails cannot be discovered.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")

    login_limiter.reset(key)
    record(db, user, "auth.login", "login", user.id, f"{user.name} signed in", ip=ip)
    db.commit()
    token, expires = create_token(user.id, body.remember)
    return LoginOut(token=token, expires_at=expires, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: ChangePasswordIn, user: CurrentUser, db: DbSession):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    record(db, user, "auth.password_change", "user", user.id, f"{user.name} changed their password")
    db.commit()
