"""Customers cannot book shipments themselves, and the portal has no address book."""

from tests.conftest import login
from tests.test_customers import new_customer
from tests.test_portal import portal_login

CONSIGNEE = {"name": " Sara Malik ", "address": "1 High St", "city": "London", "zip": "E1 6AN", "country": "United Kingdom", "phone": "+44 7700 900123"}


def customer_token(client, admin, name="Acme", email="owner@acme.com"):
    c = new_customer(client, admin, name)
    portal_login(client, admin, c["id"], email)
    return login(client, email, "portal-pass-1")


def test_address_book_removed(client, admin):
    token = customer_token(client, admin)
    assert client.get("/api/portal/addresses", headers=token).status_code == 404
    assert client.post("/api/portal/addresses", headers=token, json=CONSIGNEE).status_code in (404, 405)


def test_customers_cannot_book_shipments(client, admin):
    token = customer_token(client, admin)
    body = {"service": "X", "actualWeight": 1, "productDetail": "x", "consignee": CONSIGNEE, "pieces": [{}]}
    assert client.post("/api/portal/awbs", headers=token, json=body).status_code in (404, 405)
    assert client.post("/api/portal/awbs/bulk", headers=token, json={"shipments": [body]}).status_code in (404, 405)
    assert client.get("/api/portal/shipments", headers=token).json() == []
