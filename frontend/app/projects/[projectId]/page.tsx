'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Board } from '../../page';
import { useProjects } from '../../projects-store';

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectName = useProjects().find((project) => project.id === projectId)?.name;

  if (!projectName) {
    return (
      <div className="page-shell">
        <header className="topbar">
          <Link className="projects-link" href="/projects">← All projects</Link>
        </header>
        <main className="projects-page">
          <h1>Project not found</h1>
          <Link className="projects-link" href="/projects">Back to projects</Link>
        </main>
      </div>
    );
  }

  return <Board projectId={projectId} projectName={projectName} />;
}
