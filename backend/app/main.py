import base64
import hashlib
import hmac
import json
import os
import sqlite3
import time
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.database import default_columns, demo_user_id, get_database

app = FastAPI(title="Petal API")
hello_page = Path(__file__).parent / "static" / "hello.html"
session_cookie_name = "petal_session"
session_max_age = 60 * 60 * 12
demo_username = "user"
demo_password = "password"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128)


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class LegacyProjectImport(ProjectCreate):
    id: str = Field(min_length=1, max_length=128)

    @field_validator("id", mode="before")
    @classmethod
    def trim_id(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ProjectSummary(BaseModel):
    id: str
    name: str


class CardData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(max_length=5000)

    @field_validator("id", "title", mode="before")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ColumnData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=120)
    cards: list[CardData]

    @field_validator("id", "title", mode="before")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class BoardData(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    project_id: str = Field(alias="projectId", min_length=1, max_length=128)
    project_name: str = Field(alias="projectName", min_length=1, max_length=120)
    columns: list[ColumnData] = Field(min_length=5)

    @field_validator("project_id", "project_name", mode="before")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


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


def _user_id_for_username(connection: sqlite3.Connection, username: str) -> str:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return row["id"]


def _owned_project(
    connection: sqlite3.Connection,
    project_id: str,
    user_id: str,
) -> sqlite3.Row:
    project = connection.execute(
        "SELECT id, name, position FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
    ).fetchone()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


def _board_document(
    connection: sqlite3.Connection,
    project: sqlite3.Row,
) -> dict[str, object]:
    columns: list[dict[str, object]] = []
    column_rows = connection.execute(
        'SELECT id, title FROM "columns" WHERE project_id = ? ORDER BY position, id',
        (project["id"],),
    ).fetchall()
    for column in column_rows:
        cards = connection.execute(
            "SELECT id, title, details FROM cards WHERE column_id = ? ORDER BY position, id",
            (column["id"],),
        ).fetchall()
        columns.append(
            {
                "id": column["id"],
                "title": column["title"],
                "cards": [
                    {"id": card["id"], "title": card["title"], "details": card["details"]}
                    for card in cards
                ],
            }
        )

    return {
        "projectId": project["id"],
        "projectName": project["name"],
        "columns": columns,
    }


@app.get("/api/projects", response_model=list[ProjectSummary])
def list_projects(
    request: Request,
    connection: sqlite3.Connection = Depends(get_database),
) -> list[ProjectSummary]:
    username = get_current_user(request)
    user_id = _user_id_for_username(connection, username)
    projects = connection.execute(
        "SELECT id, name FROM projects WHERE user_id = ? ORDER BY position, id",
        (user_id,),
    ).fetchall()
    return [ProjectSummary(id=project["id"], name=project["name"]) for project in projects]


@app.post("/api/projects", response_model=ProjectSummary, status_code=201)
def create_project(
    project: ProjectCreate,
    request: Request,
    connection: sqlite3.Connection = Depends(get_database),
) -> ProjectSummary:
    username = get_current_user(request)
    user_id = _user_id_for_username(connection, username)
    project_id = str(uuid4())

    with connection:
        position = connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM projects WHERE user_id = ?",
            (user_id,),
        ).fetchone()[0]
        connection.execute(
            "INSERT INTO projects (id, user_id, name, position) VALUES (?, ?, ?, ?)",
            (project_id, user_id, project.name, position),
        )
        for column_position, (column_id, title) in enumerate(default_columns):
            connection.execute(
                'INSERT INTO "columns" (id, project_id, title, position) VALUES (?, ?, ?, ?)',
                (str(uuid4()), project_id, title, column_position),
            )

    return ProjectSummary(id=project_id, name=project.name)


@app.post("/api/projects/import", response_model=ProjectSummary)
def import_legacy_project(
    project: LegacyProjectImport,
    request: Request,
    response: Response,
    connection: sqlite3.Connection = Depends(get_database),
) -> ProjectSummary:
    username = get_current_user(request)
    user_id = _user_id_for_username(connection, username)
    existing = connection.execute(
        "SELECT id, user_id, name FROM projects WHERE id = ?",
        (project.id,),
    ).fetchone()
    if existing is not None:
        if existing["user_id"] != user_id or existing["name"] != project.name:
            raise HTTPException(status_code=409, detail="A project with this ID already exists.")
        response.status_code = 200
        return ProjectSummary(id=existing["id"], name=existing["name"])

    with connection:
        position = connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM projects WHERE user_id = ?",
            (user_id,),
        ).fetchone()[0]
        connection.execute(
            "INSERT INTO projects (id, user_id, name, position) VALUES (?, ?, ?, ?)",
            (project.id, user_id, project.name, position),
        )
        for column_position, (column_id, title) in enumerate(default_columns):
            connection.execute(
                'INSERT INTO "columns" (id, project_id, title, position) VALUES (?, ?, ?, ?)',
                (str(uuid4()), project.id, title, column_position),
            )

    response.status_code = 201
    return ProjectSummary(id=project.id, name=project.name)


