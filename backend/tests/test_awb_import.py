from datetime import datetime
from io import BytesIO

from openpyxl import Workbook


def sheet_bytes(rows):
    wb = Workbook()
    ws = wb.active
    ws.append([])  # blank first row, like the office sheets
    for r in rows:
        ws.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def upload(client, headers, rows, name="daily.xlsx"):
    files = {"file": (name, sheet_bytes(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    return client.post("/api/awb-import/preview", headers=headers, files=files)


def test_import_preview_and_commit(client, staff):
    cust = client.post("/api/customers", headers=staff, json={"name": "Raheel Leather", "phone": "0300-1234567",
                                                              "address": "Korangi", "city": "Karachi"})
    assert cust.status_code in (200, 201), cust.text
    d = datetime(2026, 11, 10)
    res = upload(client, staff, [
        [d, "9205590123456789012345", "RAHEEL LEATHER", 0.5, "USA", "ERIKA HUDSON", "WPX", "FEDEX"],
        [d, 9.20559e21, "APX CLIFF", 2.5, "USA", "KALEY ROSS", "WPX", "FEDEX"],  # rounded by Excel
        [d, "9205590123456789012345", "APX CLIFF", 1, "USA", "DUPLICATE", "WPX", "FEDEX"],
        [d, "", "APX CLIFF", None, "UK", "", "WPX", "FEDEX"],
    ])
    assert res.status_code == 200, res.text
    rows = res.json()["rows"]
    assert [r["row"] for r in rows] == [2, 3, 4, 5]
    ok, rounded, dup, bad = rows
    assert ok["errors"] == [] and ok["customerId"] and ok["country"] == "United States" and ok["date"] == "2026-11-10"
    assert rounded["errors"] == [] and rounded["tracking"] == "" and "Text" in rounded["warnings"][0]
    assert "earlier in this file" in dup["errors"][0]
    assert len(bad["errors"]) == 2 and bad["country"] == "United Kingdom"

    out = client.post("/api/awb-import/commit", headers=staff, json={"rows": rows})
    assert out.status_code == 200, out.text
    created = out.json()["created"]
    assert len(created) == 2 and len(out.json()["skipped"]) == 2

    awb = client.get(f"/api/awbs/{created[0]}", headers=staff).json()
    assert awb["carrierTracking"] == "9205590123456789012345" and awb["carrier"] == "FEDEX"
    assert awb["shipper"]["name"] == "Raheel Leather" and awb["shipper"]["city"] == "Karachi"
    assert awb["consignee"]["address"] == "" and awb["actualWeight"] == 0.5
    assert awb["createdAt"].startswith("2026-11-10")
    # The AWB list and shipments still load with the blank addresses.
    assert client.get("/api/awbs", headers=staff).status_code == 200
    assert client.get("/api/shipments", headers=staff).status_code == 200

    # Uploading the same sheet again finds the tracking number already imported.
    again = upload(client, staff, [[d, "9205590123456789012345", "X", 1, "USA", "Y", "WPX", "FEDEX"]]).json()["rows"]
    assert "Already imported" in again[0]["errors"][0]


def test_import_rejects_non_excel(client, staff):
    res = client.post("/api/awb-import/preview", headers=staff, files={"file": ("a.csv", b"a,b", "text/csv")})
    assert res.status_code == 400
