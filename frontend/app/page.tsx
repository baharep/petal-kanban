'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useProjects } from './projects-store';

type Card = {
  id: string;
  title: string;
  details: string;
};

type Column = {
  id: string;
  title: string;
  cards: Card[];
};

type Draft = Pick<Card, 'title' | 'details'>;

const initialColumns: Column[] = [
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
    cards: [
      { id: 'progress-1', title: 'Build dashboard', details: 'Finalize the summary cards and chart layout.' },
    ],
  },
  {
    id: 'review',
    title: 'Review',
    cards: [
      { id: 'review-1', title: 'QA checklist', details: 'Check spacing, accessibility, and browser flow.' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'done-1', title: 'Brand colors', details: 'Finalize the palette and accent usage.' },
    ],
  },
  {
    id: 'blocked',
    title: 'Blocked',
    cards: [{ id: 'blocked-1', title: 'API access', details: 'Wait for final production credentials.' }],
  },
];

const emptyDraft: Draft = { title: '', details: '' };
const newCardColumnId = 'todo';

function getColumnColors(index: number): CSSProperties {
  const backgroundLightness = Math.max(96 - index * 2.5, 76);
  const accentLightness = Math.max(46 - index * 1.5, 29);
  return {
    '--column-bg': `hsl(337 76% ${backgroundLightness}%)`,
    '--column-border': `hsl(337 49% ${backgroundLightness - 9}%)`,
    '--column-accent': `hsl(337 46% ${accentLightness}%)`,
  } as CSSProperties;
}

