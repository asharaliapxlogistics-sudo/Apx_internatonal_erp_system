"""AWBs remember the Excel file they were imported from

Revision ID: d5e2f8a14c90
Revises: c4a8d1e93b27
Create Date: 2026-11-17 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd5e2f8a14c90'
down_revision: Union[str, Sequence[str], None] = 'c4a8d1e93b27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('awbs', sa.Column('import_file', sa.String(190), nullable=False, server_default=''))
    op.create_index('ix_awbs_import_file', 'awbs', ['import_file'])


def downgrade() -> None:
    op.drop_index('ix_awbs_import_file', table_name='awbs')
    op.drop_column('awbs', 'import_file')
