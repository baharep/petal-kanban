import httpx
import pytest

from app.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


@pytest.mark.anyio
async def test_health_endpoint_returns_ok() -> None:
    response = await get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_hello_endpoint_serves_static_html() -> None:
    response = await get("/hello")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "<h1>Hello from Petal</h1>" in response.text


@pytest.mark.anyio
async def test_unknown_endpoint_returns_not_found() -> None:
    response = await get("/missing")

    assert response.status_code == 404
