"""customs item unit price keeps 4 decimals (e.g. USD 0.015)

Revision ID: b3f9e2a71c58
Revises: 7e4a1c9d2f60
Create Date: 2026-10-23 14:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b3f9e2a71c58'
down_revision: Union[str, Sequence[str], None] = '7e4a1c9d2f60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('awb_items', 'unit_price', existing_type=sa.Numeric(12, 2), type_=sa.Numeric(12, 4), existing_nullable=False)


def downgrade() -> None:
    op.alter_column('awb_items', 'unit_price', existing_type=sa.Numeric(12, 4), type_=sa.Numeric(12, 2), existing_nullable=False)
