import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows the five stages and the sample project cards', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Project Board' })).toBeVisible();
  const board = page.getByRole('region', { name: 'Board', exact: true });
  await expect(board.locator('.column')).toHaveCount(5);
  await expect(page.getByText('Design homepage')).toBeVisible();
  await expect(page.getByText('API access')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await board.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
    await board.evaluate((element) => element.clientWidth),
  );
});

test('adds and deletes a card', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a card to Review' }).click();
  const form = page.getByRole('form', { name: 'Add card to Review' });
  await form.getByLabel('Card title').fill('Browser test card');
  await form.getByLabel('Card details').fill('Created by Playwright');
  await form.getByRole('button', { name: 'Add card' }).click();

  const review = page.getByRole('region', { name: 'Review' });
  await expect(review.getByText('Browser test card')).toBeVisible();
  await expect(review.getByText('Created by Playwright')).toBeVisible();
  await review.getByRole('button', { name: 'Delete Browser test card' }).click();
  await expect(review.getByText('Browser test card')).toHaveCount(0);
});

test('renames a column and preserves its cards', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Rename column 1' }).fill('Ideas');

  const ideas = page.getByRole('region', { name: 'Ideas' });
  await expect(ideas).toBeVisible();
  await expect(ideas.getByText('Design homepage')).toBeVisible();
});

test('moves a card by dragging it into another stage', async ({ page }) => {
  const source = page.getByRole('list', { name: 'To do cards' });
  await page.getByRole('button', { name: 'Delete API access' }).click();
  const target = page.getByRole('list', { name: 'Blocked cards' });

  await source.locator('[data-card-id="todo-1"]').dragTo(target);

  await expect(source.getByText('Design homepage')).toHaveCount(0);
  await expect(target.getByText('Design homepage')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Blocked' })).not.toContainText('Drop a card here');
});

test('creates a card from the main action and selects its stage', async ({ page }) => {
  await page.getByRole('button', { name: 'Bloom a card' }).click();

  const form = page.getByRole('dialog', { name: 'Plant a new card' });
  await form.getByLabel('Card title').fill('A new bloom');
  await form.getByLabel('Add to').selectOption('done');
  await form.getByRole('button', { name: 'Plant card' }).click();

  await expect(page.getByRole('list', { name: 'Done cards' }).getByText('A new bloom')).toBeVisible();
  await expect(form).toHaveCount(0);
});

test('searches cards by title and details', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search cards' }).fill('campaign');

  await expect(page.getByText('Review copy')).toBeVisible();
  await expect(page.getByText('Design homepage')).toHaveCount(0);
});

test('opens the project window and returns to the board', async ({ page }) => {
  await page.getByRole('link', { name: 'View 1 project' }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { name: 'Your projects.' })).toBeVisible();
  await page.getByRole('link', { name: /Project Board/ }).click();
  await expect(page).toHaveURL('/');
});

test('creates a project and opens its board', async ({ page }) => {
  await page.getByRole('link', { name: 'View 1 project' }).click();
  await page.getByRole('button', { name: 'New project' }).click();

  const dialog = page.getByRole('dialog', { name: 'Grow a project' });
  await dialog.getByLabel('Project name').fill('Spring launch');
  await dialog.getByRole('button', { name: 'Create project' }).click();

  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Board', exact: true }).locator('.column')).toHaveCount(5);
  await expect(page.getByRole('list', { name: 'To do cards' })).toContainText('Drop a card here');
});

test('adds another column and scrolls the board to it', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a column' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a column' });
  await dialog.getByLabel('Column name').fill('Launch');
  await dialog.getByRole('button', { name: 'Add column', exact: true }).click();

  const board = page.getByRole('region', { name: 'Board', exact: true });
  await expect(board.locator('.column')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Launch' })).toBeVisible();
  await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const previousScroll = await board.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Scroll columns left' }).click();
  await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeLessThan(previousScroll);
});

test('keeps all five columns usable in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });

  const board = page.getByRole('region', { name: 'Board', exact: true });
  await expect(board.locator('.column')).toHaveCount(5);
  await expect(board).toHaveCSS('overflow-x', 'auto');
  expect(await board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.getByRole('region', { name: 'Blocked' })).toBeAttached();
  await page.getByRole('button', { name: 'Scroll columns right' }).click();
  await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});
