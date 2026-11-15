# Petal API

The API is served by FastAPI at `http://localhost:8000`. Project and board endpoints require the signed `petal_session` cookie created by login. The demo credentials (`user` / `password`) and the single demo account are for local development only.

## Authentication

| Method and path | Behavior |
|---|---|
| `POST /api/auth/login` | Accepts `{"username":"user","password":"password"}` and returns `{"authenticated":true,"username":"user"}` with an HttpOnly session cookie. |
| `GET /api/auth/session` | Returns the current authenticated username; returns `401` without a valid session. |
| `POST /api/auth/logout` | Clears the session cookie and returns `204`. |

## Projects and boards

| Method and path | Behavior |
|---|---|
| `GET /api/projects` | Lists the signed-in user's projects, ordered by position. |
| `POST /api/projects` | Accepts `{"name":"Project name"}` and returns the created project (`201`). A new project starts with five empty columns. |
| `POST /api/projects/import` | Imports a legacy project with `{"id":"old-id","name":"Project name"}`. Repeating the same ID/name is idempotent; an ID conflict returns `409`. |
| `GET /api/projects/{project_id}/board` | Returns the project board as `{"projectId":"…","projectName":"…","columns":[{"id":"…","title":"…","cards":[{"id":"…","title":"…","details":"…"}]}]}`. |
| `PUT /api/projects/{project_id}/board` | Replaces the board's column and card order/content in one transaction. The payload uses the same shape as the GET response. |
| `POST /api/projects/{project_id}/assistant` | Accepts a current `message` and optional prior `history`; returns `{"reply":"…","board":null}` or the saved board when approved operations changed it. |

The demo user's sample project and cards are seeded when the database is first created. Board updates may add columns and cards, delete cards, move cards between columns, and reorder columns or cards. Columns cannot be removed, `projectId` must match the URL, and `projectName` is read-only through this endpoint. Column and card IDs must be unique and cannot be reused from another project.

Unauthenticated requests return `401`; an unknown or non-owned project returns `404`; invalid payloads return `422`; ID conflicts return `409`. Every project query is scoped to the user from the verified session, not to an owner ID from the request.

## AI assistant

The assistant request body is `{"message":"…","history":[{"role":"user","content":"…"},{"role":"assistant","content":"…"}]}`. History is optional and limited to 10 messages; each message is limited to 2,000 characters. The current message has the same limit. The server adds the authenticated project's board snapshot and rejects snapshots over 16,000 characters or complete prompts over 32,000 characters.

The model must return a JSON object with a `reply` and an optional `operations` list (up to 10 operations). Only `add_card`, `update_card`, `move_card`, `add_column`, and `rename_column` are accepted; AI-driven deletion and arbitrary commands are not supported. The server validates every operation and referenced ID against the requested user's current board. Valid changes are written in one board transaction. If the board changed while the model was responding, the API returns `409` rather than overwriting the concurrent edit.

The result's `board` is `null` when the model did not request a change; otherwise it contains the persisted board. Provider timeouts return `504`, provider or model-response failures return `502`, and missing server configuration returns `503` without exposing a key. The server-side client reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL_ID`; the frontend never receives either value.

## SQLite configuration

`PETAL_DATABASE_PATH` selects the SQLite file. The default outside Docker is `backend/data/petal.db`; Compose sets `/data/petal.db` and mounts the named `petal-data` volume there. Tables and the demo data are initialized automatically on the first API request. `docker compose down` preserves the named volume; remove it only when intentionally clearing local database data.
