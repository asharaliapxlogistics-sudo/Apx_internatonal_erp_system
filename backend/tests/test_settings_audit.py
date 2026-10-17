from tests.test_awbs_shipments import new_awb
from tests.test_customers import new_customer
from tests.test_invoices_expenses import new_invoice

COMPANY = {"name": "APX INTERNATIONAL", "office": "Karachi", "phone": "0345-3177311", "email": "", "ntn": ""}


def put(client, headers, **body):
    return client.put("/api/settings", headers=headers, json={"company": COMPANY, "trackingUrl": "", **body})


def test_staff_read_settings_admins_change_them(client, staff, admin):
    s = client.get("/api/settings", headers=staff).json()
    assert s["company"]["name"] == "APX INTERNATIONAL" and s["trackingUrl"] == ""
    assert {x["key"]: x["nextLabel"] for x in s["series"]} == {
        "awb": "10257080", "customer": "APX-1001", "invoice": "INV-00001", "expense": "EXP-00001"}
    assert put(client, staff).status_code == 403
    res = put(client, admin, company={**COMPANY, "phone": "021-35678901"}, trackingUrl="https://apx.example/track")
    assert res.status_code == 200 and res.json()["company"]["phone"] == "021-35678901"
    assert put(client, admin, trackingUrl="apx.example").status_code == 400


def test_number_series_can_only_move_forward(client, admin):
    new_awb(client, admin)  # uses 10257080
    low = put(client, admin, series={"awb": 10257000})
    assert low.status_code == 400 and "10257080" in low.json()["detail"]
    assert put(client, admin, series={"awb": 20000000}).status_code == 200
    assert new_awb(client, admin)["number"] == "20000000"
    # Re-saving the same value (e.g. saving the company form) is not an error.
    assert put(client, admin, series={"awb": 20000000}).status_code == 200
    assert put(client, admin, series={"invoice": 0}).status_code == 400


def test_actions_are_logged(client, staff, admin):
    client.post("/api/auth/login", json={"email": "staff@test.com", "password": "wrong-pass"})
    c = new_customer(client, staff, "Acme")
    client.put(f"/api/customers/{c['id']}", headers=staff, json={"name": "Acme", "city": "Karachi", "phone": "0300-7654321"})
    a = new_awb(client, staff)
    client.post("/api/shipments/events", headers=staff, json={"numbers": [a["number"]], "status": "Picked up", "at": "2099-01-01T09:00", "location": "Karachi"})
    client.post(f"/api/awbs/{a['number']}/void", headers=staff, json={"reason": "Customer cancelled"})
    inv = new_invoice(client, staff, c["id"], lines=[{"amount": 1000}])
    client.post(f"/api/invoices/{inv['id']}/payments", headers=staff, json={"date": "2026-10-11", "amount": 400, "method": "Cash"})
    put(client, admin, company={**COMPANY, "phone": "021-34567890"})

    assert client.get("/api/audit", headers=staff).status_code == 403
    log = client.get("/api/audit?limit=200", headers=admin).json()
    actions = [r["action"] for r in log["rows"]]
    for expected in ("auth.login_failed", "auth.login", "customer.create", "customer.update", "awb.create",
                     "shipment.status", "awb.void", "invoice.create", "invoice.payment", "settings.update"):
        assert expected in actions, expected
    assert log["rows"][0]["action"] == "settings.update"  # newest first

    edit = next(r for r in log["rows"] if r["action"] == "customer.update")
    assert edit["userName"] == "Staff" and edit["details"]["changes"] == {"phone": ["0300-1234567", "0300-7654321"]}
    failed = next(r for r in log["rows"] if r["action"] == "auth.login_failed")
    assert failed["summary"] == "Failed sign-in for staff@test.com" and failed["userId"] is None

    # Search by AWB number finds everything that happened to it.
    by_awb = client.get(f"/api/audit?q={a['number']}", headers=admin).json()
    assert {r["action"] for r in by_awb["rows"]} == {"awb.create", "shipment.status", "awb.void"}
    only_invoices = client.get("/api/audit?entity=invoice", headers=admin).json()
    assert only_invoices["total"] == 2
    page = client.get("/api/audit?limit=2&offset=0", headers=admin).json()
    assert len(page["rows"]) == 2 and page["total"] == log["total"]


def test_unchanged_save_is_not_logged(client, staff, admin):
    c = new_customer(client, staff, "Same")
    client.put(f"/api/customers/{c['id']}", headers=staff, json={"name": "Same", "city": "Karachi"})
    log = client.get("/api/audit?entity=customer", headers=admin).json()
    assert [r["action"] for r in log["rows"]] == ["customer.create"]
