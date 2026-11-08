'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createProject, useProjects } from '../projects-store';

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
  const projects = useProjects();
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');

  const submitProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;

    const project = createProject(name);
    router.push(`/projects/${project.id}`);
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
      </header>
      <main className="projects-page">
        <div className="projects-title-row">
          <div>
            <p className="eyebrow"><span /> YOUR WORKSPACE</p>
            <h1>Your projects<span className="brand-period">.</span></h1>
            <p className="intro-description">One little garden for everything you&apos;re growing.</p>
          </div>
          <button className="new-card-button" type="button" onClick={() => setIsCreating(true)}>
            <span aria-hidden="true">+</span> New project
          </button>
        </div>
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
            />
            <button className="new-card-submit" type="submit">Create project <span aria-hidden="true">→</span></button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
