import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from sqlite3 import Connection

demo_user_id = "demo-user"
demo_username = "user"

default_columns = [
    ("todo", "To do"),
    ("in-progress", "In progress"),
    ("review", "Review"),
    ("done", "Done"),
    ("blocked", "Blocked"),
]

sample_cards = {
    "todo": [
        ("todo-1", "Design homepage", "Update the hero section and CTA layout."),
        ("todo-2", "Review copy", "Align the product text with the new campaign."),
    ],
    "in-progress": [
        ("progress-1", "Build dashboard", "Finalize the summary cards and chart layout."),
    ],
    "review": [
        ("review-1", "QA checklist", "Check spacing, accessibility, and browser flow."),
    ],
    "done": [
        ("done-1", "Brand colors", "Finalize the palette and accent usage."),
    ],
    "blocked": [
        ("blocked-1", "API access", "Wait for final production credentials."),
    ],
}


def database_path() -> Path:
    configured_path = os.getenv("PETAL_DATABASE_PATH")
    if configured_path:
        path = Path(configured_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / path
        return path
    return Path(__file__).resolve().parent.parent / "data" / "petal.db"


def initialize_database(connection: Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY NOT NULL,
            username TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
            position INTEGER NOT NULL CHECK(position >= 0),
            UNIQUE(user_id, position)
        );

        CREATE TABLE IF NOT EXISTS "columns" (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
            position INTEGER NOT NULL CHECK(position >= 0),
            UNIQUE(project_id, position)
        );

        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY NOT NULL,
            column_id TEXT NOT NULL REFERENCES "columns"(id) ON DELETE CASCADE,
            title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
            details TEXT NOT NULL DEFAULT '' CHECK(length(details) <= 5000),
            position INTEGER NOT NULL CHECK(position >= 0),
            UNIQUE(column_id, position)
        );

        CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
        CREATE INDEX IF NOT EXISTS columns_project_id_idx ON "columns"(project_id);
        CREATE INDEX IF NOT EXISTS cards_column_id_idx ON cards(column_id);
        """
    )

    with connection:
        connection.execute(
            "INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)",
            (demo_user_id, demo_username),
        )
        user = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (demo_username,),
        ).fetchone()
        if user is None or user["id"] != demo_user_id:
            raise RuntimeError("The demo account conflicts with the configured database.")

        project_count = connection.execute(
            "SELECT COUNT(*) FROM projects WHERE user_id = ?",
            (demo_user_id,),
        ).fetchone()[0]
        if project_count:
            return

        connection.execute(
            "INSERT INTO projects (id, user_id, name, position) VALUES (?, ?, ?, 0)",
            ("project-board", demo_user_id, "Project Board"),
        )
        for column_position, (column_id, title) in enumerate(default_columns):
            connection.execute(
                'INSERT INTO "columns" (id, project_id, title, position) VALUES (?, ?, ?, ?)',
                (column_id, "project-board", title, column_position),
            )
            for card_position, (card_id, card_title, details) in enumerate(sample_cards[column_id]):
                connection.execute(
                    """
                    INSERT INTO cards (id, column_id, title, details, position)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (card_id, column_id, card_title, details, card_position),
                )


def get_database() -> Iterator[Connection]:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        initialize_database(connection)
        yield connection
    finally:
        connection.close()
