def new_customer(client, headers, name="Acme Traders", **extra):
    res = client.post("/api/customers", headers=headers, json={"name": name, "city": "Karachi", "phone": "0300-1234567", **extra})
    assert res.status_code == 201, res.text
    return res.json()


def test_account_numbers_follow_the_series(client, staff):
    a = new_customer(client, staff, "First")
    b = new_customer(client, staff, "Second")
    assert (a["accountNo"], b["accountNo"]) == ("APX-1001", "APX-1002")
    assert a["contactPerson"] == "" and a["country"] == "Pakistan"


def test_update_search_and_delete(client, staff):
    c = new_customer(client, staff, "  Spaced Name  ")
    assert c["name"] == "Spaced Name"
    upd = client.put(f"/api/customers/{c['id']}", headers=staff, json={"name": "Renamed", "type": "E-commerce", "city": "Lahore", "phone": "0300-7654321"})
    assert upd.json()["name"] == "Renamed" and upd.json()["accountNo"] == c["accountNo"]
    assert [x["name"] for x in client.get("/api/customers?q=renam", headers=staff).json()] == ["Renamed"]
    assert client.delete(f"/api/customers/{c['id']}", headers=staff).status_code == 204
    assert client.get(f"/api/customers/{c['id']}", headers=staff).status_code == 404


def test_rejects_bad_input(client, staff):
    assert client.post("/api/customers", headers=staff, json={"name": ""}).status_code == 422
    assert client.post("/api/customers", headers=staff, json={"name": "X", "type": "VIP"}).status_code == 422


def test_customer_with_invoice_cannot_be_deleted(client, staff):
    c = new_customer(client, staff)
    client.post("/api/invoices", headers=staff, json={"customerId": c["id"], "month": "2026-10", "lines": [{"amount": 100}]})
    res = client.delete(f"/api/customers/{c['id']}", headers=staff)
    assert res.status_code == 409


def test_simultaneous_saves_get_different_numbers(client, staff):
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda i: client.post("/api/customers", headers=staff, json={"name": f"C{i}", "city": "Karachi", "phone": "0300-1234567"}), range(10)))
    assert all(r.status_code == 201 for r in results), [r.text for r in results if r.status_code != 201]
    numbers = sorted(r.json()["accountSeq"] for r in results)
    assert numbers == list(range(1001, 1011))


def test_customer_field_checks(client, staff):
    ok = {"name": "Acme", "city": "Karachi", "phone": "0300-1234567"}

    def status(**changes):
        return client.post("/api/customers", headers=staff, json={**ok, **changes}).status_code

    # Pakistani phone formats that are accepted.
    for phone in ["03001234567", "+92 300 1234567", "0092-300-1234567", "021-34567890", "042 35761234", "051-1234567", "111-123-456"]:
        assert status(phone=phone) == 201, phone
    # And ones that are not.
    for phone in ["0300", "0300-123456", "021-1", "+44 7700 900123", "abc", ""]:
        assert status(phone=phone) == 422, phone
    assert status(city="12345") == 422 and status(city="") == 422
    assert status(email="not-an-email") == 422 and status(email="Ali@Example.PK") == 201
    assert status(cnic="12345") == 422 and status(cnic="42101-1234567-1") == 201
    assert status(ntn="12") == 422 and status(ntn="1234567-8") == 201
    assert status(strn="123") == 422 and status(strn="3277876123456") == 201
    assert status(zip="7550") == 422 and status(zip="75500") == 201
    assert status(zip="SW1A 1AA", country="United Kingdom") == 201  # foreign postcodes are free text
