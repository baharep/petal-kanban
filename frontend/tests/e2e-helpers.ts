import { expect, type Page } from '@playwright/test';

export const apiOrigin = 'http://127.0.0.1:8101';

const sampleBoard = {
  projectId: 'project-board',
  projectName: 'Project Board',
  columns: [
    {
      id: 'todo',
      title: 'To do',
      cards: [
        { id: 'todo-1', title: 'Design homepage', details: 'Update the hero section and CTA layout.' },
        { id: 'todo-2', title: 'Review copy', details: 'Align the product text with the new campaign.' },
      ],
    },
    {
      id: 'in-progress',
      title: 'In progress',
      cards: [{ id: 'progress-1', title: 'Build dashboard', details: 'Finalize the summary cards and chart layout.' }],
    },
    {
      id: 'review',
      title: 'Review',
      cards: [{ id: 'review-1', title: 'QA checklist', details: 'Check spacing, accessibility, and browser flow.' }],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [{ id: 'done-1', title: 'Brand colors', details: 'Finalize the palette and accent usage.' }],
    },
    {
      id: 'blocked',
      title: 'Blocked',
      cards: [{ id: 'blocked-1', title: 'API access', details: 'Wait for final production credentials.' }],
    },
  ],
};

export async function signInAndResetBoard(page: Page) {
  const login = await page.request.post(`${apiOrigin}/api/auth/login`, {
    data: { username: 'user', password: 'password' },
  });
  expect(login.ok()).toBe(true);

  const reset = await page.request.put(`${apiOrigin}/api/projects/project-board/board`, {
    data: sampleBoard,
  });
  expect(reset.ok()).toBe(true);
  await page.goto('/');
}
