from tests.test_customers import new_customer


def new_invoice(client, headers, customer_id, lines=None, **extra):
    body = {"customerId": customer_id, "month": "2026-10", "lines": lines or [{"amount": 1000}, {"amount": 500.5, "weight": 2.25}], **extra}
    res = client.post("/api/invoices", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_invoice_numbers_snapshot_and_totals(client, staff):
    c = new_customer(client, staff, "Acme")
    inv = new_invoice(client, staff, c["id"], prevBalance=200, received=100)
    assert inv["number"] == "INV-00001"
    assert (inv["customerName"], inv["accountNo"]) == ("Acme", "APX-1001")
    assert inv["preparedBy"] == "Staff"  # defaults to the signed-in user
    assert inv["totals"] == {"total": 1500.5, "payable": 1600.5, "paid": 0.0, "outstanding": 1600.5, "status": "Unpaid"}
    assert inv["lines"][1]["weight"] == 2.25 and inv["lines"][0]["nature"] == "WPX"
    # Renaming the customer later does not change the issued invoice.
    client.put(f"/api/customers/{c['id']}", headers=staff, json={"name": "Acme Ltd"})
    assert client.get(f"/api/invoices/{inv['id']}", headers=staff).json()["customerName"] == "Acme"
    assert new_invoice(client, staff, c["id"])["number"] == "INV-00002"


def test_payments_and_status(client, staff):
    c = new_customer(client, staff)
    inv = new_invoice(client, staff, c["id"], lines=[{"amount": 1000}])
    p = client.post(f"/api/invoices/{inv['id']}/payments", headers=staff, json={"date": "2026-10-11", "amount": 400, "method": "Cash"}).json()
    assert p["totals"]["status"] == "Partial" and p["totals"]["outstanding"] == 600.0
    paid = client.post(f"/api/invoices/{inv['id']}/status", headers=staff, json={"status": "Paid"}).json()
    assert paid["totals"]["status"] == "Paid" and paid["totals"]["outstanding"] == 0.0
    assert paid["payments"][-1]["reference"] == "Marked as paid" and paid["payments"][-1]["amount"] == 600.0
    unpaid = client.post(f"/api/invoices/{inv['id']}/status", headers=staff, json={"status": "Unpaid"}).json()
    assert unpaid["payments"] == [] and unpaid["totals"]["status"] == "Unpaid"
    assert client.post(f"/api/invoices/{inv['id']}/status", headers=staff, json={"status": "Partial"}).status_code == 400
    assert client.post(f"/api/invoices/{inv['id']}/payments", headers=staff, json={"date": "2026-10-11", "amount": 0}).status_code == 422


def test_last_outstanding_carries_forward(client, staff):
    c = new_customer(client, staff)
    assert client.get(f"/api/invoices/last-outstanding?customerId={c['id']}", headers=staff).json() == 0
    inv = new_invoice(client, staff, c["id"], lines=[{"amount": 700}])
    client.post(f"/api/invoices/{inv['id']}/payments", headers=staff, json={"date": "2026-10-11", "amount": 200})
    assert client.get(f"/api/invoices/last-outstanding?customerId={c['id']}", headers=staff).json() == 500.0


def test_invoice_validation_and_delete(client, staff):
    c = new_customer(client, staff)
    assert client.post("/api/invoices", headers=staff, json={"customerId": c["id"], "month": "2026-13", "lines": [{"amount": 1}]}).status_code == 422
    assert client.post("/api/invoices", headers=staff, json={"customerId": c["id"], "month": "2026-10", "lines": []}).status_code == 422
    assert client.post("/api/invoices", headers=staff, json={"customerId": "nope", "month": "2026-10", "lines": [{"amount": 1}]}).status_code == 400
    inv = new_invoice(client, staff, c["id"])
    assert client.delete(f"/api/invoices/{inv['id']}", headers=staff).status_code == 204
    assert client.delete(f"/api/customers/{c['id']}", headers=staff).status_code == 204


def test_expenses_crud_and_filters(client, staff):
    e1 = client.post("/api/expenses", headers=staff, json={"date": "2026-10-01", "category": "Fuel", "amount": 1500, "paidTo": "PSO"}).json()
    e2 = client.post("/api/expenses", headers=staff, json={"date": "2026-09-15", "category": "Office rent", "amount": 50000}).json()
    assert (e1["number"], e2["number"]) == ("EXP-00001", "EXP-00002")
    assert e1["preparedBy"] == "Staff" and e1["method"] == "Cash"
    october = client.get("/api/expenses?from=2026-10-01&to=2026-10-31", headers=staff).json()
    assert [e["number"] for e in october] == ["EXP-00001"]
    assert [e["number"] for e in client.get("/api/expenses?category=Office rent", headers=staff).json()] == ["EXP-00002"]
    upd = client.put(f"/api/expenses/{e1['id']}", headers=staff, json={"date": "2026-10-02", "category": "Fuel", "amount": 1800}).json()
    assert upd["amount"] == 1800.0 and upd["number"] == "EXP-00001" and upd["updatedAt"]
    assert client.post("/api/expenses", headers=staff, json={"date": "2026-10-01", "category": "Fuel", "amount": 0}).status_code == 422
    assert client.delete(f"/api/expenses/{e2['id']}", headers=staff).status_code == 204


def test_expense_date_cannot_be_in_future(client, staff):
    body = {"date": "2099-01-01", "category": "Fuel", "amount": 500}
    res = client.post("/api/expenses", headers=staff, json=body)
    assert res.status_code == 400 and "future" in res.json()["detail"]


def test_walk_in_invoice_without_customer(client, staff):
    body = {"customerName": "  Ali Traders ", "month": "2026-10", "lines": [{"tracking": "APX1", "amount": 900}]}
    inv = client.post("/api/invoices", headers=staff, json=body).json()
    assert (inv["customerId"], inv["customerName"], inv["accountNo"]) == (None, "Ali Traders", "")
    assert inv["totals"]["payable"] == 900.0
    # A walk-in invoice needs a name to bill to.
    assert client.post("/api/invoices", headers=staff, json={**body, "customerName": " "}).status_code == 400
