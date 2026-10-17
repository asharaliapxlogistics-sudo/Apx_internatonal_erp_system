"""Customers raise complaints from the portal; staff reply and resolve them."""

from tests.conftest import login
from tests.test_awbs_shipments import new_awb
from tests.test_customers import new_customer
from tests.test_portal import portal_login


def customer(client, admin, name, email):
    c = new_customer(client, admin, name)
    portal_login(client, admin, c["id"], email, name=f"{name} Owner")
    return c, login(client, email, "portal-pass-1")


def raise_(client, token, **body):
    return client.post("/api/portal/complaints", headers=token, json={"subject": "Parcel late", "body": "Where is it?", **body})


def test_complaint_thread_between_customer_and_staff(client, admin, staff):
    acme, tok = customer(client, admin, "Acme", "owner@acme.com")
    awb = new_awb(client, admin, customerId=acme["id"])

    res = raise_(client, tok, awbNumber=awb["number"], subject="  Parcel   late ")
    assert res.status_code == 201, res.text
    c = res.json()
    assert (c["number"], c["awbNumber"], c["subject"], c["status"]) == ("CMP-00001", awb["number"], "Parcel late", "Open")
    assert [m["body"] for m in c["messages"]] == ["Where is it?"] and c["messages"][0]["authorName"] == "Acme Owner"
    assert raise_(client, tok).json()["number"] == "CMP-00002"  # general complaint, no AWB

    # Office sees it with the customer, and on the dashboard.
    listed = client.get("/api/complaints", headers=staff).json()
    assert [(x["number"], x["customerName"]) for x in listed] == [("CMP-00002", "Acme"), ("CMP-00001", "Acme")]
    assert client.get("/api/dashboard", headers=staff).json()["actions"]["openComplaints"] == 2

    # Staff reply moves it to In progress; the customer sees the reply.
    r = client.post(f"/api/complaints/{c['id']}/messages", headers=staff, json={"body": "Checking with DPD."}).json()
    assert r["status"] == "In progress" and r["lastFromStaff"] and r["messages"][-1]["fromStaff"]
    mine = client.get(f"/api/portal/complaints/{c['id']}", headers=tok).json()
    assert [m["body"] for m in mine["messages"]] == ["Where is it?", "Checking with DPD."]

    # Resolve; a new customer message reopens it.
    assert client.put(f"/api/complaints/{c['id']}/status", headers=staff, json={"status": "Resolved"}).json()["status"] == "Resolved"
    assert [x["number"] for x in client.get("/api/complaints?status=Resolved", headers=staff).json()] == ["CMP-00001"]
    assert client.get("/api/dashboard", headers=staff).json()["actions"]["openComplaints"] == 1
    again = client.post(f"/api/portal/complaints/{c['id']}/messages", headers=tok, json={"body": "Still not here."}).json()
    assert again["status"] == "Open" and again["messageCount"] == 3


def test_complaints_are_private(client, admin, staff):
    acme, a_tok = customer(client, admin, "Acme", "owner@acme.com")
    bolt, b_tok = customer(client, admin, "Bolt", "owner@bolt.com")
    bolt_awb = new_awb(client, admin, customerId=bolt["id"])
    # Cannot complain about another company's shipment.
    assert raise_(client, a_tok, awbNumber=bolt_awb["number"]).status_code == 400
    c = raise_(client, a_tok).json()

    assert client.get("/api/portal/complaints", headers=b_tok).json() == []
    assert client.get(f"/api/portal/complaints/{c['id']}", headers=b_tok).status_code == 404
    assert client.post(f"/api/portal/complaints/{c['id']}/messages", headers=b_tok, json={"body": "x"}).status_code == 404
    assert [x["customerName"] for x in client.get(f"/api/complaints?customerId={bolt['id']}", headers=staff).json()] == []

    # Customers cannot use the staff side, staff cannot use the portal side.
    assert client.get("/api/complaints", headers=a_tok).status_code == 403
    assert client.put(f"/api/complaints/{c['id']}/status", headers=a_tok, json={"status": "Resolved"}).status_code == 403
    assert client.post("/api/portal/complaints", headers=staff, json={"subject": "x", "body": "y"}).status_code == 403


def test_complaint_validation(client, admin, staff):
    _, tok = customer(client, admin, "Acme", "owner@acme.com")
    assert raise_(client, tok, subject="  ").status_code == 422
    assert raise_(client, tok, body="   ").status_code == 422
    assert raise_(client, tok, body="x" * 2001).status_code == 422
    c = raise_(client, tok).json()
    assert client.put(f"/api/complaints/{c['id']}/status", headers=staff, json={"status": "Closed"}).status_code == 422
