# APX ERP backend

FastAPI + SQLAlchemy + MySQL. Tables are managed with Alembic migrations.

## Run locally

1. Start MySQL: double-click `start-mysql.cmd` in the project folder (port 3307, keep the window open).
2. Start the API (from the `backend` folder):

   ```
   .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```

3. Check http://localhost:8000/api/health and the API docs at http://localhost:8000/docs.

Settings come from `backend/.env` (see `.env.example`). Never commit `.env`.

## Logins

Passwords are stored as Argon2 hashes. Signing in returns a JWT (12 hours, or 30 days with
"Keep me signed in"); `JWT_SECRET` in `.env` signs it. Five wrong passwords lock that username
for 15 minutes from the same address.

Create an admin (asks for the password; add `--generate-password` to print a temporary one):

```
.venv\Scripts\python.exe -m app.cli create-admin --name "Your Name" --username your_name
```

Admins manage other accounts through `/api/users` (see http://localhost:8000/docs).

## API

All endpoints are under `/api` and need a login token, except `/api/auth/login` and `/api/health`.
JSON uses camelCase like the frontend. Full list and a try-it page: http://localhost:8000/docs

| Module | Endpoints |
|---|---|
| Customers | `GET/POST /customers`, `GET/PUT/DELETE /customers/{id}` |
| Air waybills | `GET/POST /awbs`, `GET/DELETE /awbs/{number}`, `POST /awbs/{number}/void` |
| Shipments | `GET /shipments`, `GET /shipments/{number}`, `POST /shipments/events` (one or many AWBs), `DELETE /shipments/{number}/events/{id}`, `PUT /shipments/{number}/carrier` |
| Invoices | `GET/POST /invoices`, `GET/DELETE /invoices/{id}`, `POST /invoices/{id}/payments`, `POST /invoices/{id}/status`, `GET /invoices/last-outstanding` |
| Expenses | `GET/POST /expenses` (`from`, `to`, `category` filters), `GET/PUT/DELETE /expenses/{id}` |
| Dashboard | `GET /dashboard` (`customerId` to scope) |
| Settings | `GET /settings` (staff: company details for printing), `PUT /settings` (admins) |
| Audit log (admins) | `GET /audit` (`from`, `to`, `userId`, `entity`, `q`, `limit`, `offset`) |
| Reports (admins) | `GET /reports/shipments`, `/reports/sales`, `/reports/balances`, `/reports/expenses`, `/reports/profit-loss` (`from`, `to`, `customerId`) |

A customer's balance is the outstanding on their **latest** invoice: each new invoice carries the
previous outstanding forward, so adding up every invoice would count the same money twice
(see `services/balances.py`).

Numbers (APX-1001, AWB 10257080…, INV-00001, EXP-00001) are issued by the server; a lock on the
series row in `settings` stops two simultaneous saves getting the same number.

## Tests

Tests use a separate `apx_erp_test` database (created once; the suite migrates and empties it):

```
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m pytest
```

## Database changes

After changing a model in `app/models/`:

```
.venv\Scripts\alembic.exe revision --autogenerate -m "what changed"
.venv\Scripts\alembic.exe upgrade head
```

Read the generated file in `alembic/versions/` before running it. On Railway, run
`alembic upgrade head` before starting the API on each deploy.

## Tables

| Table | Holds |
|---|---|
| users | Staff/admin logins, later customer-portal logins |
| customers | Customer accounts (APX-1001…) |
| awbs, awb_pieces | Airway bills and their pieces; carrier tracking number |
| tracking_events | Shipment status updates ("Booked" comes from the AWB itself) |
| invoices, invoice_lines, payments | Billing |
| expenses | Office expenses |
| settings | Number series (awb_first_number, customer_first_account) |
