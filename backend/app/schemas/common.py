from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel

from app.config import settings

OFFICE_TZ = ZoneInfo(settings.timezone)


class CamelModel(BaseModel):
    """JSON uses camelCase (like the frontend); Python uses snake_case."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


def _utc_iso(d: datetime) -> str:
    return d.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")


# Stored as naive UTC; sent with a trailing Z so the browser shows it in local time.
UtcDateTime = Annotated[datetime, PlainSerializer(_utc_iso, return_type=str)]

# Wall-clock time typed by staff (tracking updates), sent as "YYYY-MM-DDTHH:MM" without a zone,
# which is what <input type="datetime-local"> uses.
LocalDateTime = Annotated[datetime, PlainSerializer(lambda d: d.strftime("%Y-%m-%dT%H:%M"), return_type=str)]

# Decimals in the database, plain JSON numbers in the API.
Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2), PlainSerializer(float, return_type=float)]
Weight = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=3), PlainSerializer(float, return_type=float)]
Dimension = Annotated[Decimal, Field(ge=0, max_digits=8, decimal_places=2), PlainSerializer(float, return_type=float)]


def office_now() -> datetime:
    """Current office wall-clock time (naive)."""
    return datetime.now(OFFICE_TZ).replace(tzinfo=None)


def utc_to_office(d: datetime) -> datetime:
    return d.replace(tzinfo=UTC).astimezone(OFFICE_TZ).replace(tzinfo=None)


def office_day_bounds_utc(day=None) -> tuple[datetime, datetime]:
    """Start and end (naive UTC) of an office calendar day, for filtering created_at."""
    day = day or office_now().date()
    start = datetime(day.year, day.month, day.day, tzinfo=OFFICE_TZ)
    end = start.replace(hour=23, minute=59, second=59, microsecond=999999)
    return start.astimezone(UTC).replace(tzinfo=None), end.astimezone(UTC).replace(tzinfo=None)
