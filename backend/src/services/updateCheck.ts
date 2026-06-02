import axios from 'axios';
import { readFileSync } from 'fs';
import { join } from 'path';

// Daily check against GitHub releases for new versions of this fork.
// Opt-out via DISABLE_UPDATE_CHECK=true. No telemetry — the only outbound
// request is to api.github.com, and it's only made by the backend (never
// from the user's browser).

export interface UpdateCheckResult {
  current: string;
  latest: string | null;
  isOutdated: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  checkedAt: string;
  disabled: boolean;
  error: string | null;
  channel: 'stable' | 'beta';
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RELEASE_API = 'https://api.github.com/repos/mikeknight85/PriceStalker/releases/latest';

let cached: UpdateCheckResult | null = null;
let lastCheck = 0;

function loadVersion(): string {
  try {
    // dist/services/updateCheck.js → ../../package.json
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const CURRENT_VERSION = loadVersion();
const CURRENT_CHANNEL: 'stable' | 'beta' =
  process.env.PRICESTALKER_CHANNEL === 'beta' ? 'beta' : 'stable';

function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parts(a);
  const [b1, b2, b3] = parts(b);
  return (a1 - b1) || (a2 - b2) || (a3 - b3);
}

async function fetchLatestRelease(): Promise<UpdateCheckResult> {
  const result: UpdateCheckResult = {
    current: CURRENT_VERSION,
    latest: null,
    isOutdated: false,
    releaseUrl: null,
    publishedAt: null,
    checkedAt: new Date().toISOString(),
    disabled: false,
    error: null,
    channel: CURRENT_CHANNEL,
  };

  try {
    const response = await axios.get<{
      tag_name?: string;
      html_url?: string;
      published_at?: string;
    }>(RELEASE_API, {
      timeout: 10000,
      headers: { 'User-Agent': `PriceStalker/${CURRENT_VERSION}` },
    });
    const tag = response.data?.tag_name;
    if (!tag) {
      result.error = 'no tag_name in release response';
      return result;
    }
    result.latest = tag.replace(/^v/, '');
    result.isOutdated = compareVersions(result.latest, CURRENT_VERSION) > 0;
    result.releaseUrl = response.data?.html_url ?? null;
    result.publishedAt = response.data?.published_at ?? null;
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'check failed';
  }

  return result;
}

export async function checkForUpdate(force = false): Promise<UpdateCheckResult> {
  if (process.env.DISABLE_UPDATE_CHECK === 'true') {
    return {
      current: CURRENT_VERSION,
      latest: null,
      isOutdated: false,
      releaseUrl: null,
      publishedAt: null,
      checkedAt: new Date().toISOString(),
      disabled: true,
      error: null,
      channel: CURRENT_CHANNEL,
    };
  }

  const now = Date.now();
  if (!force && cached && now - lastCheck < CHECK_INTERVAL_MS) {
    return cached;
  }

  cached = await fetchLatestRelease();
  lastCheck = now;
  return cached;
}

export function startUpdateCheckScheduler(): void {
  if (process.env.DISABLE_UPDATE_CHECK === 'true') {
    console.log('[UpdateCheck] disabled via DISABLE_UPDATE_CHECK env var');
    return;
  }

  // First check 30 s after boot so we don't block startup.
  setTimeout(() => {
    checkForUpdate(true).catch(() => {});
  }, 30_000);

  // Daily refresh thereafter.
  setInterval(() => {
    checkForUpdate(true).catch(() => {});
  }, CHECK_INTERVAL_MS);

  console.log(`[UpdateCheck] scheduled (current version: ${CURRENT_VERSION})`);
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
