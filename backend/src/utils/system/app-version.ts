import fs from 'fs';
import path from 'path';

/**
 * The version of the backend that is actually running.
 *
 * Read from package.json once at startup rather than baked in at build time,
 * so it cannot drift from what was installed. The file is present in the
 * runtime image because pnpm needs it to resolve the workspace.
 *
 * Resolved by walking up from this module rather than from `process.cwd()`:
 * the working directory depends on how the process was started, and a version
 * banner that reads "unknown" because someone ran the binary from elsewhere is
 * exactly the kind of small lie that wastes an afternoon during an incident.
 */
function readVersion(): string {
  // An explicit override wins, for anyone building the image differently.
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;

  let dir = __dirname;
  for (let depth = 0; depth < 6; depth++) {
    try {
      const candidate = path.join(dir, 'package.json');
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (typeof parsed.version === 'string' && parsed.version) return parsed.version;
      }
    } catch {
      // A malformed or unreadable package.json is not worth failing startup
      // over: this value decorates a menu.
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'unknown';
}

/** Resolved once. The file cannot change under a running process. */
export const APP_VERSION = readVersion();
