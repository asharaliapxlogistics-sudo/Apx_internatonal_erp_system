"""A customer login must only ever reach its own company's data, and none of the staff screens."""

from tests.conftest import login
from tests.test_customers import new_customer

STAFF_ENDPOINTS = [
    "/api/customers", "/api/awbs", "/api/shipments", "/api/invoices", "/api/expenses", "/api/dashboard",
    "/api/reports/shipments", "/api/reports/balances", "/api/users", "/api/settings", "/api/audit",
    "/api/invoices/last-outstanding?customerId=x",
]


def portal_login(client, admin, customer_id, email, name="Portal User", password="portal-pass-1"):
    res = client.post("/api/users", headers=admin, json={"name": name, "email": email, "password": password, "role": "customer", "customerId": customer_id})
    assert res.status_code == 201, res.text
    return res.json()


def test_customer_sees_only_own_company(client, admin):
    acme = new_customer(client, admin, "Acme", phone="0300-7654321")
    bolt = new_customer(client, admin, "Bolt")
    portal_login(client, admin, acme["id"], "owner@acme.com", "Acme Owner")
    portal_login(client, admin, acme["id"], "clerk@acme.com", "Acme Clerk")
    portal_login(client, admin, bolt["id"], "owner@bolt.com", "Bolt Owner")

    acme_token = login(client, "owner@acme.com", "portal-pass-1")
    me = client.get("/api/portal/me", headers=acme_token).json()
    assert me["company"]["name"] == "Acme" and me["company"]["accountNo"] == "APX-1001" and me["company"]["phone"] == "0300-7654321"
    assert me["user"]["email"] == "owner@acme.com" and me["user"]["lastLogin"]
    assert sorted(t["email"] for t in me["team"]) == ["clerk@acme.com", "owner@acme.com"]  # never Bolt's people

    bolt_me = client.get("/api/portal/me", headers=login(client, "owner@bolt.com", "portal-pass-1")).json()
    assert bolt_me["company"]["name"] == "Bolt" and [t["email"] for t in bolt_me["team"]] == ["owner@bolt.com"]


def test_customer_cannot_use_staff_screens(client, admin):
    c = new_customer(client, admin)
    portal_login(client, admin, c["id"], "p@acme.com")
    token = login(client, "p@acme.com", "portal-pass-1")
    for path in STAFF_ENDPOINTS:
        assert client.get(path, headers=token).status_code == 403, path
    awb = {"service": "X", "actualWeight": 1, "productDetail": "x", "pieces": [{}],
           "shipper": {"name": "a", "address": "a", "city": "a", "country": "a", "phone": "1"},
           "consignee": {"name": "a", "address": "a", "city": "a", "country": "a", "phone": "1"}}
    assert client.post("/api/awbs", headers=token, json=awb).status_code == 403
    assert client.post("/api/customers", headers=token, json={"name": "Hack"}).status_code == 403


def test_staff_cannot_use_portal_endpoints(client, admin, staff):
    assert client.get("/api/portal/me", headers=staff).status_code == 403
    assert client.get("/api/portal/me", headers=admin).status_code == 403


def test_admin_manages_one_customers_logins(client, admin, staff):
    acme = new_customer(client, admin, "Acme")
    bolt = new_customer(client, admin, "Bolt")
    owner = portal_login(client, admin, acme["id"], "owner@acme.com")
    portal_login(client, admin, bolt["id"], "owner@bolt.com")
    login(client, "owner@acme.com", "portal-pass-1")

    listed = client.get(f"/api/users?customerId={acme['id']}", headers=admin).json()
    assert [u["email"] for u in listed] == ["owner@acme.com"] and listed[0]["lastLogin"]
    assert client.get(f"/api/users?customerId={acme['id']}", headers=staff).status_code == 403

    # Disabling locks them out at once.
    token = login(client, "owner@acme.com", "portal-pass-1")
    client.patch(f"/api/users/{owner['id']}", headers=admin, json={"isActive": False})
    assert client.get("/api/portal/me", headers=token).status_code == 401


def test_customer_login_and_staff_account_never_swap(client, admin, staff):
    c = new_customer(client, admin)
    owner = portal_login(client, admin, c["id"], "owner@acme.com")
    assert client.patch(f"/api/users/{owner['id']}", headers=admin, json={"role": "admin"}).status_code == 400
    staff_id = client.get("/api/auth/me", headers=staff).json()["id"]
    assert client.patch(f"/api/users/{staff_id}", headers=admin, json={"role": "customer"}).status_code == 400
    # A portal login needs a real customer.
    bad = client.post("/api/users", headers=admin, json={"name": "x", "email": "x@x.com", "password": "portal-pass-1", "role": "customer"})
    assert bad.status_code == 400


def test_deleting_customer_removes_its_logins(client, admin):
    c = new_customer(client, admin)
    portal_login(client, admin, c["id"], "owner@acme.com")
    assert client.delete(f"/api/customers/{c['id']}", headers=admin).status_code == 204
    assert client.post("/api/auth/login", json={"email": "owner@acme.com", "password": "portal-pass-1"}).status_code == 401


