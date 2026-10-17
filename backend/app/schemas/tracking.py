from datetime import datetime

from pydantic import Field, model_validator

from app.schemas.awb import AwbOut
from app.schemas.common import CamelModel, LocalDateTime
from app.services.tracking import NEEDS_REMARKS, UPDATE_STATUSES


class EventOut(CamelModel):
    id: str
    status: str
    at: LocalDateTime
    location: str
    remarks: str
    by: str
    auto: bool


class ShipmentOut(CamelModel):
    awb: AwbOut
    carrier: str
    carrier_tracking: str
    events: list[EventOut]  # oldest first
    last: EventOut
    status: str
    group: str  # booked / transit / customs / delivered / exception


class EventIn(CamelModel):
    """One status update applied to one or more AWBs."""

    numbers: list[str] = Field(min_length=1, max_length=500)
    status: str
    at: datetime  # office wall-clock time
    location: str = Field(default="", max_length=120)
    remarks: str = Field(default="", max_length=255)

    @model_validator(mode="after")
    def check(self):
        if self.status not in UPDATE_STATUSES:
            raise ValueError(f"Unknown status. Use one of: {', '.join(UPDATE_STATUSES)}")
        if self.status in NEEDS_REMARKS and not self.remarks.strip():
            raise ValueError(f"Remarks are required for {self.status}.")
        self.at = self.at.replace(tzinfo=None, second=0, microsecond=0)
        self.numbers = list(dict.fromkeys(n.strip() for n in self.numbers if n.strip()))
        if not self.numbers:
            raise ValueError("Enter at least one AWB number.")
        return self


class CarrierIn(CamelModel):
    carrier: str = Field(default="", max_length=40)
    carrier_tracking: str = Field(default="", max_length=255)
