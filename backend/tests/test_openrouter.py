import json

import httpx
import pytest

from app import openrouter
from app.openrouter import (
    OpenRouterConfigurationError,
    OpenRouterProviderError,
    OpenRouterResponseError,
    OpenRouterTimeoutError,
    chat_completion,
)


@pytest.fixture(autouse=True)
def openrouter_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-api-key")
    monkeypatch.setenv("OPENROUTER_MODEL_ID", "test/model")


def set_mock_transport(
    monkeypatch: pytest.MonkeyPatch,
    handler: httpx.MockTransport,
) -> None:
    monkeypatch.setattr(
        openrouter,
        "_create_http_client",
        lambda: httpx.AsyncClient(transport=handler),
    )


@pytest.mark.anyio
async def test_chat_completion_sends_server_configuration_and_parses_reply(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handle_request(request: httpx.Request) -> httpx.Response:
        assert request.url == openrouter.OPENROUTER_CHAT_COMPLETIONS_URL
        assert request.headers["Authorization"] == "Bearer test-api-key"
        assert request.read() == (
            b'{"model":"test/model","messages":[{"role":"user","content":"Hello"}]}'
        )
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "  Hello back.  "}}]},
        )

    set_mock_transport(monkeypatch, httpx.MockTransport(handle_request))

    result = await chat_completion([{"role": "user", "content": "Hello"}])

    assert result == "Hello back."


@pytest.mark.anyio
async def test_chat_completion_requests_json_response_format(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-api-key")
    monkeypatch.setenv("OPENROUTER_MODEL_ID", "test/model")

    def handle_request(request: httpx.Request) -> httpx.Response:
        assert json.loads(request.content)["response_format"] == {"type": "json_object"}
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"reply":"Done","operations":[]}'}}]},
        )

    set_mock_transport(monkeypatch, httpx.MockTransport(handle_request))

    result = await chat_completion(
        [{"role": "user", "content": "Hello"}],
        response_format={"type": "json_object"},
    )

    assert result == '{"reply":"Done","operations":[]}'


@pytest.mark.anyio
async def test_chat_completion_reports_missing_api_key_without_revealing_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("OPENROUTER_MODEL_ID", "test/model")

    with pytest.raises(OpenRouterConfigurationError, match="OPENROUTER_API_KEY"):
        await chat_completion([{"role": "user", "content": "Hello"}])


@pytest.mark.anyio
async def test_chat_completion_reports_missing_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-api-key")
    monkeypatch.delenv("OPENROUTER_MODEL_ID", raising=False)

    with pytest.raises(OpenRouterConfigurationError, match="OPENROUTER_MODEL_ID"):
        await chat_completion([{"role": "user", "content": "Hello"}])


@pytest.mark.anyio
async def test_chat_completion_reports_provider_status_without_response_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handle_request(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="provider detail and private data")

    set_mock_transport(monkeypatch, httpx.MockTransport(handle_request))

    with pytest.raises(OpenRouterProviderError) as error:
        await chat_completion([{"role": "user", "content": "Hello"}])

    assert str(error.value) == "OpenRouter returned HTTP 429."
    assert "private data" not in str(error.value)


@pytest.mark.anyio
async def test_chat_completion_reports_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handle_request(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("request timed out", request=request)

    set_mock_transport(monkeypatch, httpx.MockTransport(handle_request))

    with pytest.raises(OpenRouterTimeoutError, match="timed out"):
        await chat_completion([{"role": "user", "content": "Hello"}])


@pytest.mark.anyio
async def test_chat_completion_reports_network_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handle_request(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection failed", request=request)

    set_mock_transport(monkeypatch, httpx.MockTransport(handle_request))

    with pytest.raises(OpenRouterProviderError, match="Could not reach OpenRouter"):
        await chat_completion([{"role": "user", "content": "Hello"}])


@pytest.mark.anyio
@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, text="not JSON"),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, json={"choices": [{"message": {"content": ""}}]}),
    ],
)
async def test_chat_completion_reports_invalid_provider_responses(
    monkeypatch: pytest.MonkeyPatch,
    response: httpx.Response,
) -> None:
    set_mock_transport(
        monkeypatch,
        httpx.MockTransport(lambda _: response),
    )

    with pytest.raises(OpenRouterResponseError):
        await chat_completion([{"role": "user", "content": "Hello"}])
