import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Petal API")
hello_page = Path(__file__).parent / "static" / "hello.html"
session_cookie_name = "petal_session"
session_max_age = 60 * 60 * 12
demo_username = "user"
demo_password = "password"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128)


def _session_secret() -> bytes:
    secret = os.getenv("PETAL_SESSION_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="Session signing is not configured.")
    return secret.encode("utf-8")


def _cookie_secure() -> bool:
    value = os.getenv("PETAL_COOKIE_SECURE", "false").lower()
    if value not in {"true", "false"}:
        raise HTTPException(status_code=503, detail="Session cookie settings are invalid.")
    return value == "true"


def _base64_url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _create_session_token(username: str) -> str:
    payload = json.dumps(
        {"sub": username, "exp": int(time.time()) + session_max_age},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded_payload = _base64_url_encode(payload)
    signature = hmac.new(
        _session_secret(),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{encoded_payload}.{_base64_url_encode(signature)}"


def _verify_session_token(token: str) -> str | None:
    allowed_characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-."
    if len(token) > 1024 or any(character not in allowed_characters for character in token):
        return None

    parts = token.split(".")
    if len(parts) != 2:
        return None

    encoded_payload, encoded_signature = parts
    expected_signature = hmac.new(
        _session_secret(),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(_base64_url_encode(expected_signature), encoded_signature):
        return None

    try:
        payload_bytes = base64.urlsafe_b64decode(
            encoded_payload + "=" * (-len(encoded_payload) % 4)
        )
        payload = json.loads(payload_bytes)
    except (ValueError, UnicodeDecodeError):
        return None

    if not isinstance(payload, dict):
        return None

    username = payload.get("sub")
    expires_at = payload.get("exp")
    if (
        username != demo_username
        or not isinstance(expires_at, int)
        or isinstance(expires_at, bool)
        or expires_at <= int(time.time())
    ):
        return None

    return username


def get_current_user(request: Request) -> str:
    token = request.cookies.get(session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    username = _verify_session_token(token)
    if username is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return username


@app.post("/api/auth/login")
def login(credentials: LoginRequest, response: Response) -> dict[str, str | bool]:
    if not (
        hmac.compare_digest(credentials.username.encode("utf-8"), demo_username.encode("utf-8"))
        and hmac.compare_digest(credentials.password.encode("utf-8"), demo_password.encode("utf-8"))
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    response.set_cookie(
        key=session_cookie_name,
        value=_create_session_token(demo_username),
        max_age=session_max_age,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        path="/",
    )
    return {"authenticated": True, "username": demo_username}


@app.get("/api/auth/session")
def session(request: Request) -> dict[str, str | bool]:
    return {"authenticated": True, "username": get_current_user(request)}


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(
        key=session_cookie_name,
        path="/",
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/hello", include_in_schema=False)
def hello() -> FileResponse:
    return FileResponse(hello_page, media_type="text/html")
