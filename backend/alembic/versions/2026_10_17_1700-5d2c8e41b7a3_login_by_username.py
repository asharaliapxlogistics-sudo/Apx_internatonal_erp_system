"""login by username instead of email

Revision ID: 5d2c8e41b7a3
Revises: af7b02fed927
Create Date: 2026-10-17 17:00:00

Existing logins keep their old email as their username, so nobody is locked out.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5d2c8e41b7a3'
down_revision: Union[str, Sequence[str], None] = 'af7b02fed927'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users RENAME COLUMN email TO username, RENAME INDEX email TO username")


def downgrade() -> None:
    op.execute("ALTER TABLE users RENAME COLUMN username TO email, RENAME INDEX username TO email")