export function Board({ projectId = 'project-board', projectName = 'Project Board' }: {
  projectId?: string;
  projectName?: string;
}) {
  const [columns, setColumns] = useState<Column[]>(() =>
    initialColumns.map((column) => ({
      ...column,
      cards: projectId === 'project-board' ? [...column.cards] : [],
    })),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initialColumns.map(({ id }) => [id, { ...emptyDraft }])),
  );
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const draggedCard = useRef<{ cardId: string; sourceColumnId: string } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [activeFormColumn, setActiveFormColumn] = useState<string | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [newCardDraft, setNewCardDraft] = useState<Draft>(emptyDraft);
  const [newCardColumn, setNewCardColumn] = useState(newCardColumnId);
  const [newColumnOpen, setNewColumnOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const projectCount = useProjects().length;

  const updateDraft = (columnId: string, field: keyof Draft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [columnId]: { ...current[columnId], [field]: value },
    }));
  };

  const addCard = (columnId: string, draft: Draft) => {
    const title = draft.title.trim();
    if (!title) return false;

    const card: Card = {
      id: crypto.randomUUID(),
      title,
      details: draft.details.trim(),
    };

    setColumns((current) =>
      current.map((column) =>
        column.id === columnId ? { ...column, cards: [...column.cards, card] } : column,
      ),
    );
    return true;
  };

  const deleteCard = (columnId: string, cardId: string) => {
    setColumns((current) =>
      current.map((column) =>
        column.id === columnId
          ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
          : column,
      ),
    );
  };

  const renameColumn = (columnId: string, title: string) => {
    setColumns((current) =>
      current.map((column) => (column.id === columnId ? { ...column, title } : column)),
    );
  };

  const addColumn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;

    setColumns((current) => [...current, { id: crypto.randomUUID(), title, cards: [] }]);
    setNewColumnTitle('');
    setNewColumnOpen(false);
    requestAnimationFrame(() => {
      boardRef.current?.scrollTo({ left: boardRef.current.scrollWidth, behavior: 'smooth' });
    });
  };

  const moveCard = (sourceColumnId: string, cardId: string, targetColumnId: string) => {
    if (sourceColumnId === targetColumnId) {
      return;
    }

    setColumns((current) => {
      const source = current.find((column) => column.id === sourceColumnId);
      const target = current.find((column) => column.id === targetColumnId);
      const card = source?.cards.find((item) => item.id === cardId);
      if (!source || !target || !card) return current;

      return current.map((column) => {
        if (column.id === source.id) {
          return { ...column, cards: column.cards.filter((item) => item.id !== card.id) };
        }
        if (column.id === target.id) {
          return { ...column, cards: [...column.cards, card] };
        }
        return column;
      });
    });
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>, targetColumnId: string) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('text/plain');
    const [sourceColumnId, cardId] = (payload || '').split(':');
    const moving = sourceColumnId && cardId ? { sourceColumnId, cardId } : draggedCard.current;

    if (moving) moveCard(moving.sourceColumnId, moving.cardId, targetColumnId);
    draggedCard.current = null;
    setDraggedCardId(null);
    setDragOverColumnId(null);
  };

  const filteredColumns = columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) =>
      `${card.title} ${card.details}`.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  }));

  const scrollBoard = (direction: -1 | 1) => {
    boardRef.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
  };

  const submitNewCard = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addCard(newCardColumn, newCardDraft)) return;
    setNewCardDraft(emptyDraft);
    setNewCardOpen(false);
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span className="brand-badge" aria-hidden="true">
            <span className="petal petal-one" />
            <span className="petal petal-two" />
            <span className="petal petal-three" />
            <span className="petal-center" />
          </span>
          <span className="brand-name">Petal<span className="brand-period">.</span></span>
        </div>
        <nav className="topbar-actions" aria-label="Workspace navigation">
          <label className="search-box">
            <span aria-hidden="true" className="search-icon" />
            <span className="sr-only">Search cards</span>
            <input
              type="search"
              aria-label="Search cards"
              placeholder="Search cards..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Link className="projects-link" href="/projects" aria-label={`View ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`}>
            <span className="projects-icon" aria-hidden="true">▦</span>
            <span>Projects</span>
            <span className="projects-count">{String(projectCount).padStart(2, '0')}</span>
          </Link>
        </nav>
      </header>

      <main className="main-content">
        <section className="intro" aria-labelledby="board-title">
          <div className="intro-copy">
            <p className="eyebrow"><span /> YOUR CREATIVE WORKSPACE</p>
            <h1 id="board-title">{projectName}</h1>
            <p className="intro-description">A clear view of your team&apos;s progress, all in one place.</p>
          </div>
          <button className="new-card-button" type="button" onClick={() => setNewCardOpen(true)}>
            <span aria-hidden="true">+</span> Bloom a card
          </button>
        </section>

        <div className="board-toolbar">
          <div className="board-heading">
            <h2 id="board-section-heading">Board</h2>
            <p>Drag a card to move it between stages</p>
          </div>
          <div className="board-actions">
            <button className="add-column-button" type="button" onClick={() => setNewColumnOpen(true)}>
              <span aria-hidden="true">+</span> Add a column
            </button>
            <div className="carousel-controls" aria-label="Scroll board">
              <button type="button" aria-label="Scroll columns left" onClick={() => scrollBoard(-1)}>‹</button>
              <button type="button" aria-label="Scroll columns right" onClick={() => scrollBoard(1)}>›</button>
            </div>
          </div>
        </div>

        <div
          className="board"
          ref={boardRef}
          role="region"
          aria-labelledby="board-section-heading"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` }}
        >
          {filteredColumns.map((column, index) => (
            <section
              className={`column${dragOverColumnId === column.id ? ' column-drop-target' : ''}`}
              style={getColumnColors(index)}
              key={column.id}
              aria-label={column.title}
              onDragOver={(event) => {
                event.preventDefault();
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
                setDragOverColumnId((current) => current === column.id ? current : column.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverColumnId(null);
                }
              }}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              <header className="column-header">
                <span className={`column-marker marker-${index + 1}`} aria-hidden="true" />
                <input
                  className="column-title"
                  aria-label={`Rename column ${index + 1}`}
                  value={column.title}
                  onChange={(event) => renameColumn(column.id, event.target.value)}
                  onBlur={(event) => {
                    if (!event.currentTarget.value.trim()) {
                      renameColumn(column.id, initialColumns[index]?.title ?? 'New column');
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
                <span className="column-count" aria-label={`${column.cards.length} cards`}>
                  {String(column.cards.length).padStart(2, '0')}
                </span>
              </header>

              <ul
                className="column-list"
                aria-label={`${column.title} cards`}
              >
                {column.cards.length === 0 ? (
                  <li className="empty-column">{search ? 'No matching cards' : 'Drop a card here'}</li>
                ) : null}
                {column.cards.map((card) => (
                  <li
                    className="card-item"
                    key={card.id}
                    data-card-id={card.id}
                    data-dragging={draggedCardId === card.id || undefined}
                    draggable
                    onDragStart={(event) => {
                      const payload = `${column.id}:${card.id}`;
                      draggedCard.current = { cardId: card.id, sourceColumnId: column.id };
                      event.dataTransfer.setData('text/plain', payload);
                      event.dataTransfer.effectAllowed = 'move';
                      setDraggedCardId(card.id);
                    }}
                    onDragEnd={() => {
                      draggedCard.current = null;
                      setDraggedCardId(null);
                      setDragOverColumnId(null);
                    }}
                  >
                    <article className="card" aria-label={card.title}>
                      <div className="card-header">
                        <h3 className="card-title">{card.title}</h3>
                        <button
                          className="delete-button"
                          type="button"
                          aria-label={`Delete ${card.title}`}
                          onClick={() => deleteCard(column.id, card.id)}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                      {card.details ? <p className="card-details">{card.details}</p> : null}
                    </article>
                  </li>
                ))}
              </ul>

              {activeFormColumn === column.id ? <form
                className="card-form"
                aria-label={`Add card to ${column.title}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (addCard(column.id, drafts[column.id] ?? emptyDraft)) {
                    setDrafts((current) => ({ ...current, [column.id]: { ...emptyDraft } }));
                    setActiveFormColumn(null);
                  }
                }}
              >
                <label className="sr-only" htmlFor={`card-title-${column.id}`}>Card title</label>
                <input
                  id={`card-title-${column.id}`}
                  className="input-field"
                  value={drafts[column.id]?.title ?? ''}
                  onChange={(event) => updateDraft(column.id, 'title', event.target.value)}
                  placeholder="Give your task a name"
                  required
                />
                <label className="sr-only" htmlFor={`card-details-${column.id}`}>Card details</label>
                <textarea
                  id={`card-details-${column.id}`}
                  className="input-field details-input"
                  value={drafts[column.id]?.details ?? ''}
                  onChange={(event) => updateDraft(column.id, 'details', event.target.value)}
                  placeholder="Add a few details..."
                  rows={2}
                />
                <div className="card-form-actions">
                  <button className="primary-button" type="submit" disabled={!drafts[column.id]?.title.trim()}>
                    Add card
                  </button>
                  <button className="cancel-button" type="button" onClick={() => setActiveFormColumn(null)}>Cancel</button>
                </div>
              </form> : (
                <button
                  className="column-add-button"
                  type="button"
                  aria-label={`Add a card to ${column.title}`}
                  onClick={() => setActiveFormColumn(column.id)}
                >
                  <span aria-hidden="true">+</span> Add a card
                </button>
              )}
            </section>
          ))}
        </div>

        <footer className="page-footer">
          <span>PETAL PROJECTS</span>
          <span>Move work forward, one card at a time.</span>
        </footer>
      </main>

      {newCardOpen ? (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setNewCardOpen(false);
        }}>
          <form
            className="new-card-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-card-dialog-title"
            aria-label="Create a new card"
            onSubmit={submitNewCard}
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Close new card dialog"
              onClick={() => setNewCardOpen(false)}
            >×</button>
            <p className="eyebrow"><span /> A FRESH IDEA</p>
            <h2 id="new-card-dialog-title">Plant a new card</h2>
            <p className="dialog-description">Give your next bit of work a place to grow.</p>
            <label htmlFor="new-card-title">Card title</label>
            <input
              id="new-card-title"
              className="input-field"
              autoFocus
              required
              value={newCardDraft.title}
              onChange={(event) => setNewCardDraft((draft) => ({ ...draft, title: event.target.value }))}
              placeholder="What are we working on?"
            />
            <label htmlFor="new-card-details">Details <span>(optional)</span></label>
            <textarea
              id="new-card-details"
              className="input-field details-input"
              rows={3}
              value={newCardDraft.details}
              onChange={(event) => setNewCardDraft((draft) => ({ ...draft, details: event.target.value }))}
              placeholder="A little context goes a long way..."
            />
            <label htmlFor="new-card-column">Add to</label>
            <select id="new-card-column" className="input-field" value={newCardColumn} onChange={(event) => setNewCardColumn(event.target.value)}>
              {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
            </select>
            <button className="new-card-submit" type="submit">Plant card <span aria-hidden="true">→</span></button>
          </form>
        </div>
      ) : null}

      {newColumnOpen ? (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setNewColumnOpen(false);
        }}>
          <form
            className="new-card-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-column-heading"
            onSubmit={addColumn}
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Close add column dialog"
              onClick={() => setNewColumnOpen(false)}
            >×</button>
            <p className="eyebrow"><span /> NEW STAGE</p>
            <h2 id="new-column-heading">Add a column</h2>
            <p className="dialog-description">Create another step for your project.</p>
            <label htmlFor="new-column-title">Column name</label>
            <input
              id="new-column-title"
              className="input-field"
              autoFocus
              required
              value={newColumnTitle}
              onChange={(event) => setNewColumnTitle(event.target.value)}
              placeholder="Name this stage"
            />
            <button className="new-card-submit" type="submit" disabled={!newColumnTitle.trim()}>
              Add column <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  return <Board />;
}
