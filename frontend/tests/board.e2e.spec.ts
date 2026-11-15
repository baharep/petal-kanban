import { expect, test } from '@playwright/test';
import { signInAndResetBoard } from './e2e-helpers';

test.beforeEach(async ({ page }) => {
  await signInAndResetBoard(page);
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
  await expect(page.getByText('All changes saved.')).toBeVisible();
  await review.getByRole('button', { name: 'Delete Browser test card' }).click();
  await expect(review.getByText('Browser test card')).toHaveCount(0);
  await expect(page.getByText('All changes saved.')).toBeVisible();
});

test('renames a column and preserves its cards', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Rename column 1' }).fill('Ideas');

  const ideas = page.getByRole('region', { name: 'Ideas' });
  await expect(ideas).toBeVisible();
  await expect(ideas.getByText('Design homepage')).toBeVisible();
  await page.getByRole('textbox', { name: 'Rename column 1' }).press('Enter');
  await expect(page.getByText('All changes saved.')).toBeVisible();
});

test('moves a card by dragging it into another stage', async ({ page }) => {
  const source = page.getByRole('list', { name: 'To do cards' });
  await page.getByRole('button', { name: 'Delete API access' }).click();
  const target = page.getByRole('list', { name: 'Blocked cards' });

  await source.locator('[data-card-id="todo-1"]').dragTo(target);

  await expect(source.getByText('Design homepage')).toHaveCount(0);
  await expect(target.getByText('Design homepage')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Blocked' })).not.toContainText('Drop a card here');
  await expect(page.getByText('All changes saved.')).toBeVisible();
});

test('reorders cards within the same stage by dragging', async ({ page }) => {
  const cards = page.getByRole('list', { name: 'To do cards' });
  await cards.locator('[data-card-id="todo-1"]').dragTo(cards.locator('[data-card-id="todo-2"]'));

  await expect(cards.locator('[data-card-id]').first()).toHaveAttribute('data-card-id', 'todo-2');
  await expect(cards.locator('[data-card-id]').nth(1)).toHaveAttribute('data-card-id', 'todo-1');
  await expect(page.getByText('All changes saved.')).toBeVisible();
});

test('creates a card from the main action and selects its stage', async ({ page }) => {
  await page.getByRole('button', { name: 'Bloom a card' }).click();

  const form = page.getByRole('dialog', { name: 'Plant a new card' });
  await form.getByLabel('Card title').fill('A new bloom');
  await form.getByLabel('Add to').selectOption('done');
  await form.getByRole('button', { name: 'Plant card' }).click();

  await expect(page.getByRole('list', { name: 'Done cards' }).getByText('A new bloom')).toBeVisible();
  await expect(form).toHaveCount(0);
  await expect(page.getByText('All changes saved.')).toBeVisible();
});

test('searches cards by title and details', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search cards' }).fill('campaign');

  await expect(page.getByText('Review copy')).toBeVisible();
  await expect(page.getByText('Design homepage')).toHaveCount(0);
});

test('sends a conversation to a mocked assistant and applies its board update', async ({ page }) => {
  const updatedBoard = await page.evaluate(async () => {
    const response = await fetch('/api/projects/project-board/board');
    return response.json();
  });
  updatedBoard.columns[0].cards[0].title = 'Assistant reviewed homepage';
  let requestBody: unknown;

  await page.route('**/api/projects/project-board/assistant', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'I updated the homepage task.',
        board: updatedBoard,
      }),
    });
  });

  const assistant = page.getByRole('region', { name: 'Petal assistant' });
  await assistant.getByLabel('Your message').fill('Review the homepage task.');
  await assistant.getByRole('button', { name: 'Send message' }).click();

  await expect(assistant.getByText('I updated the homepage task.')).toBeVisible();
  await expect(page.getByText('Assistant reviewed homepage')).toBeVisible();
  expect(requestBody).toEqual({
    message: 'Review the homepage task.',
    history: [],
  });
});

test('keeps the assistant usable without horizontal page overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });

  const assistant = page.getByRole('region', { name: 'Petal assistant' });
  await expect(assistant.getByLabel('Your message')).toBeVisible();
  await expect(assistant.getByRole('button', { name: 'Send message' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('opens the project window and returns to the board', async ({ page }) => {
  await page.getByRole('link', { name: /View \d+ projects?/ }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { name: 'Your projects.' })).toBeVisible();
  await page.getByRole('link', { name: /Project Board/ }).click();
  await expect(page).toHaveURL('/');
});

test('creates a project and opens its board', async ({ page }) => {
  await page.getByRole('link', { name: /View \d+ projects?/ }).click();
  await page.getByRole('button', { name: 'New project' }).click();

  const dialog = page.getByRole('dialog', { name: 'Grow a project' });
  await dialog.getByLabel('Project name').fill('Spring launch');
  await dialog.getByRole('button', { name: 'Create project' }).click();

  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Board', exact: true }).locator('.column')).toHaveCount(5);
  await expect(page.getByRole('list', { name: 'To do cards' })).toContainText('Drop a card here');
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

test('persists board changes after a page reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a card to To do' }).click();
  const form = page.getByRole('form', { name: 'Add card to To do' });
  await form.getByLabel('Card title').fill('Persistent task');
  await form.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByText('All changes saved.')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('list', { name: 'To do cards' }).getByText('Persistent task')).toBeVisible();
});

test('imports legacy project names once and keeps the browser copy', async ({ page }) => {
  const legacyProjects = [{ id: 'legacy-project-e2e', name: 'Legacy garden' }];
  await page.evaluate((projects) => {
    localStorage.setItem('petal-projects', JSON.stringify(projects));
    localStorage.removeItem('petal-projects-migration-v1');
  }, legacyProjects);
  await page.reload();

  await page.getByRole('link', { name: /View \d+ projects?/ }).click();
  const legacyProjectLink = page.getByRole('link', { name: /Legacy garden/ });
  await expect(legacyProjectLink).toBeVisible();
  await legacyProjectLink.click();
  await expect(page.getByRole('heading', { name: 'Legacy garden' })).toBeVisible();

  const storedProjects = await page.evaluate(() => localStorage.getItem('petal-projects'));
  expect(JSON.parse(storedProjects ?? 'null')).toEqual(legacyProjects);
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('petal-projects-migration-v1')))
    .toBe('complete');
});

test('adds another column and scrolls the board to it', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a column' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a column' });
  await dialog.getByLabel('Column name').fill('Launch');
  await dialog.getByRole('button', { name: 'Add column', exact: true }).click();

  const board = page.getByRole('region', { name: 'Board', exact: true });
  await expect(board.locator('.column')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Launch' })).toBeVisible();
  await expect(page.getByText('All changes saved.')).toBeVisible();
  await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const previousScroll = await board.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Scroll columns left' }).click();
  await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeLessThan(previousScroll);
});
