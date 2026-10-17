"""Checks for values typed into forms: Pakistani phone numbers, CNIC, NTN, STRN, postal codes, emails.
Each returns the cleaned value or raises ValueError with a message the user can act on.
Keep in step with frontend/src/lib/validation.js."""

import re
from typing import Annotated

from pydantic import AfterValidator
from pydantic import validate_email as _validate_email

_PK_PREFIX = re.compile(r"^(?:\+92|0092|92)")


def _digits(v: str) -> str:
    return re.sub(r"\D", "", v)


def is_pk_phone(v: str) -> bool:
    """Mobile 03XX-XXXXXXX, landline 0XX-XXXXXXX(X), UAN 111-XXX-XXX; +92 / 0092 / 92 prefixes allowed."""
    raw = re.sub(r"[\s\-().]", "", v)
    if not re.fullmatch(r"\+?\d+", raw):
        return False
    if raw.startswith("111"):
        return bool(re.fullmatch(r"111\d{6}", raw))
    national = _PK_PREFIX.sub("0", raw, count=1)
    if national.startswith("03"):
        return bool(re.fullmatch(r"03\d{9}", national))  # 0300-1234567
    return bool(re.fullmatch(r"0[124-9]\d{7,9}", national))  # 021-34567890, 051-1234567, 0992-123456


def pk_phone(v: str) -> str:
    v = v.strip()
    if not is_pk_phone(v):
        raise ValueError("Enter a valid Pakistani phone number, e.g. 0300-1234567 or 021-34567890.")
    return v


def any_phone(v: str) -> str:
    """International number: digits with optional +, spaces, dashes or brackets; 7 to 15 digits."""
    v = v.strip()
    if not re.fullmatch(r"\+?[\d\s\-().]+", v) or not 7 <= len(_digits(v)) <= 15:
        raise ValueError("Enter a valid phone number with country code, e.g. +44 7700 900123.")
    return v


def phone_for(country: str, v: str) -> str:
    return pk_phone(v) if is_pakistan(country) else any_phone(v)


def is_pakistan(country: str) -> bool:
    return country.strip().lower() in ("pakistan", "pk")


def cnic(v: str) -> str:
    v = v.strip()
    if v and not re.fullmatch(r"\d{5}-?\d{7}-?\d", v):
        raise ValueError("CNIC must be 13 digits, e.g. 42101-1234567-1.")
    return v


def ntn(v: str) -> str:
    """NTN is 7 digits with a check digit (1234567-8); individuals may use their 13-digit CNIC."""
    v = v.strip()
    if v and not (re.fullmatch(r"\d{7}(-?\d)?", v) or re.fullmatch(r"\d{5}-?\d{7}-?\d", v)):
        raise ValueError("NTN must look like 1234567-8, or a 13-digit CNIC.")
    return v


def ntn_or_cnic(v: str) -> str:
    v = v.strip()
    if v and not (re.fullmatch(r"\d{7}(-?\d)?", v) or re.fullmatch(r"\d{5}-?\d{7}-?\d", v)):
        raise ValueError("NTN / CNIC must be a 13-digit CNIC (42101-1234567-1) or an NTN (1234567-8).")
    return v


def strn(v: str) -> str:
    v = v.strip()
    if v and not (re.fullmatch(r"[\d\s-]+", v) and len(_digits(v)) == 13):
        raise ValueError("STRN must be 13 digits.")
    return v


def pk_postal(v: str) -> str:
    v = v.strip()
    if v and not re.fullmatch(r"\d{5}", v):
        raise ValueError("Pakistani postal codes are 5 digits, e.g. 75500.")
    return v


def optional_email(v: str) -> str:
    v = v.strip()
    if v:
        try:
            _validate_email(v)
        except Exception:
            raise ValueError("Enter a valid email address.") from None
    return v.lower()


def text_with_letters(label: str):
    """Names and cities must contain letters, not only numbers or symbols."""

    def check(v: str) -> str:
        v = " ".join(v.split())
        if v and not re.search(r"[^\W\d_]", v):
            raise ValueError(f"{label} must contain letters.")
        return v

    return check


OptionalEmail = Annotated[str, AfterValidator(optional_email)]


def letters(label: str):
    return Annotated[str, AfterValidator(text_with_letters(label))]


PkPhone = Annotated[str, AfterValidator(pk_phone)]
OptionalPkPhone = Annotated[str, AfterValidator(lambda v: pk_phone(v) if v.strip() else "")]
Cnic = Annotated[str, AfterValidator(cnic)]
Ntn = Annotated[str, AfterValidator(ntn)]
NtnOrCnic = Annotated[str, AfterValidator(ntn_or_cnic)]
Strn = Annotated[str, AfterValidator(strn)]
