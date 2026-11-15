'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ApiError, getApiErrorMessage, requestApiJson } from './api-client';
import { LogoutButton } from './auth-actions';
import { BoardAssistant } from './board-assistant';
import type { Card, Column, ProjectBoard } from './projects-store';
import { refreshProjects, useProjects } from './projects-store';

type Draft = Pick<Card, 'title' | 'details'>;

const emptyDraft: Draft = { title: '', details: '' };

function getColumnColors(index: number): CSSProperties {
  const backgroundLightness = Math.max(96 - index * 2.5, 76);
  const accentLightness = Math.max(46 - index * 1.5, 29);
  return {
    '--column-bg': `hsl(337 76% ${backgroundLightness}%)`,
    '--column-border': `hsl(337 49% ${backgroundLightness - 9}%)`,
    '--column-accent': `hsl(337 46% ${accentLightness}%)`,
  } as CSSProperties;
}

export function Board({ projectId = 'project-board' }: {
  projectId?: string;
}) {
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const currentBoardRef = useRef<ProjectBoard | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error' | 'unauthenticated'>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveErrorStatus, setSaveErrorStatus] = useState<number | null>(null);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveVersion = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const draggedCard = useRef<{ cardId: string; sourceColumnId: string } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [activeFormColumn, setActiveFormColumn] = useState<string | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [newCardDraft, setNewCardDraft] = useState<Draft>(emptyDraft);
  const [newCardColumn, setNewCardColumn] = useState('');
  const [newColumnOpen, setNewColumnOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const projectsState = useProjects();
  const projectCount = projectsState.projects.length;

  useEffect(() => {
    const controller = new AbortController();
    saveVersion.current += 1;
    currentBoardRef.current = null;

    void requestApiJson<ProjectBoard>(
      `/api/projects/${encodeURIComponent(projectId)}/board`,
      { signal: controller.signal },
    ).then((loadedBoard) => {
      if (controller.signal.aborted) return;
      currentBoardRef.current = loadedBoard;
      setBoard(loadedBoard);
      setDrafts(Object.fromEntries(loadedBoard.columns.map(({ id }) => [id, { ...emptyDraft }])));
      setNewCardColumn(loadedBoard.columns[0]?.id ?? '');
      setLoadStatus('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setLoadStatus(error instanceof ApiError && error.status === 401 ? 'unauthenticated' : 'error');
      setLoadError(
        error instanceof ApiError && error.status === 404
          ? 'Project not found. Return to your project list and try again.'
          : getApiErrorMessage(error, 'Could not load this board. Check your connection and try again.'),
      );
    });

    return () => controller.abort();
  }, [projectId, loadAttempt]);

  const persistBoard = useCallback((nextBoard: ProjectBoard): Promise<boolean> => {
    const version = ++saveVersion.current;
    setSaveStatus('saving');
    setSaveError('');
    setSaveErrorStatus(null);
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await requestApiJson<ProjectBoard>(
          `/api/projects/${encodeURIComponent(projectId)}/board`,
          { method: 'PUT', body: JSON.stringify(nextBoard) },
        );
        if (version === saveVersion.current) setSaveStatus('saved');
        return true;
      } catch (error: unknown) {
        if (version === saveVersion.current) {
          setSaveStatus('error');
          setSaveError(getApiErrorMessage(error, 'Could not save changes. Keep this page open and try again.'));
          setSaveErrorStatus(error instanceof ApiError ? error.status : null);
        }
        return false;
      }
    });
    return saveQueue.current;
  }, [projectId]);

  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (currentBoardRef.current) void persistBoard(currentBoardRef.current);
    }
  }, [persistBoard]);

  const scheduleBoardSave = (nextBoard: ProjectBoard) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      persistBoard(nextBoard);
    }, 350);
  };

  const flushBoardSave = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (currentBoardRef.current) return persistBoard(currentBoardRef.current);
    }
    return saveQueue.current;
  };

  const applyAssistantBoard = useCallback((updatedBoard: ProjectBoard) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveVersion.current += 1;
    currentBoardRef.current = updatedBoard;
    setBoard(updatedBoard);
    setDrafts((current) => Object.fromEntries(
      updatedBoard.columns.map(({ id }) => [id, current[id] ?? { ...emptyDraft }]),
    ));
    setNewCardColumn((current) =>
      updatedBoard.columns.some((column) => column.id === current)
        ? current
        : updatedBoard.columns[0]?.id ?? '',
    );
    setSaveStatus('saved');
    setSaveError('');
    setSaveErrorStatus(null);
  }, [setNewCardColumn]);

  const updateColumns = (
    update: (current: Column[]) => Column[],
    delayed = false,
  ) => {
    const currentBoard = currentBoardRef.current;
    if (!currentBoard) return;
    const columns = update(currentBoard.columns);
    if (columns === currentBoard.columns) return;
    const nextBoard = { ...currentBoard, columns };
    currentBoardRef.current = nextBoard;
    setBoard(nextBoard);
    if (delayed) scheduleBoardSave(nextBoard);
    else {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      persistBoard(nextBoard);
    }
  };

  const updateDraft = (columnId: string, field: keyof Draft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [columnId]: { ...(current[columnId] ?? emptyDraft), [field]: value },
    }));
  };

  const addCard = (columnId: string, draft: Draft) => {
    const title = draft.title.trim();
    if (!title || !currentBoardRef.current?.columns.some((column) => column.id === columnId)) return false;

    const card: Card = {
      id: crypto.randomUUID(),
      title,
      details: draft.details.trim(),
    };

    updateColumns((current) =>
      current.map((column) =>
        column.id === columnId ? { ...column, cards: [...column.cards, card] } : column,
      ),
    );
    return true;
  };

  const deleteCard = (columnId: string, cardId: string) => {
    updateColumns((current) =>
      current.map((column) =>
        column.id === columnId
          ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
          : column,
      ),
    );
  };

  const renameColumn = (columnId: string, title: string) => {
    updateColumns((current) =>
      current.map((column) => (column.id === columnId ? { ...column, title } : column)),
      true,
    );
  };

  const addColumn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;

    updateColumns((current) => [...current, { id: crypto.randomUUID(), title, cards: [] }]);
    setNewColumnTitle('');
    setNewColumnOpen(false);
    requestAnimationFrame(() => {
      boardRef.current?.scrollTo({ left: boardRef.current.scrollWidth, behavior: 'smooth' });
    });
  };

  const moveCard = (
    sourceColumnId: string,
    cardId: string,
    targetColumnId: string,
    targetCardId?: string,
    position: 'before' | 'after' = 'after',
  ) => {
    updateColumns((current) => {
      const source = current.find((column) => column.id === sourceColumnId);
      const target = current.find((column) => column.id === targetColumnId);
      const card = source?.cards.find((item) => item.id === cardId);
      if (!source || !target || !card) return current;

      if (source.id === target.id) {
        if (targetCardId === cardId) return current;

        const sourceIndex = source.cards.findIndex((item) => item.id === cardId);
        const targetIndex = targetCardId
          ? source.cards.findIndex((item) => item.id === targetCardId)
          : source.cards.length;
        if (sourceIndex < 0 || targetIndex < 0) return current;

        let insertionIndex = targetIndex + (position === 'after' && targetCardId ? 1 : 0);
        if (sourceIndex < insertionIndex) insertionIndex -= 1;

        const cards = [...source.cards];
        cards.splice(sourceIndex, 1);
        cards.splice(insertionIndex, 0, card);
        if (cards.every((item, index) => item.id === source.cards[index].id)) return current;

        return current.map((column) =>
          column.id === source.id ? { ...column, cards } : column,
        );
      }

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

  const handleDrop = (
    event: React.DragEvent<HTMLElement>,
    targetColumnId: string,
    targetCardId?: string,
  ) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('text/plain');
    const [sourceColumnId, cardId] = (payload || '').split(':');
    const moving = sourceColumnId && cardId ? { sourceColumnId, cardId } : draggedCard.current;

    if (moving) {
      const targetCard = targetCardId
        ? event.currentTarget
        : event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-card-id]')
          : null;
      const dropTargetCardId = targetCardId ?? targetCard?.dataset.cardId;
      const bounds = targetCard?.getBoundingClientRect();
      const midpoint = bounds ? Math.round(bounds.top + bounds.height / 2) : null;
      const position = midpoint !== null && event.clientY >= midpoint ? 'after' : 'before';
      moveCard(moving.sourceColumnId, moving.cardId, targetColumnId, dropTargetCardId, position);
    }
    draggedCard.current = null;
    setDraggedCardId(null);
    setDragOverColumnId(null);
  };

  const columns = board?.columns ?? [];
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

  const retryBoardLoad = () => {
    setLoadError('');
    setLoadStatus('loading');
    setLoadAttempt((attempt) => attempt + 1);
  };

  if (loadStatus !== 'ready' || !board) {
    const message = loadStatus === 'loading'
      ? 'Loading board...'
      : loadError;

    return (
      <div className="page-shell">
        <header className="topbar">
          <Link className="brand-mark" href="/" aria-label="Petal home">
            <span className="brand-badge" aria-hidden="true">
              <span className="petal petal-one" />
              <span className="petal petal-two" />
              <span className="petal petal-three" />
              <span className="petal-center" />
            </span>
            <span className="brand-name">Petal<span className="brand-period">.</span></span>
          </Link>
        </header>
        <main className="projects-page">
          <p role={loadStatus === 'error' || loadStatus === 'unauthenticated' ? 'alert' : 'status'}>
            {message}
          </p>
          {loadStatus === 'error' ? (
            <button className="projects-link" type="button" onClick={retryBoardLoad}>
              Try again
            </button>
          ) : null}
          {loadStatus === 'unauthenticated' ? <Link className="projects-link" href="/login">Sign in</Link> : null}
          <Link className="projects-link" href="/projects">All projects</Link>
        </main>
      </div>
    );
  }

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
          <LogoutButton />
        </nav>
      </header>

      <main className="main-content">
        {projectsState.migrationError ? (
          <div className="data-message" role="alert">
            <p>{projectsState.migrationError}</p>
            <button type="button" className="inline-action" onClick={() => void refreshProjects()}>
              Retry import
            </button>
          </div>
        ) : null}
        <div className="board-workspace" inert={assistantBusy}>
        <section className="intro" aria-labelledby="board-title">
          <div className="intro-copy">
            <p className="eyebrow"><span /> YOUR CREATIVE WORKSPACE</p>
            <h1 id="board-title">{board.projectName}</h1>
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
            {saveStatus === 'saving' ? <p className="board-save-status" role="status">Saving changes...</p> : null}
            {saveStatus === 'saved' ? <p className="board-save-status" role="status">All changes saved.</p> : null}
            {saveStatus === 'error' ? (
              <p className="board-save-status" role="alert">
                {saveError}{' '}
                {saveErrorStatus === 401 ? <Link href="/login">Sign in</Link> : null}{' '}
                <button className="inline-action" type="button" onClick={() => {
                  if (currentBoardRef.current) persistBoard(currentBoardRef.current);
                }}>Retry</button>
              </p>
            ) : null}
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
                    const title = event.currentTarget.value.trim() || `Stage ${index + 1}`;
                    if (title !== column.title) renameColumn(column.id, title);
                    void flushBoardSave();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  maxLength={120}
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
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.stopPropagation();
                      handleDrop(event, column.id, card.id);
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
                  maxLength={200}
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
                  maxLength={5000}
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
        </div>

        <BoardAssistant
          projectId={projectId}
          busy={assistantBusy}
          onBusyChange={setAssistantBusy}
          beforeRequest={flushBoardSave}
          onBoardUpdate={applyAssistantBoard}
        />
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
              maxLength={200}
            />
            <label htmlFor="new-card-details">Details <span>(optional)</span></label>
            <textarea
              id="new-card-details"
              className="input-field details-input"
              rows={3}
              value={newCardDraft.details}
              onChange={(event) => setNewCardDraft((draft) => ({ ...draft, details: event.target.value }))}
              placeholder="A little context goes a long way..."
              maxLength={5000}
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
              maxLength={120}
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
