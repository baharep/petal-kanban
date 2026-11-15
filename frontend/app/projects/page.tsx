'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, getApiErrorMessage } from '../api-client';
import { LogoutButton } from '../auth-actions';
import { createProject, refreshProjects, useProjects } from '../projects-store';

function PetalMark({ className = '' }: { className?: string }) {
  return (
    <span className={`project-tile-mark ${className}`} aria-hidden="true">
      <span className="petal petal-one" />
      <span className="petal petal-two" />
      <span className="petal petal-three" />
      <span className="petal-center" />
    </span>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const projectsState = useProjects();
  const { projects } = projectsState;
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createErrorStatus, setCreateErrorStatus] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;

    setCreateError('');
    setIsSubmitting(true);
    try {
      const project = await createProject(name);
      router.push(`/projects/${project.id}`);
    } catch (error) {
      setCreateError(getApiErrorMessage(error, 'Could not create the project. Please try again.'));
      setCreateErrorStatus(error instanceof ApiError ? error.status : null);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Link className="projects-link" href="/">
          <span aria-hidden="true">←</span> Back to board
        </Link>
        <nav className="topbar-actions" aria-label="Account actions">
          <LogoutButton />
        </nav>
      </header>
      <main className="projects-page">
        <div className="projects-title-row">
          <div>
            <p className="eyebrow"><span /> YOUR WORKSPACE</p>
            <h1>Your projects<span className="brand-period">.</span></h1>
            <p className="intro-description">One little garden for everything you&apos;re growing.</p>
          </div>
          <button
            className="new-card-button"
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={projectsState.status !== 'ready'}
          >
            <span aria-hidden="true">+</span> New project
          </button>
        </div>
        {projectsState.migrationError ? (
          <div className="data-message" role="alert">
            <p>{projectsState.migrationError}</p>
            <button type="button" className="inline-action" onClick={() => void refreshProjects()}>
              Retry import
            </button>
          </div>
        ) : null}
        {projectsState.status === 'loading' ? (
          <p role="status">Loading projects...</p>
        ) : projectsState.status === 'error' || projectsState.status === 'unauthenticated' ? (
          <div className="data-message" role="alert">
            <p>{projectsState.error}</p>
            {projectsState.status === 'unauthenticated' ? (
              <Link className="inline-action" href="/login">Sign in</Link>
            ) : (
              <button type="button" className="inline-action" onClick={() => void refreshProjects()}>
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="project-list">
              {projects.map((project) => (
                <Link
                  className="project-tile"
                  href={project.id === 'project-board' ? '/' : `/projects/${project.id}`}
                  key={project.id}
                >
                  <PetalMark />
                  <span className="project-tile-copy">
                    <strong>{project.name}</strong>
                    <span>Five stages · Your team&apos;s work</span>
                  </span>
                  <span className="project-tile-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
            <p className="project-count-note">
              {String(projects.length).padStart(2, '0')} {projects.length === 1 ? 'project' : 'projects'} in your workspace
            </p>
          </>
        )}
      </main>

      {isCreating ? (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsCreating(false);
        }}>
          <form
            className="new-card-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            onSubmit={submitProject}
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Close new project dialog"
              onClick={() => setIsCreating(false)}
            >×</button>
            <p className="eyebrow"><span /> A NEW GARDEN</p>
            <h2 id="new-project-title">Grow a project</h2>
            <p className="dialog-description">Give your next big idea a name.</p>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              className="input-field"
              autoFocus
              required
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="What are we growing?"
              maxLength={120}
            />
            {createError ? (
              <p className="auth-error" role="alert">
                {createError}{createErrorStatus === 401 ? <> <Link href="/login">Sign in</Link></> : null}
              </p>
            ) : null}
            <button className="new-card-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create project'} <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
