import base64
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("SESSION_SECRET", "test-session-secret")

from fastapi import HTTPException
from starlette.requests import Request

from backend.app.model import Credential, User
from backend.app.routes import webauthn_routes


class FakeQuery:
    def __init__(self, db, model):
        self.db = db
        self.model = model
        self.filters = {}

    def filter_by(self, **filters):
        self.filters.update(filters)
        return self

    def first(self):
        if self.model is User:
            if self.db.user and self.db.user.username == self.filters.get("username"):
                return self.db.user
            return None

        credential = self.db.credential
        if credential and all(
            getattr(credential, key) == value
            for key, value in self.filters.items()
        ):
            return credential
        return None


class FakeDB:
    def __init__(self, user=None, credential=None):
        self.user = user
        self.credential = credential
        self.credential_query_filters = None

    def query(self, model):
        query = FakeQuery(self, model)
        if model is Credential:
            original_filter_by = query.filter_by

            def record_filters(**filters):
                self.credential_query_filters = filters
                return original_filter_by(**filters)

            query.filter_by = record_filters
        return query

    def get(self, model, identifier):
        if model is User and self.user and self.user.id == identifier:
            return self.user
        return None

    def commit(self):
        pass


def make_request(session):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/authentication/login",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "session": session,
        }
    )


def encoded_credential_id(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


class LoginBindingTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id=7, username="alice@example.com", role="member")
        self.credential = SimpleNamespace(
            user_id=7,
            credential_id=b"alice-passkey",
            public_key=b"public-key",
            sign_count=0,
        )

    def test_unknown_username_gets_only_a_fake_credential_allow_list(self):
        request = make_request({})
        db = FakeDB()
        options = SimpleNamespace(challenge=b"test-challenge")

        with (
            patch.object(webauthn_routes, "check_limit"),
            patch.object(
                webauthn_routes,
                "generate_authentication_options",
                return_value=options,
            ) as generate_options,
            patch.object(webauthn_routes, "options_to_json", return_value="{}"),
        ):
            webauthn_routes.login_begin(
                webauthn_routes.UsernameInfo(username="missing@example.com"),
                request,
                db,
            )

        allow_credentials = generate_options.call_args.kwargs["allow_credentials"]
        self.assertEqual(len(allow_credentials), 1)
        self.assertNotEqual(
            allow_credentials[0].id,
            self.credential.credential_id,
        )
        self.assertIsNone(request.session["ch"]["uid"])

    def test_credential_from_another_user_is_rejected(self):
        request = make_request(
            {
                "ch": {
                    "c": b"test-challenge".hex(),
                    "purpose": "login",
                    "uid": self.user.id,
                    "username": self.user.username,
                }
            }
        )
        other_user_credential = SimpleNamespace(
            **{**vars(self.credential), "user_id": 8}
        )
        db = FakeDB(user=self.user, credential=other_user_credential)
        body = webauthn_routes.CredentialInfo(
            credential={"rawId": encoded_credential_id(self.credential.credential_id)}
        )

        with (
            patch.object(webauthn_routes, "check_limit"),
            patch.object(webauthn_routes, "audit"),
            patch.object(webauthn_routes, "verify_authentication_response") as verify,
            self.assertRaises(HTTPException) as raised,
        ):
            webauthn_routes.login_verify(body, request, db)

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(db.credential_query_filters["user_id"], self.user.id)
        verify.assert_not_called()

    def test_correct_user_credential_can_authenticate(self):
        request = make_request(
            {
                "ch": {
                    "c": b"test-challenge".hex(),
                    "purpose": "login",
                    "uid": self.user.id,
                    "username": self.user.username,
                }
            }
        )
        db = FakeDB(user=self.user, credential=self.credential)
        body = webauthn_routes.CredentialInfo(
            credential={"rawId": encoded_credential_id(self.credential.credential_id)}
        )

        with (
            patch.object(webauthn_routes, "check_limit"),
            patch.object(webauthn_routes, "audit"),
            patch.object(
                webauthn_routes,
                "verify_authentication_response",
                return_value=SimpleNamespace(new_sign_count=1),
            ),
        ):
            response = webauthn_routes.login_verify(body, request, db)

        self.assertEqual(response["username"], self.user.username)
        self.assertEqual(request.session["uid"], self.user.id)
        self.assertEqual(self.credential.sign_count, 1)


if __name__ == "__main__":
    unittest.main()
