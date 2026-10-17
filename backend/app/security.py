import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import settings

if len(settings.jwt_secret) < 32:
    raise RuntimeError("JWT_SECRET is missing or too short. Set a long random value in backend/.env.")

ALGORITHM = "HS256"
password_hash = PasswordHash.recommended()  # Argon2

# Checked when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = password_hash.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    return password_hash.verify(password, hashed or _DUMMY_HASH) and hashed is not None


def create_token(user_id: str, remember: bool) -> tuple[str, datetime]:
    lifetime = timedelta(days=settings.remember_days) if remember else timedelta(hours=settings.token_hours)
    expires = datetime.now(UTC) + lifetime
    token = jwt.encode({"sub": user_id, "exp": expires}, settings.jwt_secret, algorithm=ALGORITHM)
    return token, expires


def read_token(token: str) -> str | None:
    """User id from a valid, unexpired token; None otherwise."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])["sub"]
    except jwt.PyJWTError:
        return None


class LoginLimiter:
    """Locks an email + IP pair after too many wrong passwords.

    Kept in memory: fine for one API instance; move to the database if the API is ever scaled out.
    """

    def __init__(self) -> None:
        self._failures: dict[str, list[float]] = defaultdict(list)

    def _recent(self, key: str) -> list[float]:
        cutoff = time.monotonic() - settings.login_lock_minutes * 60
        self._failures[key] = [t for t in self._failures[key] if t > cutoff]
        return self._failures[key]

    def is_locked(self, key: str) -> bool:
        return len(self._recent(key)) >= settings.login_max_failures

    def fail(self, key: str) -> None:
        self._recent(key).append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


login_limiter = LoginLimiter()
