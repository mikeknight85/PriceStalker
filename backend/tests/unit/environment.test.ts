import { describe, expect, it } from 'vitest';
import { resolveEnvironmentFile } from '../../src/config/environment';

describe('resolveEnvironmentFile', () => {
  it('uses the repository .env when the backend workspace has no .env', () => {
    const rootEnvironmentFile = '/workspace/.env';

    expect(resolveEnvironmentFile('/workspace/backend', (candidate) => candidate === rootEnvironmentFile))
      .toBe(rootEnvironmentFile);
  });

  it('prefers an environment file in the current directory', () => {
    const backendEnvironmentFile = '/workspace/backend/.env';

    expect(resolveEnvironmentFile('/workspace/backend', (candidate) => candidate === backendEnvironmentFile))
      .toBe(backendEnvironmentFile);
  });
});
