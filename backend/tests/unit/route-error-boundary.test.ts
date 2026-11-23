import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Enforces Rule 3 from AGENTS.md: "Every route section stays inside an ErrorBoundary".
 *
 * Verifies that root shells, major pages, and tab sections are wrapped in
 * <ErrorBoundary section="..."> so that unexpected render crashes never
 * white-screen the application.
 */

describe('Rule 3: Route and tab sections are wrapped in ErrorBoundary', () => {
  const frontendDir = resolve(__dirname, '../../../frontend');

  it('wraps the root application shell in an ErrorBoundary', () => {
    const rootPath = resolve(frontendDir, 'src/routes/__root.tsx');
    expect(existsSync(rootPath)).toBe(true);

    const content = readFileSync(rootPath, 'utf8');
    expect(content).toMatch(/<ErrorBoundary\s+section=/);
  });

  it('wraps all product detail sections in an ErrorBoundary with named section attribute', () => {
    const sectionPath = resolve(
      frontendDir,
      'src/features/products/pages/product-detail/ProductDetailSection.tsx'
    );
    expect(existsSync(sectionPath)).toBe(true);

    const content = readFileSync(sectionPath, 'utf8');
    const sections = ['overview', 'chart', 'stock', 'notifications', 'settings'];

    for (const section of sections) {
      // Each section branch must be guarded by an ErrorBoundary
      const sectionMatch = new RegExp(`section === '${section}'[\\s\\S]*?<ErrorBoundary\\s+section=`);
      expect(
        sectionMatch.test(content),
        `ProductDetailSection missing <ErrorBoundary section="..."> for section '${section}'`
      ).toBe(true);
    }
  });

  it('wraps dashboard, admin, and settings tab views in ErrorBoundary', () => {
    const targets = [
      {
        path: 'src/features/products/pages/dashboard/DashboardPage.tsx',
        name: 'DashboardPage',
      },
      {
        path: 'src/features/admin/pages/AdminPage.tsx',
        name: 'AdminPage',
      },
      {
        path: 'src/features/settings/pages/SettingsPage.tsx',
        name: 'SettingsPage',
      },
    ];

    for (const target of targets) {
      const fullPath = resolve(frontendDir, target.path);
      expect(existsSync(fullPath), `File not found: ${target.path}`).toBe(true);

      const content = readFileSync(fullPath, 'utf8');
      expect(
        content,
        `${target.name} must wrap view sections in <ErrorBoundary section="...">`
      ).toMatch(/<ErrorBoundary\s+section=/);
    }
  });
});
