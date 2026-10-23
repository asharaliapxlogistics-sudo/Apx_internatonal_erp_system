"""invoices without a customer account (walk-in, billed from AWBs)

Revision ID: c4a8d1e93b27
Revises: b3f9e2a71c58
Create Date: 2026-10-23 16:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4a8d1e93b27'
down_revision: Union[str, Sequence[str], None] = 'b3f9e2a71c58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('invoices', 'customer_id', existing_type=sa.CHAR(36), nullable=True)


def downgrade() -> None:
    op.alter_column('invoices', 'customer_id', existing_type=sa.CHAR(36), nullable=False)
