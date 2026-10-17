# Importing every model here registers it on Base.metadata (used by Alembic).
from app.models.address import Address
from app.models.audit import AuditLog
from app.models.awb import Awb, AwbItem, AwbPiece, TrackingEvent
from app.models.complaint import Complaint, ComplaintMessage
from app.models.customer import Customer
from app.models.daily_address import DailyAddress
from app.models.expense import Expense
from app.models.invoice import Invoice, InvoiceLine, Payment
from app.models.setting import Setting
from app.models.user import User

__all__ = [
    "Address",
    "AuditLog",
    "Awb",
    "AwbItem",
    "AwbPiece",
    "Complaint",
    "ComplaintMessage",
    "Customer",
    "DailyAddress",
    "Expense",
    "Invoice",
    "InvoiceLine",
    "Payment",
    "Setting",
    "TrackingEvent",
    "User",
]
