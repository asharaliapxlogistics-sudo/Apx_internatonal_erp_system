from app.models import Awb
from app.schemas.common import utc_to_office

# Shipment journey in order, with the group used by dashboard cards and list filters.
# Keep in step with frontend/src/lib/tracking.js.
STATUS_GROUPS = {
    "Booked": "booked",
    "Picked up": "booked",
    "At APX hub": "booked",
    "Departed origin": "transit",
    "In transit": "transit",
    "Arrived destination": "transit",
    "Customs hold": "customs",
    "Customs cleared": "transit",
    "Out for delivery": "transit",
    "Delivered": "delivered",
    "Exception": "exception",
    "Returned": "exception",
}
# Staff add every status except Booked, which comes from creating the AWB.
UPDATE_STATUSES = [s for s in STATUS_GROUPS if s != "Booked"]
NEEDS_REMARKS = {"Customs hold", "Exception", "Returned"}


def timeline(awb: Awb) -> list[dict]:
    """Events oldest first, starting with the automatic "Booked" event."""
    booked = {
        "id": "booked",
        "status": "Booked",
        "at": utc_to_office(awb.created_at).replace(second=0, microsecond=0),
        "location": awb.shipper_city,
        "remarks": "Airway bill created",
        "by": "",
        "auto": True,
        "created_at": awb.created_at,
    }
    events = [
        {
            "id": e.id,
            "status": e.status,
            "at": e.at,
            "location": e.location,
            "remarks": e.remarks,
            "by": e.created_by_name,
            "auto": False,
            "created_at": e.created_at,
        }
        for e in awb.events
    ]
    return sorted([booked, *events], key=lambda e: (e["at"], e["created_at"]))


def group_of(status: str) -> str:
    return STATUS_GROUPS.get(status, "booked")
