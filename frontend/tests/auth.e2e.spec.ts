import { expect, test } from '@playwright/test';

test('redirects unauthenticated visitors to sign in', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});

test('rejects invalid credentials and accepts the demo account', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Username').fill('user');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.auth-error')).toHaveText('Invalid username or password.');

  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Project Board' })).toBeVisible();
  const sessionCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'petal_session');
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('petal_session');
});

test('logs out and protects project routes', async ({ page }) => {
  await page.request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { username: 'user', password: 'password' },
  });
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Your projects.' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login$/);
});
