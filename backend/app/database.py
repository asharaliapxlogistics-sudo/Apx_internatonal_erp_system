from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    URL.create(
        "mysql+pymysql",
        username=settings.db_user,
        password=settings.db_password,
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
        query={"charset": "utf8mb4"},
    ),
    pool_pre_ping=True,  # MySQL drops idle connections; reconnect instead of failing
    # Each query sees the latest committed data. MySQL's default (REPEATABLE READ) would keep showing
    # a request its first snapshot, so after waiting for the number-series lock it could still read an
    # old "last number" and hand out a duplicate (see services/numbers.py).
    isolation_level="READ COMMITTED",
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
