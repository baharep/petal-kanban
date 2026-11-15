# اجرای محلی Petal

## پیش‌نیاز

- Docker Desktop نصب و در حال اجرا باشد.
- PowerShell در ریشه‌ی مخزن باز شود.

## شروع و توقف

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

آدرس‌های پیش‌فرض:

- فرانت‌اند: <http://localhost:3000>
- سلامت API: <http://localhost:8000/api/health>
- صفحه‌ی HTML آزمایشی: <http://localhost:8000/hello>

برای توقف سرویس‌های همین پروژه:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
```

برای تغییر پورت‌ها، `.env.example` را با `Copy-Item .env.example .env` به `.env` کپی و مقدار `FRONTEND_PORT` یا `BACKEND_PORT` را تغییر دهید. فایل `.env` محلی است و نباید commit شود. در این مرحله هیچ کلید یا راز محیطی لازم نیست.

## آزمون بک‌اند

```powershell
py -m venv backend\.venv
Set-Location backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest tests
```
