<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## راهنمای فرانت‌اند Petal

- [راهنمای ریشه](../AGENTS.md) محدوده و قواعد مشترک را مشخص می‌کند؛ پیش از شروع مرحله، [برنامه‌ی اجرایی](../docs/PLAN.md) و دروازه‌های تأییدش را بخوانید.
- `app/page.tsx` صفحه‌ی تخته و تعامل‌های کارت/ستون را پیاده می‌کند، از جمله جابه‌جایی کارت بین ستون‌ها و مرتب‌سازی درون یک ستون؛ در وضعیت فعلی داده‌ی تخته در state نگهداری می‌شود و مرحله‌ی اتصال API در برنامه نحوه‌ی تغییر آن را مشخص می‌کند.
- `app/projects-store.ts` اشتراک وضعیت پروژه‌ها را با `useSyncExternalStore` و `localStorage` پیاده می‌کند؛ پس از اتصال بک‌اند، API باید منبع اصلی داده باشد.
- `app/projects/page.tsx` فهرست و ساخت پروژه را نمایش می‌دهد؛ `app/projects/[projectId]/page.tsx` تخته‌ی پروژه را انتخاب می‌کند.
- `app/globals.css` سبک‌های سراسری و `app/layout.tsx` پوسته‌ی Next.js را نگهداری می‌کنند.
- آزمون‌های واحد در `tests/board.test.tsx` و آزمون‌های Playwright در `tests/board.e2e.spec.ts` هستند؛ آزمون‌های موجود را همراه قابلیت‌های مربوط اصلاح کنید.
- رابط باید انگلیسی، واکنش‌گرا و دسترس‌پذیر بماند. منطق پایگاه‌داده یا کلیدهای OpenRouter را در فرانت‌اند قرار ندهید.
- آزمون‌ها و بررسی‌های مرتبط را از پوشه‌ی `frontend` اجرا کنید.
