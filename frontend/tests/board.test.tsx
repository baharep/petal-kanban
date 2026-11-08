import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Board } from '../app/page';

describe('Board', () => {
  it('renders exactly five editable columns and the sample cards', () => {
    render(<Board />);

    expect(screen.getByRole('heading', { name: 'Project Board' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: /^Rename column/ })).toHaveLength(5);
    expect(screen.getByText('Design homepage')).toBeInTheDocument();
    expect(screen.getByText('Build dashboard')).toBeInTheDocument();
    expect(screen.getByText('Brand colors')).toBeInTheDocument();
  });

  it('adds a card with its title and optional details to the selected column', () => {
    render(<Board />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a card to To do' }));
    const form = screen.getByRole('form', { name: 'Add card to To do' });
    fireEvent.change(within(form).getByLabelText('Card title'), { target: { value: 'New Task' } });
    fireEvent.change(within(form).getByLabelText('Card details'), { target: { value: 'Write tests' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add card' }));

    expect(within(screen.getByRole('list', { name: 'To do cards' })).getByText('New Task')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'To do cards' })).getByText('Write tests')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Add card to To do' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a card to To do' })).toBeInTheDocument();
  });

  it('requires a title and allows details to be left empty', () => {
    render(<Board />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a card to To do' }));
    const form = screen.getByRole('form', { name: 'Add card to To do' });
    expect(within(form).getByRole('button', { name: 'Add card' })).toBeDisabled();

    fireEvent.change(within(form).getByLabelText('Card title'), { target: { value: '  A title  ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add card' }));

    expect(within(screen.getByRole('list', { name: 'To do cards' })).getByText('A title')).toBeInTheDocument();
  });

  it('deletes only the selected card', () => {
    render(<Board />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Design homepage' }));

    expect(screen.queryByText('Design homepage')).not.toBeInTheDocument();
    expect(screen.getByText('Review copy')).toBeInTheDocument();
  });

  it('renames a column without changing its identity or cards', () => {
    render(<Board />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Rename column 1' }), {
      target: { value: 'Ideas' },
    });

    expect(screen.getByRole('region', { name: 'Ideas' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Ideas cards' })).toHaveTextContent('Design homepage');
  });

  it('moves a card between columns using drag and drop', () => {
    render(<Board />);

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
  });

  it('creates a card from the prominent action in a chosen column', () => {
    render(<Board />);

    fireEvent.click(screen.getByRole('button', { name: 'Bloom a card' }));
    const form = screen.getByRole('dialog', { name: 'Plant a new card' });
    fireEvent.change(within(form).getByLabelText('Card title'), { target: { value: 'Fresh idea' } });
    fireEvent.change(within(form).getByLabelText('Add to'), { target: { value: 'review' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Plant card' }));

    expect(screen.getByRole('list', { name: 'Review cards' })).toHaveTextContent('Fresh idea');
    expect(screen.queryByRole('dialog', { name: 'Plant a new card' })).not.toBeInTheDocument();
  });

  it('searches cards by title and details', () => {
    render(<Board />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cards' }), {
      target: { value: 'campaign' },
    });

    expect(screen.getByText('Review copy')).toBeInTheDocument();
    expect(screen.queryByText('Design homepage')).not.toBeInTheDocument();
  });

  it('adds a named column to the board', () => {
    render(<Board />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a column' }));
    const form = screen.getByRole('dialog', { name: 'Add a column' });
    fireEvent.change(within(form).getByLabelText('Column name'), { target: { value: 'Launch' } });
    fireEvent.click(within(form).getByRole('button', { name: /^Add column$/ }));

    expect(screen.getAllByRole('textbox', { name: /^Rename column/ })).toHaveLength(6);
    expect(screen.getByRole('region', { name: 'Launch' })).toBeInTheDocument();
  });
});