def test_portal_shipments_are_own_only(client, admin):
    from tests.test_awbs_shipments import new_awb

    acme = new_customer(client, admin, "Acme")
    bolt = new_customer(client, admin, "Bolt")
    mine = new_awb(client, admin, customerId=acme["id"], shipperReference="PO-7")
    theirs = new_awb(client, admin, customerId=bolt["id"])
    void = new_awb(client, admin, customerId=acme["id"])
    client.post(f"/api/awbs/{void['number']}/void", headers=admin, json={"reason": "typo"})
    client.post("/api/shipments/events", headers=admin, json={"numbers": [mine["number"]], "status": "Customs hold", "at": "2099-01-01T10:00", "location": "LHR", "remarks": "Invoice needed"})

    portal_login(client, admin, acme["id"], "owner@acme.com")
    token = login(client, "owner@acme.com", "portal-pass-1")
    listed = client.get("/api/portal/shipments", headers=token).json()
    assert [s["number"] for s in listed] == [mine["number"]]  # not Bolt's, not void
    s = listed[0]
    assert (s["consignee"], s["city"], s["pieces"], s["weight"], s["reference"]) == ("Sara Malik", "London", 2, 12.5, "PO-7")
    assert (s["status"], s["group"]) == ("Customs hold", "customs")
    assert [e["status"] for e in s["events"]] == ["Booked", "Customs hold"] and s["events"][1]["at"] == "2099-01-01T10:00"
    assert "by" not in s["events"][0]  # staff names stay internal

    assert client.get(f"/api/portal/shipments/{mine['number']}", headers=token).status_code == 200
    for other in (theirs["number"], void["number"], "999"):
        assert client.get(f"/api/portal/shipments/{other}", headers=token).status_code == 404


def test_portal_invoices_are_own_only(client, admin):
    from tests.test_invoices_expenses import new_invoice

    acme = new_customer(client, admin, "Acme")
    bolt = new_customer(client, admin, "Bolt")
    inv = new_invoice(client, admin, acme["id"], prevBalance=200, received=100)
    client.post(f"/api/invoices/{inv['id']}/payments", headers=admin, json={"date": "2026-10-05", "amount": 500})
    new_invoice(client, admin, bolt["id"])

    portal_login(client, admin, acme["id"], "owner@acme.com")
    listed = client.get("/api/portal/invoices", headers=login(client, "owner@acme.com", "portal-pass-1")).json()
    assert len(listed) == 1
    i = listed[0]
    assert (i["number"], i["month"], i["amount"], i["prevBalance"]) == ("INV-00001", "2026-10", 1500.5, 200.0)
    assert (i["paid"], i["balance"], i["status"]) == (600.0, 1100.5, "Partial")
    assert len(i["issued"]) == 10


def test_public_tracking_needs_no_login_and_hides_details(client, admin):
    from tests.test_awbs_shipments import new_awb

    a = new_awb(client, admin)
    res = client.get(f"/api/track/{a['number']}")
    assert res.status_code == 200
    body = res.json()
    assert (body["status"], body["city"], body["country"]) == ("Booked", "London", "United Kingdom")
    assert not {"consignee", "weight", "contents", "reference"} & body.keys()
    client.post(f"/api/awbs/{a['number']}/void", headers=admin, json={"reason": "x"})
    assert client.get(f"/api/track/{a['number']}").status_code == 404
    assert client.get("/api/track/nope").status_code == 404


def test_portal_prints_own_awbs_and_invoices_only(client, admin):
    from tests.test_awbs_shipments import new_awb
    from tests.test_invoices_expenses import new_invoice

    acme = new_customer(client, admin, "Acme")
    bolt = new_customer(client, admin, "Bolt")
    mine = new_awb(client, admin, customerId=acme["id"])
    my_inv, their_inv = new_invoice(client, admin, acme["id"]), new_invoice(client, admin, bolt["id"])
    client.put("/api/settings", headers=admin, json={"company": {"name": "APX Test", "phone": "021-34567890"}, "trackingUrl": "https://apx.test/track"})

    portal_login(client, admin, acme["id"], "owner@acme.com")
    token = login(client, "owner@acme.com", "portal-pass-1")

    # Customers cannot open or print airway bills.
    assert client.get(f"/api/portal/awbs/{mine['number']}", headers=token).status_code == 404

    inv = client.get(f"/api/portal/invoices/{my_inv['id']}", headers=token).json()
    assert inv["number"] == my_inv["number"] and inv["totals"]["total"] == 1500.5 and len(inv["lines"]) == 2
    assert client.get(f"/api/portal/invoices/{their_inv['id']}", headers=token).status_code == 404

    s = client.get("/api/portal/settings", headers=token).json()
    assert s == {"company": {"name": "APX Test", "office": "", "phone": "021-34567890", "email": "", "ntn": ""}, "trackingUrl": "https://apx.test/track"}
    assert client.get("/api/portal/settings", headers=admin).status_code == 403
