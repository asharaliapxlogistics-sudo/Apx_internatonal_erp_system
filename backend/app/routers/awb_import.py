"""Import shipments from an Excel sheet: each row becomes an AWB.

Columns, by position (a header row is optional):
A date | B tracking no. | C shipper | D weight (kg) | E country | F consignee | G service | H carrier
"""

from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from pydantic import Field
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, StaffUser
from app.models import Awb, AwbPiece, Customer
from app.schemas.awb import AwbOut, awb_out
from app.schemas.common import OFFICE_TZ, CamelModel, office_day_bounds_utc, office_now, utc_to_office
from app.services.audit import record
from app.services.numbers import next_number

router = APIRouter(prefix="/api/awb-import", tags=["air waybills"])

FIRST_DAY = date(2026, 7, 1)  # imported sheets start from July 2026
MAX_ROWS = 2000
MAX_BYTES = 10 * 1024 * 1024

# Short country names used on the sheets -> the names the AWB forms use.
COUNTRY_NAMES = {
    "USA": "United States", "US": "United States", "U.S.A": "United States", "UNITED STATES OF AMERICA": "United States",
    "UK": "United Kingdom", "U.K": "United Kingdom", "GB": "United Kingdom", "ENGLAND": "United Kingdom",
    "UAE": "United Arab Emirates", "U.A.E": "United Arab Emirates", "KSA": "Saudi Arabia",
    "CA": "Canada", "CAN": "Canada", "AUS": "Australia", "AU": "Australia", "PK": "Pakistan", "PAK": "Pakistan",
}

HEADER_WORDS = ("date", "tracking", "shipper", "weight", "consignee", "country", "service", "carrier", "name")


class ImportRow(CamelModel):
    sheet: str = ""
    row: int = 0
    date: date
    tracking: str = Field(default="", max_length=255)
    shipper: str = Field(default="", max_length=190)
    weight: Decimal | None = None
    country: str = Field(default="", max_length=80)
    consignee: str = Field(default="", max_length=190)
    service: str = Field(default="", max_length=60)
    carrier: str = Field(default="", max_length=40)
    customer_id: str | None = None
    customer_name: str = ""
    errors: list[str] = []
    warnings: list[str] = []


class PreviewOut(CamelModel):
    file_name: str
    rows: list[ImportRow]


class CommitIn(CamelModel):
    file_name: str = Field(default="", max_length=190)
    rows: list[ImportRow] = Field(min_length=1, max_length=MAX_ROWS)


class CommitOut(CamelModel):
    created: list[str]  # AWB numbers
    skipped: list[str]  # why each row was left out


def text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return " ".join(str(v).split())


