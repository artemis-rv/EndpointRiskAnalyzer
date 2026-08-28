"""
app/tests/test_error_cors.py
─────────────────────────────
Every response a browser can receive must carry CORS headers — including the
ones produced when something goes wrong.

WHY THIS NEEDS A TEST
Starlette's ServerErrorMiddleware sits outside every user middleware, so a
response it generates never passes through CORSMiddleware. The browser then
reports a CORS failure rather than a 500, and the frontend cannot tell "the
server broke" from "the server is unreachable" — the first is a bug to fix, the
second is a network problem, and they need different responses from the user.

The regression is invisible from the server side: curl shows a perfectly good
500. Only a cross-origin browser request reveals it, which is why this asserts
on the header directly.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app

ORIGIN = "http://localhost:3000"


@pytest.fixture(scope="module")
def client():
    # Routes that produce each error class on demand. Registered on the real
    # application so they sit inside the real middleware stack.
    @app.get("/__test__/boom")
    async def _boom():  # pragma: no cover - body never returns
        raise RuntimeError("deliberate failure with a secret: hunter2")

    @app.get("/__test__/http-error")
    async def _http_error():
        raise HTTPException(status_code=409, detail="Conflicting thing.")

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def _cors_header(response) -> str | None:
    return response.headers.get("access-control-allow-origin")


class TestCorsOnErrors:
    def test_500_carries_cors_headers(self, client):
        response = client.get("/__test__/boom", headers={"Origin": ORIGIN})

        assert response.status_code == 500
        assert _cors_header(response) == ORIGIN

    def test_500_body_is_generic(self, client):
        response = client.get("/__test__/boom", headers={"Origin": ORIGIN})
        body = response.json()

        assert body["success"] is False
        assert body["error"] == "An internal server error occurred."
        # The correlation id is the only detail offered.
        assert "request_id" in body

    def test_500_leaks_nothing_about_the_failure(self, client):
        response = client.get("/__test__/boom", headers={"Origin": ORIGIN})
        raw = response.text

        for leak in ("RuntimeError", "hunter2", "Traceback", "app/main.py", "deliberate"):
            assert leak not in raw

    @pytest.mark.parametrize(
        "path,expected",
        [
            ("/api/v1/releases", 200),
            ("/api/v1/users/me", 401),
            ("/api/v1/no-such-route", 404),
            ("/__test__/http-error", 409),
        ],
    )
    def test_every_status_carries_cors_headers(self, client, path, expected):
        response = client.get(path, headers={"Origin": ORIGIN})

        assert response.status_code == expected
        assert _cors_header(response) == ORIGIN

    def test_422_carries_cors_headers(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email"},
            headers={"Origin": ORIGIN},
        )

        assert response.status_code == 422
        assert _cors_header(response) == ORIGIN

    def test_preflight_is_allowed_for_the_configured_origin(self, client):
        response = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        assert response.status_code == 200
        assert _cors_header(response) == ORIGIN

    def test_unlisted_origin_is_not_granted_access(self, client):
        response = client.get(
            "/api/v1/releases", headers={"Origin": "https://evil.example"}
        )

        # The request itself succeeds server-side; what matters is that the
        # browser is never told the other origin may read the result.
        assert _cors_header(response) != "https://evil.example"
