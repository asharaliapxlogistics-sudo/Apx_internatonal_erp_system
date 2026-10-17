"""Tests run against a separate database (apx_erp_test), never the real one.

Run from the backend folder:  .venv\\Scripts\\python.exe -m pytest
"""

import os

os.environ["DB_NAME"] = "apx_erp_test"  # must be set before the app reads its settings

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from app.database import SessionLocal, engine
from app.main import app
from app.models import User
from app.security import hash_password, login_limiter

BACKEND = os.path.dirname(os.path.dirname(__file__))
DATA_TABLES = ["audit_logs", "addresses", "daily_addresses", "complaint_messages", "complaints", "tracking_events", "awb_pieces", "payments", "invoice_lines", "invoices", "awbs", "expenses", "users", "customers"]


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    assert engine.url.database == "apx_erp_test"
    # Start from an empty test database, so leftovers of an interrupted run (e.g. changed settings)
    # never become the "migrated" values below.
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for t in inspect(conn).get_table_names():
            conn.execute(text(f"DROP TABLE `{t}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    command.upgrade(Config(os.path.join(BACKEND, "alembic.ini")), "head")
    with engine.connect() as conn:
        return dict(conn.execute(text("SELECT `key`, value FROM settings")).all())


@pytest.fixture(autouse=True)
def clean_tables(migrated_db):
    with engine.begin() as conn:
        # Settings go back to their migrated values, so a test that changes them affects no other.
        conn.execute(text("DELETE FROM settings"))
        for key, value in migrated_db.items():
            conn.execute(text("INSERT INTO settings (`key`, value) VALUES (:k, :v)"), {"k": key, "v": value})
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for t in DATA_TABLES:
            conn.execute(text(f"DELETE FROM {t}"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    login_limiter._failures.clear()


@pytest.fixture
def client():
    return TestClient(app)


def make_user(role="admin", email="admin@test.com", password="admin-pass-1", customer_id=None):
    with SessionLocal() as db:
        db.add(User(name=role.title(), email=email, password_hash=hash_password(password), role=role, customer_id=customer_id))
        db.commit()


def login(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.fixture
def admin(client):
    make_user()
    return login(client, "admin@test.com", "admin-pass-1")


@pytest.fixture
def staff(client):
    make_user(role="staff", email="staff@test.com", password="staff-pass-1")
    return login(client, "staff@test.com", "staff-pass-1")
