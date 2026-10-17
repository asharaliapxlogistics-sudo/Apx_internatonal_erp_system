from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel, UtcDateTime
from app.schemas.validators import letters

Role = Literal["admin", "staff", "customer"]
# Long enough to resist guessing; short enough to type.
Password = Field(min_length=8, max_length=128)


class UserOut(CamelModel):
    id: str
    name: str
    email: str
    role: Role
    customer_id: str | None
    is_active: bool
    created_at: UtcDateTime
    last_login: UtcDateTime | None = None


class LoginIn(CamelModel):
    email: EmailStr
    password: str = Field(max_length=128)
    remember: bool = False


class LoginOut(CamelModel):
    token: str
    expires_at: datetime
    user: UserOut


class ChangePasswordIn(CamelModel):
    current_password: str = Field(max_length=128)
    new_password: str = Password


class UserCreate(CamelModel):
    name: letters("Name") = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Password
    role: Role = "staff"
    customer_id: str | None = None


class UserUpdate(CamelModel):
    name: letters("Name") | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    is_active: bool | None = None


class PasswordReset(CamelModel):
    new_password: str = Password