def parse_date(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = text(v)
    for fmt in ("%d-%b-%y", "%d-%b-%Y", "%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def parse_tracking(v) -> tuple[str, str | None]:
    """Tracking number as text, plus a warning when Excel has already rounded it."""
    if v is None:
        return "", None
    if isinstance(v, bool):
        return "", None
    if isinstance(v, (int, float)):
        # Excel keeps only 15 digits of a number, so longer tracking numbers stored as numbers
        # (shown as 9.20559E+21) have lost their last digits for good.
        if isinstance(v, float) and (not v.is_integer() or abs(v) >= 1e15):
            return "", (
                f"Tracking number was saved as a number in Excel ({v:.6g}) and its digits are lost. "
                "Format column B as Text and type it again, or add it later on the AWB."
            )
        if isinstance(v, int) and abs(v) >= 10**15:
            return "", "Tracking number was saved as a number in Excel and its digits may be lost. Format column B as Text."
        return str(int(v)), None
    return text(v).replace(" ", ""), None


def parse_weight(v) -> Decimal | None:
    try:
        d = Decimal(text(v).replace("kg", "").replace("KG", "").strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d.is_finite() else None


def is_header(cells: list) -> bool:
    joined = " ".join(text(c).lower() for c in cells)
    return parse_weight(cells[3]) is None and sum(w in joined for w in HEADER_WORDS) >= 2


def check_row(r: ImportRow, db: DbSession, customers: dict[str, Customer], seen: set[str]) -> ImportRow:
    """Fills customer match, errors and warnings. Rows with errors are not imported."""
    r.errors, r.warnings = [], []
    if r.date < FIRST_DAY:
        r.errors.append("Date is before July 2026.")
    if not r.consignee:
        r.errors.append("Consignee name is missing.")
    if r.weight is None or r.weight <= 0:
        r.errors.append("Weight (kg) is missing or not a number.")
    elif r.weight > 5000:
        r.errors.append("Weight looks too high. Check the kg value.")
    if not r.country:
        r.errors.append("Destination country is missing.")
    if not r.service:
        r.errors.append("Service is missing.")

    customer = customers.get(r.shipper.lower()) if r.shipper else None
    r.customer_id = customer.id if customer else None
    r.customer_name = customer.name if customer else ""
    if not r.shipper:
        r.errors.append("Shipper name is missing.")
    elif not customer:
        r.warnings.append("No customer account with this name. The AWB will be saved without an account.")

    if r.tracking:
        key = r.tracking.lower()
        if key in seen:
            r.errors.append("Same tracking number appears earlier in this file.")
        elif db.scalar(select(Awb.number).where(Awb.carrier_tracking == r.tracking).limit(1)):
            r.errors.append("Already imported: an AWB with this tracking number exists.")
        seen.add(key)
    return r


def customer_map(db: DbSession) -> dict[str, Customer]:
    return {c.name.strip().lower(): c for c in db.scalars(select(Customer))}


@router.post("/preview", response_model=PreviewOut)
async def preview(file: UploadFile, _: StaffUser, db: DbSession):
    """Reads the sheet and shows what would be imported. Nothing is saved."""
    name = file.filename or "file.xlsx"
    if not name.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload an Excel file (.xlsx). Old .xls files: open in Excel and Save As .xlsx.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is too large (max 10 MB).")
    try:
        wb = load_workbook(BytesIO(data), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read this file. Make sure it is a valid .xlsx Excel file.")

    customers = customer_map(db)
    seen: set[str] = set()
    rows: list[ImportRow] = []
    today = office_now().date()
    for ws in wb.worksheets:
        for n, values in enumerate(ws.iter_rows(max_col=8, values_only=True), start=1):
            cells = list(values) + [None] * (8 - len(values))
            if all(text(c) == "" for c in cells) or is_header(cells):
                continue
            tracking, tracking_warning = parse_tracking(cells[1])
            country = text(cells[4])
            r = ImportRow(
                sheet=ws.title,
                row=n,
                date=parse_date(cells[0]) or today,
                tracking=tracking,
                shipper=text(cells[2]),
                weight=parse_weight(cells[3]),
                country=COUNTRY_NAMES.get(country.upper().rstrip("."), country),
                consignee=text(cells[5]),
                service=text(cells[6]).upper(),
                carrier=text(cells[7]).upper(),
            )
            check_row(r, db, customers, seen)
            if tracking_warning:
                r.warnings.insert(0, tracking_warning)
            if parse_date(cells[0]) is None:
                r.warnings.append(f"Date not readable ({text(cells[0]) or 'empty'}); today's date will be used.")
            rows.append(r)
            if len(rows) > MAX_ROWS:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Too many rows (max {MAX_ROWS} per file).")
    wb.close()
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No shipment rows found in this file.")
    return PreviewOut(file_name=name, rows=rows)


def find_imported(
    db: DbSession,
    q: str = "",
    date_from: date = Query(FIRST_DAY, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    customer_id: str | None = Query(None, alias="customerId"),
) -> list[Awb]:
    """AWBs made by Excel import, newest first, filtered by booking date and a search."""
    date_from = max(date_from, FIRST_DAY)
    date_to = date_to or office_now().date()
    if date_to < date_from:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The 'to' date is before the 'from' date.")
    start, _end = office_day_bounds_utc(date_from)
    _start, end = office_day_bounds_utc(date_to)
    stmt = (
        select(Awb).options(selectinload(Awb.pieces))
        .where(Awb.import_file != "", Awb.created_at >= start, Awb.created_at <= end)
        .order_by(Awb.created_at.desc(), Awb.number.desc())
    )
    if customer_id:
        stmt = stmt.where(Awb.customer_id == customer_id)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(
            Awb.number.like(like), Awb.carrier_tracking.like(like), Awb.shipper_name.like(like),
            Awb.consignee_name.like(like), Awb.consignee_country.like(like), Awb.service.like(like),
            Awb.carrier.like(like), Awb.import_file.like(like),
        ))
    return list(db.scalars(stmt))


Imported = Annotated[list[Awb], Depends(find_imported)]


@router.get("/awbs", response_model=list[AwbOut])
def imported_awbs(_: StaffUser, awbs: Imported):
    return [awb_out(a) for a in awbs]


EXPORT_HEADINGS = ["Date", "Tracking No.", "Shipper", "Weight (kg)", "Country", "Consignee", "Service", "Carrier", "AWB #"]


def sheet_title(name: str, used: set[str]) -> str:
    """Excel tab name: no []:*?/\\ characters, at most 31 long, unique in the workbook."""
    base = "".join("_" if ch in '[]:*?/\\' else ch for ch in name.rsplit(".", 1)[0]).strip() or "Sheet"
    title, n = base[:31], 2
    while title.lower() in used:
        suffix = f" ({n})"
        title, n = base[: 31 - len(suffix)] + suffix, n + 1
    used.add(title.lower())
    return title


@router.get("/export")
def export_imported(_: StaffUser, awbs: Imported):
    """The imported shipments as an Excel file, one tab per imported sheet, in the import column order."""
    groups: dict[str, list[Awb]] = {}
    for a in reversed(awbs):  # oldest first, rows in sheet order
        groups.setdefault(a.import_file, []).append(a)

    wb = Workbook()
    wb.remove(wb.active)
    used: set[str] = set()
    for file, rows in groups.items() or {"No shipments": []}.items():
        ws = wb.create_sheet(sheet_title(file, used))
        ws.append(EXPORT_HEADINGS)
        for cell in ws[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="0F766E")
        for a in rows:
            ws.append([
                utc_to_office(a.created_at).date(), a.carrier_tracking, a.shipper_name, float(a.actual_weight),
                a.consignee_country, a.consignee_name, a.service, a.carrier, a.number,
            ])
            r = ws.max_row
            ws.cell(r, 1).number_format = "DD-MMM-YY"
            ws.cell(r, 2).number_format = "@"  # tracking stays text, never 9.2E+21
            ws.cell(r, 9).number_format = "@"
        if rows:
            ws.append(["Total", f"{len(rows)} shipments", "", float(sum(a.actual_weight for a in rows))])
            for cell in ws[ws.max_row]:
                cell.font = Font(bold=True)
        for col, width in zip("ABCDEFGHI", (12, 26, 22, 12, 16, 26, 12, 12, 12)):
            ws.column_dimensions[col].width = width
        ws.freeze_panes = "A2"

    buf = BytesIO()
    wb.save(buf)
    stamp = office_now().strftime("%Y-%m-%d")
    return Response(
        buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="imported-shipments-{stamp}.xlsx"'},
    )


def booked_at(day: date) -> datetime:
    """Midday office time on the sheet's date, as naive UTC, so the AWB lands on that day's list."""
    return datetime(day.year, day.month, day.day, 12, tzinfo=OFFICE_TZ).astimezone(UTC).replace(tzinfo=None)


@router.post("/commit", response_model=CommitOut)
def commit(body: CommitIn, user: StaffUser, db: DbSession):
    """Saves the previewed rows as AWBs. Rows are checked again; rows with problems are skipped."""
    customers = customer_map(db)
    by_id = {c.id: c for c in customers.values()}
    seen: set[str] = set()
    created, skipped = [], []
    file_name = body.file_name.strip() or "Excel import"
    number = next_number(db, "awb")
    for r in body.rows:
        check_row(r, db, customers, seen)
        label = f"{r.sheet} row {r.row}" if r.sheet else f"Row {r.row}"
        if r.errors:
            skipped.append(f"{label} ({r.consignee or 'no consignee'}): {' '.join(r.errors)}")
            continue
        c = by_id.get(r.customer_id) if r.customer_id else None
        awb = Awb(
            number=str(number),
            customer_id=c.id if c else None,
            account_no=c.account_no if c else "",
            service=r.service,
            actual_weight=r.weight,
            product_detail="",
            shipper_name=c.name if c else r.shipper,
            shipper_company=c.name if c else "",
            shipper_address=c.address if c else "",
            shipper_city=c.city if c else "",
            shipper_zip=c.zip if c else "",
            shipper_country=c.country if c else "Pakistan",
            shipper_phone=c.phone if c else "",
            shipper_email=c.email if c else "",
            shipper_ntn_cnic=(c.ntn or c.cnic) if c else "",
            consignee_name=r.consignee,
            consignee_address="",
            consignee_city="",
            consignee_country=r.country,
            consignee_phone="",
            carrier=r.carrier,
            carrier_tracking=r.tracking,
            import_file=file_name,
            created_by=user.id,
            created_at=booked_at(r.date),
            pieces=[AwbPiece(position=0)],
        )
        db.add(awb)
        created.append(awb.number)
        number += 1
    if created:
        record(db, user, "awb.import", "awb", created[0],
               f"Imported {len(created)} AWBs from {file_name} ({created[0]} to {created[-1]}), {len(skipped)} rows skipped")
    db.commit()
    return CommitOut(created=created, skipped=skipped)
