import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

type FileExists = (path: string) => boolean;

/**
 * Finds a dotenv file when the backend is started from its workspace directory
 * or from the repository root. Containers receive configuration directly via
 * their environment, so no file is required there.
 */
export function resolveEnvironmentFile(
  currentDirectory = process.cwd(),
  fileExists: FileExists = existsSync,
): string | undefined {
  const candidates = [
    resolve(currentDirectory, '.env'),
    resolve(currentDirectory, '..', '.env'),
  ];

  return candidates.find(fileExists);
}

export function loadEnvironment(): void {
  const environmentFile = resolveEnvironmentFile();
  if (environmentFile) dotenv.config({ path: environmentFile });
}
