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

در اولین اجرا، اسکریپت یک کلید امضای تصادفی در `.env` می‌سازد. این کلید فقط برای محیط محلی است؛ `.env` را commit نکنید. برای تغییر پورت‌ها یا تنظیم `PETAL_COOKIE_SECURE`، `.env.example` را با `Copy-Item .env.example .env` کپی و مقادیر را ویرایش کنید؛ اگر کلید امضا خالی باشد، اسکریپت شروع آن را ایجاد می‌کند. `PETAL_COOKIE_SECURE` را فقط زمانی `true` کنید که برنامه پشت HTTPS اجرا می‌شود.

ورود آزمایشی با نام کاربری `user` و گذرواژه‌ی `password` است و برای استفاده‌ی تولیدی مناسب نیست.

## آزمون بک‌اند

```powershell
py -m venv backend\.venv
Set-Location backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest tests
```

آزمون‌های Playwright نیز سرور FastAPI را با همین محیط مجازی بالا می‌آورند؛ پیش از اجرای آن‌ها، محیط و وابستگی‌های بک‌اند را طبق دستورهای بالا آماده کنید.
