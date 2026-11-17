from types import SimpleNamespace
from webauthn.helpers import bytes_to_base64url
from backend.app.model import User
from backend.app.routes import webauthn_routes

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