import { useSyncExternalStore } from 'react';

export type Project = {
  id: string;
  name: string;
};

const storageKey = 'petal-projects';
const defaultProjects: Project[] = [{ id: 'project-board', name: 'Project Board' }];
let cachedProjects: Project[] | null = null;
const listeners = new Set<() => void>();

function loadProjects(): Project[] {
  const savedProjects = window.localStorage.getItem(storageKey);
  if (savedProjects) return JSON.parse(savedProjects) as Project[];

  window.localStorage.setItem(storageKey, JSON.stringify(defaultProjects));
  return defaultProjects;
}

function getSnapshot() {
  cachedProjects ??= loadProjects();
  return cachedProjects;
}

function getServerSnapshot() {
  return defaultProjects;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function saveProjects(projects: Project[]) {
  cachedProjects = projects;
  window.localStorage.setItem(storageKey, JSON.stringify(projects));
  listeners.forEach((listener) => listener());
}

export function useProjects() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function createProject(name: string): Project {
  const project = { id: crypto.randomUUID(), name: name.trim() };
  saveProjects([...getSnapshot(), project]);
  return project;
}
