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

The demo user's sample project and cards are seeded when the database is first created. Board updates may add columns and cards, delete cards, move cards between columns, and reorder columns or cards. Columns cannot be removed, `projectId` must match the URL, and `projectName` is read-only through this endpoint. Column and card IDs must be unique and cannot be reused from another project.

Unauthenticated requests return `401`; an unknown or non-owned project returns `404`; invalid payloads return `422`; ID conflicts return `409`. Every project query is scoped to the user from the verified session, not to an owner ID from the request.

## SQLite configuration

`PETAL_DATABASE_PATH` selects the SQLite file. The default outside Docker is `backend/data/petal.db`; Compose sets `/data/petal.db` and mounts the named `petal-data` volume there. Tables and the demo data are initialized automatically on the first API request. `docker compose down` preserves the named volume; remove it only when intentionally clearing local database data.
