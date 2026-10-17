"""Admin commands, run from the backend folder:

    .venv\\Scripts\\python.exe -m app.cli create-admin --name "Your Name" --username your_name
"""

import argparse
import getpass
import secrets
import sys

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.schemas.validators import username as clean_username
from app.security import hash_password


def create_admin(name: str, username: str, generate: bool) -> None:
    try:
        username = clean_username(username)
    except ValueError as e:
        sys.exit(str(e))
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.username == username)):
            sys.exit(f"The username {username} is already taken.")

        if generate:
            password = secrets.token_urlsafe(12)
        else:
            password = getpass.getpass("Password (min 8 characters): ")
            if len(password) < 8:
                sys.exit("Password must be at least 8 characters.")
            if password != getpass.getpass("Repeat password: "):
                sys.exit("Passwords do not match.")

        db.add(User(name=name.strip(), username=username, password_hash=hash_password(password), role="admin"))
        db.commit()

    print(f"Admin account created: {username}")
    if generate:
        print(f"Temporary password: {password}")
        print("Sign in and change it from your profile menu.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-admin", help="Create an admin login")
    p.add_argument("--name", required=True)
    p.add_argument("--username", required=True)
    p.add_argument("--generate-password", action="store_true", help="Generate a temporary password instead of asking")
    args = parser.parse_args()

    if args.command == "create-admin":
        create_admin(args.name, args.username, args.generate_password)


if __name__ == "__main__":
    main()
