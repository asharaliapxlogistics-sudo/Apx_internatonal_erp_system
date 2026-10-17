from fastapi import APIRouter, HTTPException, status
from pydantic import Field
from sqlalchemy import func, select

from app.deps import AdminUser, DbSession, StaffUser
from app.models import Setting
from app.schemas.common import CamelModel
from app.schemas.validators import Ntn, OptionalEmail, OptionalPkPhone, letters
from app.services.audit import changes, record
from app.services.numbers import SERIES, account_no, expense_no, invoice_no

router = APIRouter(prefix="/api/settings", tags=["settings"])

COMPANY_FIELDS = ("name", "office", "phone", "email", "ntn")
# Readable names for the audit log.
LABELS = {
    "company_name": "company name",
    "company_office": "office address",
    "company_phone": "phone",
    "company_email": "email",
    "company_ntn": "NTN",
    "tracking_url": "tracking page",
    "awb_first_number": "AWB series",
    "customer_first_account": "customer series",
    "invoice_first_number": "invoice series",
    "expense_first_number": "expense series",
}
SERIES_INFO = {
    "awb": ("Air waybill numbers", str),
    "customer": ("Customer account numbers", account_no),
    "invoice": ("Invoice numbers", invoice_no),
    "expense": ("Expense voucher numbers", expense_no),
}


class Company(CamelModel):
    name: letters("Company name") = Field(min_length=1, max_length=120)
    office: str = Field(default="", max_length=255)
    phone: OptionalPkPhone = Field(default="", max_length=60)
    email: OptionalEmail = Field(default="", max_length=190)
    ntn: Ntn = Field(default="", max_length=30)


class SettingsIn(CamelModel):
    company: Company
    tracking_url: str = Field(default="", max_length=255)
    # New first number per series (awb, customer, invoice, expense); leave out to keep it.
    series: dict[str, int] = {}


def _values(db: DbSession) -> dict[str, str]:
    return dict(db.execute(select(Setting.key, Setting.value)).all())


def _set(db: DbSession, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


def _last_used(db: DbSession, series: str) -> int:
    return int(db.scalar(select(func.max(SERIES[series][1]))) or 0)


def _out(db: DbSession) -> dict:
    v = _values(db)
    series = []
    for key, (label, fmt) in SERIES_INFO.items():
        first = int(v.get(SERIES[key][0], "1"))
        last = _last_used(db, key)
        nxt = max(last, first - 1) + 1
        series.append({"key": key, "label": label, "first": first, "lastUsed": last or None, "next": nxt, "nextLabel": fmt(nxt)})
    return {
        "company": {f: v.get(f"company_{f}", "") for f in COMPANY_FIELDS},
        "trackingUrl": v.get("tracking_url", ""),
        "series": series,
    }


@router.get("")
def get_settings(_: StaffUser, db: DbSession):
    """Readable by all staff: invoices, vouchers and AWBs print the company details."""
    return _out(db)


@router.put("")
def update_settings(body: SettingsIn, user: AdminUser, db: DbSession):
    before = _values(db)
    after = {f"company_{f}": getattr(body.company, f).strip() for f in COMPANY_FIELDS}
    after["tracking_url"] = body.tracking_url.strip()
    if after["tracking_url"] and not after["tracking_url"].startswith(("http://", "https://")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The tracking page address must start with http:// or https://")

    for key, first in body.series.items():
        if key not in SERIES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown number series: {key}")
        setting_key = SERIES[key][0]
        if str(first) == before.get(setting_key):
            continue
        last = _last_used(db, key)
        if first < 1 or first <= last:
            label, fmt = SERIES_INFO[key]
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"{label} already go up to {fmt(last)}, so the series must start above that."
                if last
                else f"{label} must start at 1 or more.",
            )
        after[setting_key] = str(first)

    diff = changes(before, after)
    for key, value in after.items():
        _set(db, key, value)
    if diff:
        named = {LABELS.get(k, k): v for k, v in diff.items()}
        record(db, user, "settings.update", "settings", "", f"Changed {', '.join(sorted(named))}", {"changes": named})
    db.commit()
    return _out(db)
