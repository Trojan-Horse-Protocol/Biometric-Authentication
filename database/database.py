
import sqlite3
from pathlib import Path
from contextlib import closing

# Location of the SQLite database
DB_PATH = Path(__file__).resolve().parent / "webauthdatabaseSLP.db"


# Connect to the database
def get_connection():
    db = sqlite3.connect(DB_PATH, timeout=5.0)
    db.execute("PRAGMA foreign_keys = ON")
    return db


# Create tables if they do not already exist
def initialize_database():
    with closing(get_connection()) as db:
        with db:

            # Users table
            db.execute("""
                CREATE TABLE users2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    webauthn_user_id BLOB NOT NULL UNIQUE,
                    role TEXT NOT NULL DEFAULT 'general user'
                )
            """)

            # Credentials table
            db.execute("""
                CREATE TABLE credentials3 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    credential_id BLOB NOT NULL UNIQUE,
                    user_id INTEGER NOT NULL,
                    public_key BLOB NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id)
                        REFERENCES users2(id) ON DELETE CASCADE
                )
            """)

            # Challenges table
            db.execute("""
                CREATE TABLE challenges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    challenge BLOB NOT NULL UNIQUE,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    expires_at TEXT NOT NULL,
                    FOREIGN KEY (user_id)
                        REFERENCES users2(id) ON DELETE CASCADE
                )
            """)


# Initialize the database when this file is run directly
if __name__ == "__main__":
    initialize_database()
    print("Database initialized successfully!")
