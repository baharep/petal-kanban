from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

app = FastAPI(title="Petal API")
hello_page = Path(__file__).parent / "static" / "hello.html"


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/hello", include_in_schema=False)
def hello() -> FileResponse:
    return FileResponse(hello_page, media_type="text/html")
