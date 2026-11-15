'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Board } from '../../page';
import { refreshProjects, useProjects } from '../../projects-store';

function MigrationNotice({ message }: { message: string }) {
  return (
    <div className="data-message" role="alert">
      <p>{message}</p>
      <button type="button" className="inline-action" onClick={() => void refreshProjects()}>
        Retry import
      </button>
    </div>
  );
}

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectsState = useProjects();

  if (projectsState.status === 'loading') {
    return (
      <div className="page-shell">
        <main className="projects-page"><p role="status">Loading project...</p></main>
      </div>
    );
  }

  if (projectsState.status === 'error' || projectsState.status === 'unauthenticated') {
    return (
      <div className="page-shell">
        <main className="projects-page">
          <p role="alert">{projectsState.error}</p>
          {projectsState.status === 'unauthenticated' ? (
            <Link className="projects-link" href="/login">Sign in</Link>
          ) : (
            <button type="button" className="projects-link" onClick={() => void refreshProjects()}>
              Try again
            </button>
          )}
        </main>
      </div>
    );
  }

  if (!projectsState.projects.some((project) => project.id === projectId)) {
    return (
      <div className="page-shell">
        <header className="topbar">
          <Link className="projects-link" href="/projects">← All projects</Link>
        </header>
        <main className="projects-page">
          {projectsState.migrationError ? <MigrationNotice message={projectsState.migrationError} /> : null}
          <h1>Project not found</h1>
          <Link className="projects-link" href="/projects">Back to projects</Link>
        </main>
      </div>
    );
  }

  return <Board key={projectId} projectId={projectId} />;
}
