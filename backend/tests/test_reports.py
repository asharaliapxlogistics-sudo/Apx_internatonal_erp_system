from app.schemas.common import office_now
from tests.test_awbs_shipments import new_awb
from tests.test_customers import new_customer
from tests.test_invoices_expenses import new_invoice


def test_reports_are_admin_only(client, staff, admin):
    for path in ("shipments", "sales", "balances", "expenses", "profit-loss"):
        assert client.get(f"/api/reports/{path}", headers=staff).status_code == 403
        assert client.get(f"/api/reports/{path}", headers=admin).status_code == 200


def test_reversed_range_is_rejected(client, admin):
    assert client.get("/api/reports/expenses?from=2026-10-31&to=2026-10-01", headers=admin).status_code == 400


def test_shipments_report(client, admin):
    c = new_customer(client, admin, "Acme")
    a = new_awb(client, admin, customerId=c["id"])  # 12.5 kg actual, small box -> 12.5 chargeable
    new_awb(client, admin, pieces=[{"length": 85, "width": 55, "height": 52}], service="DHL Express")  # volumetric 49 kg
    v = new_awb(client, admin)
    client.post(f"/api/awbs/{v['number']}/void", headers=admin, json={"reason": "x"})
    client.post("/api/shipments/events", headers=admin, json={"numbers": [a["number"]], "status": "Delivered", "at": "2099-01-01T10:00"})

    r = client.get("/api/reports/shipments", headers=admin).json()  # default: this month
    assert r["totals"]["shipments"] == 2  # void excluded
    assert r["totals"]["pieces"] == 3 and r["totals"]["chargeableWeight"] == 61.5
    assert {s["name"]: s["shipments"] for s in r["byService"]} == {"DHL Express": 1, "Direct UK DPD": 1}
    assert {s["name"] for s in r["byCustomer"]} == {"Acme", "No account (walk-in)"}
    assert {s["name"]: s["shipments"] for s in r["byStatus"]}["Delivered"] == 1
    scoped = client.get(f"/api/reports/shipments?customerId={c['id']}", headers=admin).json()
    assert [row["number"] for row in scoped["rows"]] == [a["number"]]
    # Nothing booked in an old month.
    assert client.get("/api/reports/shipments?from=2020-01-01&to=2020-01-31", headers=admin).json()["totals"]["shipments"] == 0


def test_sales_and_balances(client, admin):
    a = new_customer(client, admin, "Acme")
    b = new_customer(client, admin, "Bolt")
    a1 = new_invoice(client, admin, a["id"], lines=[{"amount": 1000}], month="2026-08")
    client.post(f"/api/invoices/{a1['id']}/payments", headers=admin, json={"date": "2026-09-05", "amount": 400, "method": "Cash"})
    # September invoice carries Acme's 600 forward.
    new_invoice(client, admin, a["id"], lines=[{"amount": 500}], month="2026-09", prevBalance=600)
    b1 = new_invoice(client, admin, b["id"], lines=[{"amount": 300}], month="2026-09")
    client.post(f"/api/invoices/{b1['id']}/payments", headers=admin, json={"date": "2026-09-20", "amount": 300, "method": "Bank transfer"})

    s = client.get("/api/reports/sales?from=2026-09-01&to=2026-09-30", headers=admin).json()
    assert s["totals"] == {"invoices": 2, "invoiced": 800.0, "collected": 700.0, "balanceNow": 1100.0}
    assert {m["name"]: m["amount"] for m in s["byMethod"]} == {"Cash": 400.0, "Bank transfer": 300.0}
    acme = next(r for r in s["byCustomer"] if r["name"] == "Acme")
    assert acme == {"name": "Acme", "invoiced": 500.0, "collected": 400.0, "balance": 1100.0}

    bal = client.get("/api/reports/balances", headers=admin).json()
    assert bal["totals"] == {"customers": 1, "balance": 1100.0}  # Bolt is paid up; Acme counted once
    row = bal["rows"][0]
    assert (row["customer"], row["invoice"], row["lastPayment"], row["age"]) == ("Acme", "INV-00002", "2026-09-05", "0–30 days")


def test_expenses_and_profit_loss(client, admin):
    c = new_customer(client, admin)
    inv = new_invoice(client, admin, c["id"], lines=[{"amount": 5000}], month="2026-09", prevBalance=999)
    client.post(f"/api/invoices/{inv['id']}/payments", headers=admin, json={"date": "2026-10-02", "amount": 2000})
    for date, cat, amt, method in (("2026-09-10", "Fuel", 700, "Cash"), ("2026-09-15", "Office rent", 3000, "Bank transfer"), ("2026-10-01", "Fuel", 300, "Cash")):
        client.post("/api/expenses", headers=admin, json={"date": date, "category": cat, "amount": amt, "method": method})

    e = client.get("/api/reports/expenses?from=2026-09-01&to=2026-10-31", headers=admin).json()
    assert e["totals"] == {"entries": 3, "amount": 4000.0}
    assert e["byCategory"][0] == {"name": "Office rent", "amount": 3000.0}
    assert e["byMonth"] == [{"month": "2026-09", "amount": 3700.0}, {"month": "2026-10", "amount": 300.0}]

    pl = client.get("/api/reports/profit-loss?from=2026-09-01&to=2026-10-31", headers=admin).json()
    # Revenue excludes the carried previous balance (999).
    assert pl["rows"] == [
        {"month": "2026-09", "revenue": 5000.0, "expenses": 3700.0, "profit": 1300.0, "collected": 0.0, "cash": -3700.0},
        {"month": "2026-10", "revenue": 0.0, "expenses": 300.0, "profit": -300.0, "collected": 2000.0, "cash": 1700.0},
    ]
    assert pl["totals"]["profit"] == 1000.0


def test_default_range_is_this_month(client, admin):
    r = client.get("/api/reports/expenses", headers=admin).json()
    today = office_now().date()
    assert (r["from"], r["to"]) == (today.replace(day=1).isoformat(), today.isoformat())
