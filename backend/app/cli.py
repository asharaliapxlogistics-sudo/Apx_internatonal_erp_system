"""Admin commands, run from the backend folder:

    .venv\\Scripts\\python.exe -m app.cli create-admin --name "Your Name" --email you@example.com
"""

import argparse
import getpass
import secrets
import sys

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import User
from app.security import hash_password


def create_admin(name: str, email: str, generate: bool) -> None:
    email = email.strip().lower()
    with SessionLocal() as db:
        if db.scalar(select(User).where(func.lower(User.email) == email)):
            sys.exit(f"A user with email {email} already exists.")

        if generate:
            password = secrets.token_urlsafe(12)
        else:
            password = getpass.getpass("Password (min 8 characters): ")
            if len(password) < 8:
                sys.exit("Password must be at least 8 characters.")
            if password != getpass.getpass("Repeat password: "):
                sys.exit("Passwords do not match.")

        db.add(User(name=name.strip(), email=email, password_hash=hash_password(password), role="admin"))
        db.commit()

    print(f"Admin account created for {email}.")
    if generate:
        print(f"Temporary password: {password}")
        print("Sign in and change it from your profile menu.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-admin", help="Create an admin login")
    p.add_argument("--name", required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--generate-password", action="store_true", help="Generate a temporary password instead of asking")
    args = parser.parse_args()

    if args.command == "create-admin":
        create_admin(args.name, args.email, args.generate_password)


if __name__ == "__main__":
    main()
