import sys

from .database import Base, SessionLocal, engine
from .model import User


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m backend.app.bootstrap_admin <username>")
        raise SystemExit(1)

    username = sys.argv[1]

    # Ensure the database tables exist.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        existing_admin = db.query(User).filter(User.role == "admin").first()

        if existing_admin:
            print(
                f"An administrator already exists: {existing_admin.username}. "
                "Use the protected admin route to promote additional users."
            )
            raise SystemExit(1)

        user = db.query(User).filter(User.username == username).one_or_none()

        if user is None:
            print(f"User not found: {username}")
            raise SystemExit(1)

        user.role = "admin"
        db.commit()

        print(f"{username} is now the initial administrator.")

    finally:
        db.close()


if __name__ == "__main__":
    main()