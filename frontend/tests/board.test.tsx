import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../app/page';
import type { ProjectBoard } from '../app/projects-store';
import { resetProjects } from '../app/projects-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe('Board', () => {
  let board: ProjectBoard;

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    board = {
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
    localStorage.clear();
    localStorage.setItem('petal-projects-migration-v1', 'complete');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/projects') {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'project-board', name: 'Project Board' }],
        } as Response;
      }
      if (path === '/api/projects/project-board/board') {
        if (init?.method === 'PUT') board = JSON.parse(String(init.body)) as ProjectBoard;
        return { ok: true, status: 200, json: async () => board } as Response;
      }
      throw new Error(`Unexpected API request: ${path}`);
    }));
    resetProjects();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    resetProjects();
  });

  async function renderBoard() {
    render(<Board />);
    await screen.findByText('Design homepage');
  }

  it('renders exactly five editable columns and the sample cards', async () => {
    await renderBoard();

    expect(screen.getByRole('heading', { name: 'Project Board' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: /^Rename column/ })).toHaveLength(5);
    expect(screen.getByText('Design homepage')).toBeInTheDocument();
    expect(screen.getByText('Build dashboard')).toBeInTheDocument();
    expect(screen.getByText('Brand colors')).toBeInTheDocument();
  });

  it('adds a card with its title and optional details to the selected column', async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Add a card to To do' }));
    const form = screen.getByRole('form', { name: 'Add card to To do' });
    fireEvent.change(within(form).getByLabelText('Card title'), { target: { value: 'New Task' } });
    fireEvent.change(within(form).getByLabelText('Card details'), { target: { value: 'Write tests' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add card' }));

    expect(within(screen.getByRole('list', { name: 'To do cards' })).getByText('New Task')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'To do cards' })).getByText('Write tests')).toBeInTheDocument();
    await screen.findByText('All changes saved.');
    expect(screen.queryByRole('form', { name: 'Add card to To do' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a card to To do' })).toBeInTheDocument();
  });

  it('requires a title and allows details to be left empty', async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Add a card to To do' }));
    const form = screen.getByRole('form', { name: 'Add card to To do' });
    expect(within(form).getByRole('button', { name: 'Add card' })).toBeDisabled();

    fireEvent.change(within(form).getByLabelText('Card title'), { target: { value: '  A title  ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add card' }));

    expect(await within(screen.getByRole('list', { name: 'To do cards' })).findByText('A title')).toBeInTheDocument();
    await screen.findByText('All changes saved.');
  });

  it('deletes only the selected card', async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Design homepage' }));

    expect(screen.queryByText('Design homepage')).not.toBeInTheDocument();
    expect(screen.getByText('Review copy')).toBeInTheDocument();
    await screen.findByText('All changes saved.');
  });

  it('reports a failed save and retries the current board', async () => {
    await renderBoard();
    vi.mocked(fetch).mockImplementationOnce(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as Response);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Design homepage' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save changes.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('All changes saved.');
  });

  it('renames a column without changing its identity or cards', async () => {
    await renderBoard();

    fireEvent.change(screen.getByRole('textbox', { name: 'Rename column 1' }), {
      target: { value: 'Ideas' },
    });

    expect(screen.getByRole('region', { name: 'Ideas' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Ideas cards' })).toHaveTextContent('Design homepage');
    fireEvent.blur(screen.getByRole('textbox', { name: 'Rename column 1' }));
    await screen.findByText('All changes saved.');
  });

  it('moves a card between columns using drag and drop', async () => {
    await renderBoard();

    const source = screen.getByRole('list', { name: 'To do cards' });
    const target = screen.getByRole('region', { name: 'In progress' });
    const card = source.querySelector('[data-card-id="todo-1"]');
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => 'todo:todo-1'),
    };

    expect(card).not.toBeNull();
    fireEvent.dragStart(card!, { dataTransfer });
    fireEvent.dragOver(target);
    fireEvent.drop(target, { dataTransfer });

    expect(source).not.toHaveTextContent('Design homepage');
    expect(screen.getByRole('list', { name: 'In progress cards' })).toHaveTextContent('Design homepage');
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'todo:todo-1');
    await screen.findByText('All changes saved.');
  });

  it('moves a card to the end when dropped in its current column', async () => {
    await renderBoard();

    const source = screen.getByRole('list', { name: 'To do cards' });
    const card = source.querySelector('[data-card-id="todo-1"]');
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => 'todo:todo-1'),
    };

    expect(card).not.toBeNull();
    fireEvent.dragStart(card!, { dataTransfer });
    fireEvent.drop(source, { dataTransfer });

    expect(Array.from(source.querySelectorAll('[data-card-id]')).map((item) => item.getAttribute('data-card-id')))
      .toEqual(['todo-2', 'todo-1']);
    await screen.findByText('All changes saved.');
  });

  it('creates a card from the prominent action in a chosen column', async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Bloom a card' }));
    const form = screen.getByRole('dialog', { name: 'Plant a new card' });
    fireEvent.change(within(form).getByLabelText('Card title'), { target: { value: 'Fresh idea' } });
    fireEvent.change(within(form).getByLabelText('Add to'), { target: { value: 'review' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Plant card' }));

    expect(screen.getByRole('list', { name: 'Review cards' })).toHaveTextContent('Fresh idea');
    expect(screen.queryByRole('dialog', { name: 'Plant a new card' })).not.toBeInTheDocument();
    await screen.findByText('All changes saved.');
  });

  it('searches cards by title and details', async () => {
    await renderBoard();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cards' }), {
      target: { value: 'campaign' },
    });

    expect(screen.getByText('Review copy')).toBeInTheDocument();
    expect(screen.queryByText('Design homepage')).not.toBeInTheDocument();
  });

  it('adds a named column to the board', async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Add a column' }));
    const form = screen.getByRole('dialog', { name: 'Add a column' });
    fireEvent.change(within(form).getByLabelText('Column name'), { target: { value: 'Launch' } });
    fireEvent.click(within(form).getByRole('button', { name: /^Add column$/ }));

    expect(screen.getAllByRole('textbox', { name: /^Rename column/ })).toHaveLength(6);
    expect(screen.getByRole('region', { name: 'Launch' })).toBeInTheDocument();
    await screen.findByText('All changes saved.');
  });
});
