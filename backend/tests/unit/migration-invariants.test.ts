import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Repository & Migration Invariants (AGENTS.md)', () => {
  const migrationsDir = path.resolve(__dirname, '../../src/migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort();

  it('all migration files follow the strict 3-digit naming pattern NNN_name.ts', () => {
    const pattern = /^\d{3}_[a-z0-9_]+\.ts$/;
    for (const file of migrationFiles) {
      expect(file).toMatch(pattern);
    }
  });

  it('migration sequence numbers are contiguous and start at 000', () => {
    const numbers = migrationFiles.map(f => parseInt(f.slice(0, 3), 10));
    for (let i = 0; i < numbers.length; i++) {
      expect(numbers[i]).toBe(i);
    }
  });

  it('every migration exports an "up" function and a "down" function', async () => {
    for (const file of migrationFiles) {
      const fullPath = path.join(migrationsDir, file);
      const mod = await import(fullPath);
      expect(typeof mod.up, `${file} should export an "up" function`).toBe('function');
      expect(typeof mod.down, `${file} should export a "down" function`).toBe('function');
    }
  });

  it('axios is pinned to exactly 1.14.0 across all workspaces declaring it', () => {
    const rootDir = path.resolve(__dirname, '../../..');
    const packageFiles = [
      path.join(rootDir, 'package.json'),
      path.join(rootDir, 'backend/package.json'),
      path.join(rootDir, 'frontend/package.json'),
      path.join(rootDir, 'scraper/package.json'),
    ];

    for (const pkgPath of packageFiles) {
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if ('axios' in deps) {
        // Must be exact 1.14.0 - no ^, no ~, no ranges
        expect(
          deps['axios'],
          `${pkgPath} must have axios pinned to exactly "1.14.0"`
        ).toBe('1.14.0');
      }
    }
  });
});
