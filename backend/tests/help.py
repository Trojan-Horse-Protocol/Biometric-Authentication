import secrets
from backend.app.model import Credential, User


def make_user(db, name, role="member", passkeys=1):
    u = User(username=name, handle=secrets.token_bytes(32), role=role)
    for _ in range(passkeys):
        u.credentials.append(Credential(credential_id=secrets.token_bytes(16), public_key=b"x"))
    db.add(u)
    db.commit()
    return u