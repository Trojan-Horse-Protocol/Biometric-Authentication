from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_session_lifecycle() -> None:
    missing = client.get("/session")
    assert missing.status_code == 401
    assert missing.json() == {
        "error": "unauthorized",
        "message": "Authentication required.",
    }

    created = client.post("/session", json={"username": "angelina"})
    assert created.status_code == 201
    body = created.json()
    assert body["username"] == "angelina"
    assert "user_id" in body
    assert "session_id" not in body
    assert client.cookies.get("session_id")

    current = client.get("/session")
    assert current.status_code == 200
    assert current.json()["username"] == "angelina"

    logged_out = client.post("/logout")
    assert logged_out.status_code == 200
    assert logged_out.json() == {"status": "logged_out"}

    after_logout = client.get("/session")
    assert after_logout.status_code == 401


def test_invalid_session_payload() -> None:
    response = client.post("/session", json={})
    assert response.status_code == 422
    assert response.json() == {
        "error": "invalid_request",
        "message": "Invalid request.",
    }


def test_unhandled_error_is_generic() -> None:
    async def boom() -> None:
        raise RuntimeError("secret stack details")

    app.add_api_route("/__boom", boom, methods=["GET"])
    response = client.get("/__boom")
    assert response.status_code == 500
    assert response.json() == {
        "error": "internal_error",
        "message": "An unexpected error occurred.",
    }
    assert "secret" not in response.text


if __name__ == "__main__":
    test_health()
    test_session_lifecycle()
    test_invalid_session_payload()
    test_unhandled_error_is_generic()
    print("ok")
