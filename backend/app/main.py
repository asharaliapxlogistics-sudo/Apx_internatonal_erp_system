from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import engine
from app.routers import audit, auth, awbs, complaints, customers, daily_addresses, dashboard, expenses, invoices, portal, reports, settings as settings_router, shipments, users

app = FastAPI(title="APX ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


for module in (auth, users, customers, awbs, shipments, invoices, expenses, dashboard, reports, settings_router, audit, portal):
    app.include_router(module.router)
app.include_router(portal.public)
app.include_router(daily_addresses.portal)
app.include_router(daily_addresses.staff)
app.include_router(complaints.portal)
app.include_router(complaints.staff)


@app.get("/api/health")
def health():
    """Shows whether the API is up and can reach MySQL."""
    try:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT VERSION()")).scalar()
        return {"api": "ok", "database": "ok", "mysql": version}
    except SQLAlchemyError as e:
        return {"api": "ok", "database": "error", "detail": str(e.orig if hasattr(e, "orig") else e)}