@app.get("/api/projects/{project_id}/board")
def read_board(
    project_id: str,
    request: Request,
    connection: sqlite3.Connection = Depends(get_database),
) -> dict[str, object]:
    username = get_current_user(request)
    user_id = _user_id_for_username(connection, username)
    project = _owned_project(connection, project_id, user_id)
    return _board_document(connection, project)


@app.put("/api/projects/{project_id}/board")
def update_board(
    project_id: str,
    board: BoardData,
    request: Request,
    connection: sqlite3.Connection = Depends(get_database),
) -> dict[str, object]:
    username = get_current_user(request)
    user_id = _user_id_for_username(connection, username)
    project = _owned_project(connection, project_id, user_id)
    if board.project_id != project_id:
        raise HTTPException(status_code=422, detail="Board projectId must match the request path.")
    if board.project_name != project["name"]:
        raise HTTPException(status_code=422, detail="Project names cannot be changed through the board API.")

    column_ids = [column.id for column in board.columns]
    card_ids = [card.id for column in board.columns for card in column.cards]
    if len(column_ids) != len(set(column_ids)) or len(card_ids) != len(set(card_ids)):
        raise HTTPException(status_code=422, detail="Column and card IDs must be unique within the board.")

    current_columns = connection.execute(
        'SELECT id FROM "columns" WHERE project_id = ?',
        (project_id,),
    ).fetchall()
    current_column_ids = {row["id"] for row in current_columns}
    submitted_column_ids = set(column_ids)
    if not current_column_ids.issubset(submitted_column_ids):
        raise HTTPException(status_code=422, detail="Columns cannot be removed.")

    if column_ids:
        placeholders = ",".join("?" for _ in column_ids)
        existing_columns = connection.execute(
            f'SELECT id, project_id FROM "columns" WHERE id IN ({placeholders})',
            column_ids,
        ).fetchall()
        if any(row["project_id"] != project_id for row in existing_columns):
            raise HTTPException(status_code=409, detail="A column ID belongs to another project.")

    current_cards = connection.execute(
        """
        SELECT cards.id, "columns".project_id
        FROM cards
        JOIN "columns" ON "columns".id = cards.column_id
        WHERE "columns".project_id = ?
        """,
        (project_id,),
    ).fetchall()
    current_card_ids = {row["id"] for row in current_cards}
    submitted_card_ids = set(card_ids)
    if card_ids:
        placeholders = ",".join("?" for _ in card_ids)
        existing_cards = connection.execute(
            f"""
            SELECT cards.id, "columns".project_id
            FROM cards
            JOIN "columns" ON "columns".id = cards.column_id
            WHERE cards.id IN ({placeholders})
            """,
            card_ids,
        ).fetchall()
        if any(row["project_id"] != project_id for row in existing_cards):
            raise HTTPException(status_code=409, detail="A card ID belongs to another project.")

    try:
        with connection:
            max_column_position = connection.execute(
                'SELECT COALESCE(MAX(position), 0) FROM "columns" WHERE project_id = ?',
                (project_id,),
            ).fetchone()[0]
            column_offset = max_column_position + len(column_ids) + 1
            connection.execute(
                'UPDATE "columns" SET position = position + ? WHERE project_id = ?',
                (column_offset, project_id),
            )

            for index, column in enumerate(board.columns):
                if column.id in current_column_ids:
                    connection.execute(
                        'UPDATE "columns" SET title = ?, position = ? WHERE id = ?',
                        (column.title, index, column.id),
                    )
                else:
                    connection.execute(
                        'INSERT INTO "columns" (id, project_id, title, position) VALUES (?, ?, ?, ?)',
                        (
                            column.id,
                            project_id,
                            column.title,
                            column_offset + max_column_position + 1 + index,
                        ),
                    )
                    connection.execute(
                        'UPDATE "columns" SET position = ? WHERE id = ?',
                        (index, column.id),
                    )

            for card_id in current_card_ids - submitted_card_ids:
                connection.execute("DELETE FROM cards WHERE id = ?", (card_id,))

            max_card_position = connection.execute(
                """
                SELECT COALESCE(MAX(cards.position), 0)
                FROM cards
                JOIN "columns" ON "columns".id = cards.column_id
                WHERE "columns".project_id = ?
                """,
                (project_id,),
            ).fetchone()[0]
            card_offset = max_card_position + len(card_ids) + 1
            connection.execute(
                """
                UPDATE cards SET position = position + ?
                WHERE column_id IN (SELECT id FROM "columns" WHERE project_id = ?)
                """,
                (card_offset, project_id),
            )

            for column in board.columns:
                for position, card in enumerate(column.cards):
                    if card.id in current_card_ids:
                        connection.execute(
                            """
                            UPDATE cards
                            SET column_id = ?, title = ?, details = ?, position = ?
                            WHERE id = ?
                            """,
                            (column.id, card.title, card.details, position, card.id),
                        )
                    else:
                        connection.execute(
                            """
                            INSERT INTO cards (id, column_id, title, details, position)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (card.id, column.id, card.title, card.details, position),
                        )
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Board changes conflict with stored data.") from error

    return _board_document(connection, project)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/hello", include_in_schema=False)
def hello() -> FileResponse:
    return FileResponse(hello_page, media_type="text/html")
