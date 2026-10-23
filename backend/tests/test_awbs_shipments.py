PARTY = {"name": "Ali Khan", "address": "Gulshan", "city": "Karachi", "country": "Pakistan", "phone": "0300-1234567"}
CONSIGNEE = {"name": "Sara Malik", "address": "1 High St", "city": "London", "zip": "E1 6AN", "country": "United Kingdom", "phone": "+44 7700 900123"}


def new_awb(client, headers, **extra):
    body = {
        "service": "Direct UK DPD",
        "actualWeight": 12.5,
        "declaredValue": 30,
        "productDetail": "WOMENS DRESS",
        "shipper": {**PARTY, "ntnCnic": "42101-1234567-1"},
        "consignee": CONSIGNEE,
        "pieces": [{"length": 40, "width": 30, "height": 20}, {"length": None, "width": None, "height": None}],
        **extra,
    }
    res = client.post("/api/awbs", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_awb_numbers_and_shape(client, staff):
    a = new_awb(client, staff)
    b = new_awb(client, staff)
    assert (a["number"], b["number"]) == ("10257080", "10257081")
    assert a["status"] == "Active"
    assert a["actualWeight"] == 12.5 and a["declaredValue"] == 30.0
    assert a["shipper"]["ntnCnic"] == "42101-1234567-1" and a["consignee"]["ntnCnic"] == ""
    assert a["pieces"][0] == {"length": 40.0, "width": 30.0, "height": 20.0}
    assert a["pieces"][1]["length"] is None
    assert a["createdAt"].endswith("Z")


def test_void_and_delete(client, staff):
    a = new_awb(client, staff)
    v = client.post(f"/api/awbs/{a['number']}/void", headers=staff, json={"reason": "Customer cancelled"})
    assert v.json()["status"] == "Void" and v.json()["voidReason"] == "Customer cancelled"
    assert client.post(f"/api/awbs/{a['number']}/void", headers=staff, json={"reason": "again"}).status_code == 409
    # Void AWBs are not shipments.
    assert client.get("/api/shipments", headers=staff).json() == []
    # Restoring brings it back as an active shipment; restoring twice is refused.
    r = client.post(f"/api/awbs/{a['number']}/restore", headers=staff)
    assert r.json()["status"] == "Active" and r.json()["voidReason"] == "" and r.json()["voidedAt"] is None
    assert client.post(f"/api/awbs/{a['number']}/restore", headers=staff).status_code == 409
    assert [s["awb"]["number"] for s in client.get("/api/shipments", headers=staff).json()] == [a["number"]]
    assert client.delete(f"/api/awbs/{a['number']}", headers=staff).status_code == 204
    assert client.get(f"/api/awbs/{a['number']}", headers=staff).status_code == 404


def test_awb_validation(client, staff):
    res = client.post("/api/awbs", headers=staff, json={"service": "X", "actualWeight": -1, "productDetail": "x",
                                                         "shipper": PARTY, "consignee": CONSIGNEE, "pieces": [{}]})
    assert res.status_code == 422
    res = client.post("/api/awbs", headers=staff, json={"service": "X", "actualWeight": 1, "productDetail": "x",
                                                         "shipper": PARTY, "consignee": CONSIGNEE, "pieces": [{}],
                                                         "customerId": "no-such-customer"})
    assert res.status_code == 400


def test_new_shipment_is_booked(client, staff):
    a = new_awb(client, staff)
    s = client.get(f"/api/shipments/{a['number']}", headers=staff).json()
    assert s["status"] == "Booked" and s["group"] == "booked"
    assert [e["status"] for e in s["events"]] == ["Booked"]
    assert s["events"][0]["auto"] is True and s["events"][0]["location"] == "Karachi"


def test_bulk_update_and_timeline(client, staff):
    a, b = new_awb(client, staff), new_awb(client, staff)
    nums = [a["number"], b["number"]]
    res = client.post("/api/shipments/events", headers=staff, json={
        "numbers": nums + [a["number"]], "status": "Departed origin", "at": "2099-01-01T10:30", "location": "Karachi Airport (KHI)"})
    assert res.json() == nums  # duplicates removed
    s = client.get(f"/api/shipments/{a['number']}", headers=staff).json()
    assert s["status"] == "Departed origin" and s["group"] == "transit"
    assert s["last"]["at"] == "2099-01-01T10:30" and s["last"]["by"] == "Staff"


def test_bulk_update_is_all_or_nothing(client, staff):
    a = new_awb(client, staff)
    res = client.post("/api/shipments/events", headers=staff, json={"numbers": [a["number"], "99999999"], "status": "Picked up", "at": "2099-01-01T09:00"})
    assert res.status_code == 400 and "99999999" in res.json()["detail"]
    assert client.get(f"/api/shipments/{a['number']}", headers=staff).json()["status"] == "Booked"


def test_status_rules(client, staff):
    a = new_awb(client, staff)
    base = {"numbers": [a["number"]], "at": "2099-01-01T09:00"}
    assert client.post("/api/shipments/events", headers=staff, json={**base, "status": "Booked"}).status_code == 422
    assert client.post("/api/shipments/events", headers=staff, json={**base, "status": "Teleported"}).status_code == 422
    assert client.post("/api/shipments/events", headers=staff, json={**base, "status": "Customs hold"}).status_code == 422
    ok = client.post("/api/shipments/events", headers=staff, json={**base, "status": "Customs hold", "remarks": "Invoice needed"})
    assert ok.status_code == 200


def test_delete_event_and_carrier(client, staff):
    a = new_awb(client, staff)
    client.post("/api/shipments/events", headers=staff, json={"numbers": [a["number"]], "status": "Picked up", "at": "2099-01-01T09:00"})
    s = client.get(f"/api/shipments/{a['number']}", headers=staff).json()
    event_id = s["last"]["id"]
    assert client.delete(f"/api/shipments/{a['number']}/events/booked", headers=staff).status_code == 404
    assert client.delete(f"/api/shipments/{a['number']}/events/{event_id}", headers=staff).status_code == 204
    c = client.put(f"/api/shipments/{a['number']}/carrier", headers=staff, json={"carrier": "DPD", "carrierTracking": " 15503801001528B "}).json()
    assert c["status"] == "Booked" and c["carrierTracking"] == "15503801001528B"


def test_deleting_awb_removes_its_history(client, staff):
    a = new_awb(client, staff)
    client.post("/api/shipments/events", headers=staff, json={"numbers": [a["number"]], "status": "Picked up", "at": "2099-01-01T09:00"})
    client.delete(f"/api/awbs/{a['number']}", headers=staff)
    # The number is issued again, with a clean history.
    again = new_awb(client, staff)
    assert again["number"] == a["number"]
    assert client.get(f"/api/shipments/{again['number']}", headers=staff).json()["status"] == "Booked"


def test_update_before_booking_is_rejected(client, staff):
    # An update dated before the AWB was booked would sort under "Booked" and silently not change the status.
    a = new_awb(client, staff)
    res = client.post("/api/shipments/events", headers=staff, json={"numbers": [a["number"]], "status": "Picked up", "at": "2020-01-01T09:00"})
    assert res.status_code == 400 and a["number"] in res.json()["detail"]
    assert client.get(f"/api/shipments/{a['number']}", headers=staff).json()["status"] == "Booked"


def test_awb_field_checks(client, staff):
    def status(shipper=None, consignee=None, **extra):
        body = {
            "service": "Direct UK DPD", "actualWeight": 12.5, "productDetail": "WOMENS DRESS",
            "shipper": {**PARTY, **(shipper or {})}, "consignee": {**CONSIGNEE, **(consignee or {})},
            "pieces": [{"length": 40, "width": 30, "height": 20}], **extra,
        }
        return client.post("/api/awbs", headers=staff, json=body).status_code

    assert status() == 201
    assert status(shipper={"phone": "0300"}) == 422  # Pakistani shipper: Pakistani number
    assert status(shipper={"phone": "+44 7700 900123"}) == 422
    assert status(consignee={"phone": "12"}) == 422  # foreign consignee: full international number
    assert status(consignee={"phone": "+971 50 123 4567"}) == 201
    assert status(consignee={"country": "Pakistan", "city": "Lahore", "zip": "54000", "phone": "042-35761234"}) == 201
    assert status(shipper={"zip": "123"}) == 422
    assert status(shipper={"ntnCnic": "999"}) == 422
    assert status(consignee={"email": "nope"}) == 422
    assert status(actualWeight=0) == 422
    assert status(pieces=[{"length": 40, "width": None, "height": 20}]) == 422  # half-filled box


def test_customs_invoice_items(client, staff):
    # Without items the AWB keeps its own declared value and is a Gift invoice.
    a = new_awb(client, staff)
    assert (a["invoiceType"], a["items"], a["declaredValue"]) == ("Gift", [], 30.0)

    # With items the declared value is their total.
    items = [
        {"description": " MENS SWEATER ", "hsCode": "6110309100", "quantity": 30, "unitPrice": 2.5},
        {"description": "SCARF", "unit": "", "quantity": 2, "unitPrice": 4.25},
    ]
    b = new_awb(client, staff, invoiceType="Commercial", items=items)
    assert b["invoiceType"] == "Commercial" and b["declaredValue"] == 83.5
    assert b["items"][0] == {"description": "MENS SWEATER", "hsCode": "6110309100", "unit": "Piece(s)", "quantity": 30.0, "unitPrice": 2.5}
    assert b["items"][1]["unit"] == "Piece(s)"

    # Items can be filled in after the AWB is saved, and replaced.
    c = client.put(f"/api/awbs/{a['number']}/customs", headers=staff, json={"invoiceType": "Gift", "items": items[:1]}).json()
    assert (c["invoiceType"], len(c["items"]), c["declaredValue"]) == ("Gift", 1, 75.0)
    assert client.get(f"/api/awbs/{a['number']}", headers=staff).json()["items"][0]["hsCode"] == "6110309100"
    # Switching Gift / Commercial keeps the items.
    d = client.put(f"/api/awbs/{a['number']}/customs", headers=staff, json={"invoiceType": "Commercial", "items": c["items"]}).json()
    assert (d["invoiceType"], len(d["items"]), d["declaredValue"]) == ("Commercial", 1, 75.0)
    # Fractions of a cent per piece are kept.
    e = client.put(f"/api/awbs/{a['number']}/customs", headers=staff, json={"items": [{"description": "BUTTONS", "quantity": 3085, "unitPrice": 0.015}]}).json()
    assert (e["items"][0]["unitPrice"], e["declaredValue"]) == (0.015, 46.28)

    bad = client.put(f"/api/awbs/{a['number']}/customs", headers=staff, json={"invoiceType": "Sample", "items": []})
    assert bad.status_code == 422
    bad = client.put(f"/api/awbs/{a['number']}/customs", headers=staff, json={"items": [{"description": "X", "quantity": 0, "unitPrice": 1}]})
    assert bad.status_code == 422
