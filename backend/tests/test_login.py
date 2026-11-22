from types import SimpleNamespace
from webauthn.helpers import bytes_to_base64url
from backend.app.model import User
from backend.app.routes import webauthn_routes
from help import make_user

#ref: https://docs.pytest.org/en/stable/how-to/usage.html, https://docs.pytest.org/en/stable/reference/reference.html#pytest.monkeypatch.monkeypatch

BASE = "/authentication"

def fake_registration(monkeypatch, fail=False):
    def verify(**kw):
        if fail:
            raise ValueError("bad")
        return SimpleNamespace(credential_id=b"new-id", credential_public_key=b"pub", sign_count=0)
    monkeypatch.setattr(webauthn_routes, "verify_registration_response", verify)

def fake_login(monkeypatch, fail=False):
    def verify(**kw):
        if fail:
            raise ValueError("bad")
        return SimpleNamespace(new_sign_count=1)

    monkeypatch.setattr(webauthn_routes, "verify_authentication_response", verify)

def login_body(cred):
    return {"credential": {"rawId": bytes_to_base64url(cred.credential_id)}}

#TEST for registration

def test_reg_success(client, db, monkeypatch):
    fake_registration(monkeypatch)
    client.post(f"{BASE}/register/begin", json={"username":"newuser"})
    r = client.post(f"{BASE}/register/verify", json={"credential": {}})
    assert r.status_code == 200
    assert db.query(User).filter_by(username="newuser").count() == 1
    assert client.get(f"{BASE}/user").status_code == 200

def test_reg_failusername(client):
    r = client.post(f"{BASE}/register/begin", json={"username":"a!"})
    assert r.status_code == 400

def test_reg_dup_username(client, db):
    make_user(db, "taken")
    r = client.post(f"/{BASE}/register/begin", json={"username":"taken"})
    assert r.status_code == 400

def test_reg_failed_verif(client, db, monkeypatch):
    fake_registration(monkeypatch, fail=True)
    client.post(f"{BASE}/register/begin", json={"username":"newuser"})
    r = client.post(f"{BASE}/register/verify", json={"credential": {}})
    assert r.status_code == 400
    assert db.query(User).filter_by(username="newuser").count() == 0