from collections.abc import Callable
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

schema_path = Path(__file__).parents[1] / "schemas" / "kanban.schema.json"
schema = json.loads(schema_path.read_text(encoding="utf-8"))
validator = Draft202012Validator(schema)


def valid_board() -> dict[str, object]:
    return {
        "projectId": "project-board",
        "projectName": "Project Board",
        "columns": [
            {
                "id": column_id,
                "title": title,
                "cards": (
                    [{"id": "todo-1", "title": "Design homepage", "details": ""}]
                    if column_id == "todo"
                    else []
                ),
            }
            for column_id, title in [
                ("todo", "To do"),
                ("in-progress", "In progress"),
                ("review", "Review"),
                ("done", "Done"),
                ("blocked", "Blocked"),
            ]
        ],
    }


def test_kanban_schema_is_valid() -> None:
    Draft202012Validator.check_schema(schema)


def test_schema_accepts_sample_board_with_five_columns() -> None:
    validator.validate(valid_board())


@pytest.mark.parametrize(
    "mutate",
    [
        lambda board: board.pop("projectId"),
        lambda board: board["columns"].pop(),
        lambda board: board["columns"][0].update({"title": ""}),
        lambda board: board["columns"][0]["cards"][0].update({"unexpected": True}),
    ],
)
def test_schema_rejects_invalid_board(
    mutate: Callable[[dict[str, object]], object],
) -> None:
    board = valid_board()
    mutate(board)

    assert list(validator.iter_errors(board))
