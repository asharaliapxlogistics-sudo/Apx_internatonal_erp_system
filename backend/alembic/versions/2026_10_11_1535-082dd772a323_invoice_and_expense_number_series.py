"""invoice and expense number series

Revision ID: 082dd772a323
Revises: 75a1af1fa9ba
Create Date: 2026-10-11 15:35:08.407740

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '082dd772a323'
down_revision: Union[str, Sequence[str], None] = '75a1af1fa9ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


settings = sa.table('settings', sa.column('key', sa.String), sa.column('value', sa.String))


def upgrade() -> None:
    """Invoices (INV-00001) and expense vouchers (EXP-00001) get a series row too; locking it serialises numbering."""
    op.bulk_insert(settings, [
        {'key': 'invoice_first_number', 'value': '1'},
        {'key': 'expense_first_number', 'value': '1'},
    ])


def downgrade() -> None:
    op.execute(settings.delete().where(settings.c.key.in_(['invoice_first_number', 'expense_first_number'])))
