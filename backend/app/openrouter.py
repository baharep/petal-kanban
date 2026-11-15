import os
from collections.abc import Sequence
from typing import TypedDict

import httpx


OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_TIMEOUT_SECONDS = 20.0


class ChatMessage(TypedDict):
    role: str
    content: str


class OpenRouterError(RuntimeError):
    pass


class OpenRouterConfigurationError(OpenRouterError):
    pass


class OpenRouterTimeoutError(OpenRouterError):
    pass


class OpenRouterProviderError(OpenRouterError):
    pass


class OpenRouterResponseError(OpenRouterError):
    pass


def _create_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT_SECONDS)


async def chat_completion(
    messages: Sequence[ChatMessage],
    response_format: dict[str, str] | None = None,
) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise OpenRouterConfigurationError(
            "Set OPENROUTER_API_KEY in the server environment."
        )

    model_id = os.getenv("OPENROUTER_MODEL_ID", "").strip()
    if not model_id:
        raise OpenRouterConfigurationError(
            "Set OPENROUTER_MODEL_ID in the server environment."
        )

    try:
        async with _create_http_client() as client:
            request_body: dict[str, object] = {
                "model": model_id,
                "messages": list(messages),
            }
            if response_format is not None:
                request_body["response_format"] = response_format

            response = await client.post(
                OPENROUTER_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=request_body,
            )
            response.raise_for_status()
    except httpx.TimeoutException as error:
        raise OpenRouterTimeoutError("The OpenRouter request timed out.") from error
    except httpx.HTTPStatusError as error:
        raise OpenRouterProviderError(
            f"OpenRouter returned HTTP {error.response.status_code}."
        ) from error
    except httpx.RequestError as error:
        raise OpenRouterProviderError("Could not reach OpenRouter.") from error

    try:
        payload = response.json()
    except ValueError as error:
        raise OpenRouterResponseError("OpenRouter returned invalid JSON.") from error

    if not isinstance(payload, dict):
        raise OpenRouterResponseError("OpenRouter returned an invalid response.")

    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise OpenRouterResponseError("OpenRouter returned no chat completion.")

    message = choices[0].get("message")
    if not isinstance(message, dict):
        raise OpenRouterResponseError("OpenRouter returned an invalid chat message.")

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise OpenRouterResponseError("OpenRouter returned empty chat content.")

    return content.strip()
