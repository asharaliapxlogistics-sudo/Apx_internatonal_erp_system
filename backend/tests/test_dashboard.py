from app.schemas.common import office_now
from tests.test_awbs_shipments import new_awb
from tests.test_customers import new_customer
from tests.test_invoices_expenses import new_invoice


def test_dashboard_figures(client, staff):
    now = office_now()
    today, month = now.strftime("%Y-%m-%dT%H:%M"), now.strftime("%Y-%m")
    c = new_customer(client, staff)
    a = new_awb(client, staff, customerId=c["id"])
    b = new_awb(client, staff)
    v = new_awb(client, staff)
    client.post(f"/api/awbs/{v['number']}/void", headers=staff, json={"reason": "x"})
    client.post("/api/shipments/events", headers=staff, json={"numbers": [a["number"]], "status": "Delivered", "at": today})
    client.post("/api/shipments/events", headers=staff, json={"numbers": [b["number"]], "status": "Customs hold", "at": today, "remarks": "docs"})
    inv = new_invoice(client, staff, c["id"], lines=[{"amount": 1000}], month=month)
    client.post(f"/api/invoices/{inv['id']}/payments", headers=staff, json={"date": now.date().isoformat(), "amount": 300})
    client.post("/api/expenses", headers=staff, json={"date": now.date().isoformat(), "category": "Fuel", "amount": 250})

    d = client.get("/api/dashboard", headers=staff).json()
    assert d["customers"] == {"total": 1, "newThisMonth": 1}
    assert d["today"] == {"bookings": 2, "inTransit": 0, "customsHold": 1, "delivered": 1, "exceptions": 0}
    assert d["month"] == {"receivables": 700.0, "revenue": 1000.0, "expenses": 250.0}
    assert d["actions"]["unpaidInvoices"] == 1 and d["scoped"] is False

    scoped = client.get(f"/api/dashboard?customerId={c['id']}", headers=staff).json()
    assert scoped["today"]["bookings"] == 1 and scoped["today"]["customsHold"] == 0
    assert scoped["month"]["expenses"] == 0.0 and scoped["scoped"] is True


def test_receivables_count_carried_balance_once(client, staff):
    # Each invoice carries the previous outstanding forward, so the customer owes the latest invoice's outstanding only.
    c = new_customer(client, staff)
    new_invoice(client, staff, c["id"], lines=[{"amount": 1000}])
    carried = client.get(f"/api/invoices/last-outstanding?customerId={c['id']}", headers=staff).json()
    new_invoice(client, staff, c["id"], lines=[{"amount": 500}], prevBalance=carried)
    d = client.get("/api/dashboard", headers=staff).json()
    assert d["month"]["receivables"] == 1500.0
