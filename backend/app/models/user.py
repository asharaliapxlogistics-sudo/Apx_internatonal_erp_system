from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import Timestamps, UUIDPk

ROLES = ("admin", "staff", "customer")


class User(UUIDPk, Timestamps, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120))
    username: Mapped[str] = mapped_column(String(190), unique=True)  # login name, lower-case
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="staff")
    # Set only for customer-portal logins.
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
