"""Customers send one address line per shipment for the day; the office sees them per day and customer."""

import datetime as dt

from app.database import SessionLocal
from app.models import DailyAddress
from tests.conftest import login
from tests.test_customers import new_customer
from tests.test_portal import portal_login

LINE = "Sara Malik, 1 High St, London E1 6AN, UK, +44 7700 900123"


def customer(client, admin, name, email):
    c = new_customer(client, admin, name)
    portal_login(client, admin, c["id"], email, name=f"{name} Owner")
    return c, login(client, email, "portal-pass-1")


def send(client, token, *lines):
    return client.post("/api/portal/daily-addresses", headers=token, json={"addresses": [{"address": l} for l in lines]})


def test_customer_sends_lines_and_office_sees_them(client, admin, staff):
    acme, a_tok = customer(client, admin, "Acme", "owner@acme.com")
    bolt, b_tok = customer(client, admin, "Bolt", "owner@bolt.com")
    res = send(client, a_tok, f"  {LINE}  ", "Omar Farooq,\n Dubai  Marina")
    assert res.status_code == 201, res.text
    sent = res.json()
    assert [a["address"] for a in sent] == [LINE, "Omar Farooq, Dubai Marina"]  # trimmed to one line
    assert sent[0]["sentBy"] == "Acme Owner"
    send(client, b_tok, "Bolt consignee, Leeds")

    assert len(client.get("/api/portal/daily-addresses", headers=a_tok).json()) == 2
    assert len(client.get("/api/portal/daily-addresses", headers=b_tok).json()) == 1

    rows = client.get("/api/daily-addresses", headers=staff).json()
    assert [(r["customerName"], r["address"]) for r in rows] == [("Acme", LINE), ("Acme", "Omar Farooq, Dubai Marina"), ("Bolt", "Bolt consignee, Leeds")]
    assert rows[0]["accountNo"] == acme["accountNo"]
    assert [r["customerName"] for r in client.get(f"/api/daily-addresses?customerId={bolt['id']}", headers=staff).json()] == ["Bolt"]
    assert client.get("/api/daily-addresses?day=2000-01-01", headers=staff).json() == []


def test_customer_edits_only_own_todays_lines(client, admin):
    _, a_tok = customer(client, admin, "Acme", "owner@acme.com")
    _, b_tok = customer(client, admin, "Bolt", "owner@bolt.com")
    a = send(client, a_tok, LINE).json()[0]

    upd = client.put(f"/api/portal/daily-addresses/{a['id']}", headers=a_tok, json={"address": "New line, Leeds"})
    assert upd.json()["address"] == "New line, Leeds"
    assert client.put(f"/api/portal/daily-addresses/{a['id']}", headers=b_tok, json={"address": "x"}).status_code == 404
    assert client.delete(f"/api/portal/daily-addresses/{a['id']}", headers=b_tok).status_code == 404

    with SessionLocal() as db:
        db.get(DailyAddress, a["id"]).day = dt.date(2000, 1, 1)
        db.commit()
    assert client.delete(f"/api/portal/daily-addresses/{a['id']}", headers=a_tok).status_code == 409
    assert client.get("/api/portal/daily-addresses?day=2000-01-01", headers=a_tok).json()[0]["address"] == "New line, Leeds"

    b = send(client, a_tok, LINE).json()[0]
    assert client.delete(f"/api/portal/daily-addresses/{b['id']}", headers=a_tok).status_code == 204


def test_daily_address_access_and_validation(client, admin, staff):
    _, tok = customer(client, admin, "Acme", "owner@acme.com")
    assert client.post("/api/portal/daily-addresses", headers=tok, json={"addresses": []}).status_code == 422
    assert send(client, tok, LINE, "   ").status_code == 422  # all or nothing
    assert client.get("/api/portal/daily-addresses", headers=tok).json() == []
    assert send(client, tok, "x" * 501).status_code == 422
    assert client.get("/api/daily-addresses", headers=tok).status_code == 403
    assert send(client, staff, LINE).status_code == 403


def test_office_clears_a_days_addresses(client, admin, staff):
    acme, a_tok = customer(client, admin, "Acme", "owner@acme.com")
    bolt, b_tok = customer(client, admin, "Bolt", "owner@bolt.com")
    send(client, a_tok, "A one, Leeds", "A two, York")
    send(client, b_tok, "B one, Hull")
    day = client.get("/api/portal/daily-addresses", headers=a_tok).json()[0]["day"]

    # Customers cannot clear; the day is required.
    assert client.delete(f"/api/daily-addresses?day={day}", headers=a_tok).status_code == 403
    assert client.delete("/api/daily-addresses", headers=staff).status_code == 422

    # One customer's only, then everyone's.
    assert client.delete(f"/api/daily-addresses?day={day}&customerId={acme['id']}", headers=staff).json() == {"removed": 2}
    assert [r["customerName"] for r in client.get("/api/daily-addresses", headers=staff).json()] == ["Bolt"]
    assert client.delete(f"/api/daily-addresses?day={day}", headers=staff).json() == {"removed": 1}
    assert client.get("/api/daily-addresses", headers=staff).json() == []
    assert client.get("/api/portal/daily-addresses", headers=b_tok).json() == []
