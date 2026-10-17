"""microsecond timestamps

Revision ID: 2268a3865965
Revises: 9d1b7dad87ef
Create Date: 2026-10-11 15:43:51.831530

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2268a3865965'
down_revision: Union[str, Sequence[str], None] = '9d1b7dad87ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import mysql

# Record timestamps keep microseconds so entries saved in the same second sort in order.
COLUMNS = [
    (table, col, nullable)
    for table in ("users", "customers", "awbs", "invoices", "expenses")
    for col, nullable in (("created_at", False), ("updated_at", True))
] + [("tracking_events", "created_at", False), ("payments", "created_at", False)]


def upgrade() -> None:
    for table, col, nullable in COLUMNS:
        op.alter_column(table, col, type_=mysql.DATETIME(fsp=6), existing_type=mysql.DATETIME(), existing_nullable=nullable)


def downgrade() -> None:
    for table, col, nullable in COLUMNS:
        op.alter_column(table, col, type_=mysql.DATETIME(), existing_type=mysql.DATETIME(fsp=6), existing_nullable=nullable)
