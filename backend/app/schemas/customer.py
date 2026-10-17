from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import CamelModel, UtcDateTime
from app.schemas.validators import Cnic, Ntn, OptionalEmail, PkPhone, Strn, is_pakistan, letters, pk_postal

CustomerType = Literal["Corporate", "E-commerce", "Walk-in"]


class CustomerIn(CamelModel):
    type: CustomerType = "Corporate"
    name: letters("Company name") = Field(min_length=1, max_length=190)
    contact_person: letters("Contact person") = Field(default="", max_length=120)
    phone: PkPhone = Field(max_length=40)
    email: OptionalEmail = Field(default="", max_length=190)
    address: str = Field(default="", max_length=255)
    city: letters("City") = Field(min_length=1, max_length=80)
    zip: str = Field(default="", max_length=20)
    country: str = Field(default="Pakistan", min_length=1, max_length=80)
    ntn: Ntn = Field(default="", max_length=30)
    strn: Strn = Field(default="", max_length=30)
    cnic: Cnic = Field(default="", max_length=20)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def check(self):
        if not self.name or not self.city:
            raise ValueError("Company name and city are required.")
        if is_pakistan(self.country):
            self.zip = pk_postal(self.zip)
        return self


class CustomerOut(CamelModel):
    """What is stored, as it is: no input checks, so older records always load."""

    id: str
    account_seq: int
    account_no: str
    type: CustomerType
    name: str
    contact_person: str
    phone: str
    email: str
    address: str
    city: str
    zip: str
    country: str
    ntn: str
    strn: str
    cnic: str
    notes: str
    created_at: UtcDateTime
    updated_at: UtcDateTime | None
