import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from backend.app.routes import webauthn_routes


class FakeAuditQuery:
    def __init__(self, failure_count):
        self.failure_count = failure_count

    def filter(self, *conditions):
        return self

    def count(self):
        return self.failure_count


class FakeDB:
    def __init__(self, failure_count):
        self.failure_count = failure_count

    def query(self, model):
        return FakeAuditQuery(self.failure_count)


def make_request():
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/authentication/login",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "session": {},
        }
    )


class LockoutTests(unittest.TestCase):
    def test_login_is_allowed_before_failure_limit(self):
        db = FakeDB(failure_count=4)
        request = make_request()

        with patch.object(
            webauthn_routes,
            "audit",
        ) as audit:
            webauthn_routes.check_limit(
                db,
                request,
                "alice@example.com",
            )

        audit.assert_not_called()

    def test_login_is_blocked_at_failure_limit(self):
        db = FakeDB(failure_count=5)
        request = make_request()

        with (
            patch.object(webauthn_routes, "audit") as audit,
            self.assertRaises(HTTPException) as raised,
        ):
            webauthn_routes.check_limit(
                db,
                request,
                "alice@example.com",
            )

        self.assertEqual(raised.exception.status_code, 429)
        self.assertEqual(
            raised.exception.detail,
            "too many failed attempts.",
        )
        audit.assert_called_once_with(
            db,
            "login_blocked",
            False,
            request=request,
            detail="alice@example.com",
        )


if __name__ == "__main__":
    unittest.main()