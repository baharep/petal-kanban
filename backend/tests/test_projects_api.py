import sqlite3
from pathlib import Path

import httpx
import pytest

from app.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def database_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    path = tmp_path / "petal.db"
    monkeypatch.setenv("PETAL_DATABASE_PATH", str(path))
    monkeypatch.setenv("PETAL_SESSION_SECRET", "test-session-secret-key-for-project-api")
    return path


def create_client() -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


async def sign_in(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200


@pytest.mark.anyio
async def test_project_and_board_data_are_created_and_ordered(database_file: Path) -> None:
    async with create_client() as client:
        await sign_in(client)
        project_response = await client.get("/api/projects")

        assert project_response.status_code == 200
        assert project_response.json() == [{"id": "project-board", "name": "Project Board"}]

        board_response = await client.get("/api/projects/project-board/board")
        board = board_response.json()
        assert board_response.status_code == 200
        assert len(board["columns"]) == 5
        assert [card["id"] for card in board["columns"][0]["cards"]] == ["todo-1", "todo-2"]

        todo = board["columns"][0]
        review = board["columns"][2]
        todo["cards"].append({"id": "todo-3", "title": "Write tests", "details": "API checks"})
        todo["cards"] = [todo["cards"][1], todo["cards"][0], todo["cards"][2]]
        review["cards"].append(todo["cards"].pop(1))
        board["columns"][1]["cards"] = []
        board["columns"].insert(
            2,
            {
                "id": "launch",
                "title": "Launch",
                "cards": [{"id": "launch-1", "title": "Ship release", "details": ""}],
            }
        )

        update_response = await client.put(
            "/api/projects/project-board/board",
            json=board,
        )
        assert update_response.status_code == 200

        persisted_response = await client.get("/api/projects/project-board/board")
        persisted = persisted_response.json()
        assert [card["id"] for card in persisted["columns"][0]["cards"]] == ["todo-2", "todo-3"]
        assert [card["id"] for card in persisted["columns"][3]["cards"]] == [
            "review-1",
            "todo-1",
        ]
        assert persisted["columns"][1]["cards"] == []
        assert persisted["columns"][2]["cards"] == [
            {"id": "launch-1", "title": "Ship release", "details": ""}
        ]

    assert database_file.is_file()
    with sqlite3.connect(database_file) as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


@pytest.mark.anyio
async def test_create_project_trims_name_and_seeds_five_empty_columns(
    database_file: Path,
) -> None:
    async with create_client() as client:
        await sign_in(client)
        response = await client.post("/api/projects", json={"name": "  Spring launch  "})

        assert response.status_code == 201
        project = response.json()
        assert project["name"] == "Spring launch"

        board_response = await client.get(f"/api/projects/{project['id']}/board")
        board = board_response.json()
        assert board_response.status_code == 200
        assert board["projectName"] == "Spring launch"
        assert len(board["columns"]) == 5
        assert all(column["cards"] == [] for column in board["columns"])


@pytest.mark.anyio
async def test_legacy_project_import_is_idempotent(database_file: Path) -> None:
    async with create_client() as client:
        await sign_in(client)
        payload = {"id": "legacy-project", "name": "  Legacy project  "}
        first_response = await client.post("/api/projects/import", json=payload)
        second_response = await client.post("/api/projects/import", json=payload)

        assert first_response.status_code == 201
        assert first_response.json() == {"id": "legacy-project", "name": "Legacy project"}
        assert second_response.status_code == 200

        board_response = await client.get("/api/projects/legacy-project/board")

    board = board_response.json()
    assert board_response.status_code == 200
    assert len(board["columns"]) == 5
    assert all(column["cards"] == [] for column in board["columns"])


@pytest.mark.anyio
async def test_project_api_requires_a_session(database_file: Path) -> None:
    async with create_client() as client:
        projects_response = await client.get("/api/projects")
        create_response = await client.post("/api/projects", json={"name": "Private"})
        board_response = await client.get("/api/projects/project-board/board")

    assert projects_response.status_code == 401
    assert create_response.status_code == 401
    assert board_response.status_code == 401


@pytest.mark.anyio
async def test_projects_and_boards_are_isolated_by_session_user(
    database_file: Path,
) -> None:
    async with create_client() as client:
        await sign_in(client)
        await client.get("/api/projects")

        with sqlite3.connect(database_file) as connection:
            connection.execute(
                "INSERT INTO users (id, username) VALUES (?, ?)",
                ("other-user", "other"),
            )
            connection.execute(
                "INSERT INTO projects (id, user_id, name, position) VALUES (?, ?, ?, 0)",
                ("other-project", "other-user", "Other project"),
            )
            for position, (column_id, title) in enumerate(
                [
                    ("other-todo", "To do"),
                    ("other-progress", "In progress"),
                    ("other-review", "Review"),
                    ("other-done", "Done"),
                    ("other-blocked", "Blocked"),
                ]
            ):
                connection.execute(
                    'INSERT INTO "columns" (id, project_id, title, position) VALUES (?, ?, ?, ?)',
                    (column_id, "other-project", title, position),
                )

        projects_response = await client.get("/api/projects")
        private_board_response = await client.get("/api/projects/other-project/board")
        private_update_response = await client.put(
            "/api/projects/other-project/board",
            json={
                "projectId": "other-project",
                "projectName": "Other project",
                "columns": [
                    {"id": column_id, "title": title, "cards": []}
                    for column_id, title in [
                        ("other-todo", "To do"),
                        ("other-progress", "In progress"),
                        ("other-review", "Review"),
                        ("other-done", "Done"),
                        ("other-blocked", "Blocked"),
                    ]
                ],
            },
        )

    assert projects_response.status_code == 200
    assert all(project["id"] != "other-project" for project in projects_response.json())
    assert private_board_response.status_code == 404
    assert private_update_response.status_code == 404


@pytest.mark.anyio
async def test_board_update_rejects_removing_columns_or_changing_project(
    database_file: Path,
) -> None:
    async with create_client() as client:
        await sign_in(client)
        board_response = await client.get("/api/projects/project-board/board")
        board = board_response.json()

        board["columns"].pop()
        missing_column_response = await client.put(
            "/api/projects/project-board/board",
            json=board,
        )

        board["columns"].append(
            {"id": "blocked", "title": "Blocked", "cards": []},
        )
        board["projectId"] = "another-project"
        mismatch_response = await client.put(
            "/api/projects/project-board/board",
            json=board,
        )

    assert missing_column_response.status_code == 422
    assert mismatch_response.status_code == 422


@pytest.mark.anyio
async def test_board_update_rejects_column_id_from_another_project(
    database_file: Path,
) -> None:
    async with create_client() as client:
        await sign_in(client)
        other_project_response = await client.post(
            "/api/projects",
            json={"name": "Other project"},
        )
        other_project_id = other_project_response.json()["id"]
        other_board_response = await client.get(
            f"/api/projects/{other_project_id}/board",
        )
        board_response = await client.get("/api/projects/project-board/board")
        board = board_response.json()
        board["columns"].append(other_board_response.json()["columns"][0])

        response = await client.put("/api/projects/project-board/board", json=board)

    assert other_project_response.status_code == 201
    assert other_board_response.status_code == 200
    assert response.status_code == 409
