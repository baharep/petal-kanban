'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { ApiError, requestApiJson } from './api-client';

export type Project = {
  id: string;
  name: string;
};

export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cards: Card[];
};

export type ProjectBoard = {
  projectId: string;
  projectName: string;
  columns: Column[];
};

type ProjectsStatus = 'loading' | 'ready' | 'error' | 'unauthenticated';

export type ProjectsSnapshot = {
  projects: Project[];
  status: ProjectsStatus;
  error: string | null;
  migrationError: string | null;
};

const initialSnapshot: ProjectsSnapshot = {
  projects: [],
  status: 'loading',
  error: null,
  migrationError: null,
};
const storageKey = 'petal-projects';
const migrationKey = 'petal-projects-migration-v1';
let snapshot = initialSnapshot;
let loadingRequest: Promise<void> | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function publish(nextSnapshot: ProjectsSnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return initialSnapshot;
}

function readLegacyProjects(): Project[] {
  if (window.localStorage.getItem(migrationKey) === 'complete') return [];
  const savedProjects = window.localStorage.getItem(storageKey);
  if (savedProjects === null) return [];

  const parsed: unknown = JSON.parse(savedProjects);
  if (!Array.isArray(parsed)) throw new Error('Legacy project data is not a list.');

  return parsed.map((project: unknown) => {
    if (
      typeof project !== 'object'
      || project === null
      || !('id' in project)
      || !('name' in project)
      || typeof project.id !== 'string'
      || typeof project.name !== 'string'
      || !project.id.trim()
      || !project.name.trim()
    ) {
      throw new Error('Legacy project data has an invalid entry.');
    }

    return { id: project.id.trim(), name: project.name.trim() };
  });
}

async function importLegacyProjects() {
  const legacyProjects = readLegacyProjects();
  if (legacyProjects.length === 0) return;

  for (const project of legacyProjects) {
    await requestApiJson<Project>('/api/projects/import', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }
  window.localStorage.setItem(migrationKey, 'complete');
}

export async function refreshProjects(): Promise<void> {
  if (loadingRequest) return loadingRequest;

  const requestGeneration = generation;
  publish({ ...snapshot, status: 'loading', error: null });
  const request = (async () => {
    try {
      let migrationError: string | null = null;
      await requestApiJson<Project[]>('/api/projects');
      try {
        await importLegacyProjects();
      } catch {
        migrationError = 'Some saved projects could not be imported. Their original list is still saved on this device.';
      }
      const projects = await requestApiJson<Project[]>('/api/projects');
      if (requestGeneration === generation) {
        publish({ projects, status: 'ready', error: null, migrationError });
      }
    } catch (error) {
      if (requestGeneration === generation) {
        const unauthenticated = error instanceof ApiError && error.status === 401;
        publish({
          ...snapshot,
          status: unauthenticated ? 'unauthenticated' : 'error',
          error: unauthenticated
            ? 'Your session has expired. Sign in again to continue.'
            : 'Could not load projects. Check your connection and try again.',
        });
      }
    }
  })();
  loadingRequest = request;
  void request.finally(() => {
    if (loadingRequest === request) loadingRequest = null;
  });
  return request;
}

export function resetProjects() {
  generation += 1;
  loadingRequest = null;
  publish(initialSnapshot);
}

export function useProjects(): ProjectsSnapshot {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (snapshot.status === 'loading') void refreshProjects();
  }, []);
  return state;
}

export async function createProject(name: string): Promise<Project> {
  const project = await requestApiJson<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  publish({
    ...snapshot,
    projects: [...snapshot.projects, project],
    status: 'ready',
    error: null,
  });
  return project;
}
