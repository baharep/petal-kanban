import secrets

import httpx
import pytest

from app.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def configured_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PETAL_SESSION_SECRET", secrets.token_urlsafe(32))
    monkeypatch.setenv("PETAL_COOKIE_SECURE", "false")


def create_client() -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


@pytest.mark.anyio
async def test_health_endpoint_returns_ok() -> None:
    async with create_client() as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_hello_endpoint_serves_static_html() -> None:
    async with create_client() as client:
        response = await client.get("/hello")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "<h1>Hello from Petal</h1>" in response.text


@pytest.mark.anyio
async def test_unknown_endpoint_returns_not_found() -> None:
    async with create_client() as client:
        response = await client.get("/missing")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_authentication_requires_a_valid_session() -> None:
    async with create_client() as client:
        response = await client.get("/api/auth/session")

    assert response.status_code == 401


@pytest.mark.anyio
async def test_login_rejects_invalid_credentials(configured_session: None) -> None:
    async with create_client() as client:
        response = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "incorrect"},
        )

    assert response.status_code == 401
    assert "petal_session" not in response.headers.get("set-cookie", "")


@pytest.mark.anyio
async def test_login_issues_http_only_cookie_and_session(configured_session: None) -> None:
    async with create_client() as client:
        login_response = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        session_response = await client.get("/api/auth/session")

    assert login_response.status_code == 200
    assert login_response.json() == {"authenticated": True, "username": "user"}
    cookie = login_response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert session_response.status_code == 200
    assert session_response.json() == {"authenticated": True, "username": "user"}


@pytest.mark.anyio
async def test_tampered_session_cookie_is_rejected(configured_session: None) -> None:
    async with create_client() as client:
        await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        token = client.cookies.get("petal_session")
        assert token is not None
        client.cookies.set("petal_session", f"{token}x")
        response = await client.get("/api/auth/session")

    assert response.status_code == 401


@pytest.mark.anyio
async def test_logout_clears_session_cookie(configured_session: None) -> None:
    async with create_client() as client:
        await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        logout_response = await client.post("/api/auth/logout")
        session_response = await client.get("/api/auth/session")

    assert logout_response.status_code == 204
    assert session_response.status_code == 401


@pytest.mark.anyio
async def test_login_reports_missing_session_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PETAL_SESSION_SECRET", raising=False)
    async with create_client() as client:
        response = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )

    assert response.status_code == 503


@pytest.mark.anyio
async def test_login_marks_cookie_secure_when_configured(
    configured_session: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PETAL_COOKIE_SECURE", "true")
    async with create_client() as client:
        response = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )

    assert response.status_code == 200
    assert "; secure" in response.headers["set-cookie"].lower()


@pytest.mark.anyio
async def test_login_reports_invalid_cookie_configuration(
    configured_session: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PETAL_COOKIE_SECURE", "sometimes")
    async with create_client() as client:
        response = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )

    assert response.status_code == 503
