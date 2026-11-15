import { rm } from 'node:fs/promises';

export default async function globalTeardown() {
  const databasePath = process.env.PETAL_E2E_DATABASE_PATH;
  if (databasePath) await rm(databasePath, { force: true });
}
