from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import read_token

DbSession = Annotated[Session, Depends(get_db)]
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """The logged-in user. The account is re-read on every request, so disabling it locks them out at once."""
    user_id = read_token(credentials.credentials) if credentials else None
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str):
    def check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this.")
        return user

    return Depends(check)


# Staff screens (everything except the customer portal).
StaffUser = Annotated[User, require_roles("admin", "staff")]
AdminUser = Annotated[User, require_roles("admin")]


def get_portal_user(user: CurrentUser) -> User:
    """A customer-portal login. Every portal query must filter by `user.customer_id`,
    so a customer only ever sees their own company's records."""
    if user.role != "customer" or not user.customer_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This page is for customer accounts.")
    return user


PortalUser = Annotated[User, Depends(get_portal_user)]
