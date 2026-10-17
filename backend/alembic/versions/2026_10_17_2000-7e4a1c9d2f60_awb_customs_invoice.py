"""customs invoice on the AWB: invoice type and item lines

Revision ID: 7e4a1c9d2f60
Revises: 5d2c8e41b7a3
Create Date: 2026-10-17 20:00:00

Existing AWBs become Gift invoices with no item lines (their invoice falls back to product detail and declared value).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7e4a1c9d2f60'
down_revision: Union[str, Sequence[str], None] = '5d2c8e41b7a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('awbs', sa.Column('invoice_type', sa.String(length=20), nullable=False, server_default='Gift'))
    op.create_table('awb_items',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('awb_number', sa.String(length=20), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('description', sa.String(length=190), nullable=False),
    sa.Column('hs_code', sa.String(length=20), nullable=False),
    sa.Column('unit', sa.String(length=20), nullable=False),
    sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.ForeignKeyConstraint(['awb_number'], ['awbs.number'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_awb_items_awb_number'), 'awb_items', ['awb_number'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_awb_items_awb_number'), table_name='awb_items')
    op.drop_table('awb_items')
    op.drop_column('awbs', 'invoice_type')
