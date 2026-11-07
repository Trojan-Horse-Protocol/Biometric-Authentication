
import sqlite3
import secrets
from pathlib import Path
from contextlib import closing
from datetime import datetime, timezone, timedelta


# --------------------------------------------------
# DATABASE CONFIGURATION
# --------------------------------------------------

# Database file is located in the same folder as this Python file.
DB_PATH = Path(__file__).resolve().parent / "webauthdatabaseSLP.db"


# --------------------------------------------------
# DATABASE CONNECTION
# --------------------------------------------------

def get_connection():
    db = sqlite3.connect(DB_PATH, timeout=5.0)
    db.execute("PRAGMA foreign_keys = ON")
    return db


# --------------------------------------------------
# DATABASE INITIALIZATION
# --------------------------------------------------

def initialize_database():
    with closing(get_connection()) as db:
        with db:

            # Users table
            db.execute("""
                CREATE TABLE IF NOT EXISTS users2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    webauthn_user_id BLOB NOT NULL UNIQUE,
                    role TEXT NOT NULL DEFAULT 'general user'
                )
            """)

            # Credentials table
            db.execute("""
                CREATE TABLE IF NOT EXISTS credentials3 (
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
                CREATE TABLE IF NOT EXISTS challenges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    challenge BLOB NOT NULL UNIQUE,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    expires_at TEXT NOT NULL,
                    FOREIGN KEY (user_id)
                        REFERENCES users2(id) ON DELETE CASCADE
                )
            """)


# HORSE-34: USER STORAGE FUNCTIONS

# Save a new user
def save_user(username, email, webauthn_user_id, role="general user"):
    with closing(get_connection()) as db:
        with db:
            cursor = db.execute("""
                INSERT INTO users2
                (username, email, webauthn_user_id, role)
                VALUES (?, ?, ?, ?)
            """, (
                username,
                email,
                sqlite3.Binary(webauthn_user_id),
                role
            ))

            return cursor.lastrowid


# Retrieve a user by database ID
def get_user_by_id(user_id):
    with closing(get_connection()) as db:
        cursor = db.execute("""
            SELECT id, username, email, webauthn_user_id, role
            FROM users2
            WHERE id = ?
        """, (user_id,))

        return cursor.fetchone()


# Retrieve a user by username
def get_user_by_username(username):
    with closing(get_connection()) as db:
        cursor = db.execute("""
            SELECT id, username, email, webauthn_user_id, role
            FROM users2
            WHERE username = ?
        """, (username,))

        return cursor.fetchone()


# HORSE-35: CREDENTIAL STORAGE AND LOOKUP

# Save a user's WebAuthn credential
def save_credential(credential_id, user_id, public_key):
    with closing(get_connection()) as db:
        with db:
            cursor = db.execute("""
                INSERT INTO credentials3
                (credential_id, user_id, public_key)
                VALUES (?, ?, ?)
            """, (
                sqlite3.Binary(credential_id),
                user_id,
                sqlite3.Binary(public_key)
            ))

            return cursor.lastrowid


# Retrieve all credentials belonging to a user
def get_credentials_by_user(user_id):
    with closing(get_connection()) as db:
        cursor = db.execute("""
            SELECT credential_id, public_key
            FROM credentials3
            WHERE user_id = ?
        """, (user_id,))

        return cursor.fetchall()


# Retrieve a credential using its credential ID
def get_credential_by_id(credential_id):
    with closing(get_connection()) as db:
        cursor = db.execute("""
            SELECT credential_id, user_id, public_key
            FROM credentials3
            WHERE credential_id = ?
        """, (sqlite3.Binary(credential_id),))

        return cursor.fetchone()

# HORSE-36: CHALLENGE STORAGE AND EXPIRATION

# Generate and save a random authentication challenge
def save_challenge(user_id, expiration_minutes=5):
    challenge = secrets.token_bytes(32)

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=expiration_minutes)
    )

    with closing(get_connection()) as db:
        with db:
            db.execute("""
                INSERT INTO challenges
                (user_id, challenge, expires_at)
                VALUES (?, ?, ?)
            """, (
                user_id,
                sqlite3.Binary(challenge),
                expires_at.strftime("%Y-%m-%d %H:%M:%S")
            ))

    return challenge


# Retrieve a challenge if it exists and has not expired
def get_valid_challenge(user_id, challenge):
    current_time = datetime.now(timezone.utc).strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    with closing(get_connection()) as db:
        cursor = db.execute("""
            SELECT challenge
            FROM challenges
            WHERE user_id = ?
            AND challenge = ?
            AND expires_at > ?
        """, (
            user_id,
            sqlite3.Binary(challenge),
            current_time
        ))

        return cursor.fetchone()


# Delete a challenge after successful WebAuthn verification
def delete_challenge(user_id, challenge):
    with closing(get_connection()) as db:
        with db:
            cursor = db.execute("""
                DELETE FROM challenges
                WHERE user_id = ?
                AND challenge = ?
            """, (
                user_id,
                sqlite3.Binary(challenge)
            ))

            return cursor.rowcount > 0


# Delete all expired challenges
def delete_expired_challenges():
    current_time = datetime.now(timezone.utc).strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    with closing(get_connection()) as db:
        with db:
            cursor = db.execute("""
                DELETE FROM challenges
                WHERE expires_at <= ?
            """, (current_time,))

            return cursor.rowcount

# --------------------------------------------------

if __name__ == "__main__":
    initialize_database()
    print("Database initialized successfully!")

