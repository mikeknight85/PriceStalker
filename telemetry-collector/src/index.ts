/**
 * PriceStalker Telemetry Worker
 * Privacy-first telemetry aggregation service running on Cloudflare Workers & D1.
 *
 * Endpoint: https://ps-telemetry.enuff.com
 * D1 Database: pricestalker-telemetry
 */

export interface Env {
  DB: D1Database;
  GATEWAY_SECRET?: string;
  ENVIRONMENT?: string;
}

interface TelemetryPayload {
  instance_id: string;
  version: string;
  build_commit?: string;
  os?: {
    platform?: string;
    arch?: string;
    node_version?: string;
  };
  runtime?: {
    is_docker?: boolean;
    uptime_hours?: number;
  };
  features?: Record<string, boolean>;
  usage?: {
    items_bucket?: string;
    stores_bucket?: string;
    users_bucket?: string;
  };
}

const SECURITY_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAYLOAD_BYTES = 16384; // 16 KB

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: SECURITY_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Enforce Gateway Shared Secret on write endpoints to prevent direct workers.dev bypass
    if (env.GATEWAY_SECRET && (path === '/v1/ping' || request.method === 'POST')) {
      const incomingSecret = request.headers.get('x-telemetry-gateway-secret');
      if (incomingSecret !== env.GATEWAY_SECRET) {
        return jsonResponse(
          { error: 'Direct access forbidden. Requests must route via ps-telemetry.enuff.com' },
          403
        );
      }
    }

    // Protect against oversized payload flooding
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return jsonResponse({ error: 'Payload Too Large (max 16KB)' }, 413);
    }

    try {
      if (path === '/' || path === '/health') {
        return jsonResponse({
          service: 'pricestalker-telemetry',
          status: 'healthy',
          version: '1.0.0',
        });
      }

      if (path === '/v1/ping' && request.method === 'POST') {
        return await handlePing(request, env, ctx);
      }

      if (path === '/dashboard' || path === '/stats') {
        const accept = request.headers.get('accept') || '';
        if (accept.includes('text/html') || !accept.includes('application/json')) {
          return await renderDashboardHtml(env);
        }
        return await handleStats(env);
      }

      if (path === '/v1/stats' && request.method === 'GET') {
        return await handleStats(env);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (err: any) {
      console.error('Unhandled telemetry worker error:', err);
      return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
  },
};

async function handlePing(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let body: TelemetryPayload;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate instance_id (must be valid UUID format to prevent key injection / garbage)
  if (!body.instance_id || typeof body.instance_id !== 'string' || !UUID_REGEX.test(body.instance_id)) {
    return jsonResponse({ error: 'Invalid or missing instance_id UUID' }, 400);
  }

  // Version must be a non-empty string under 64 chars
  const version = typeof body.version === 'string' ? body.version.slice(0, 64) : 'unknown';
  const buildCommit = typeof body.build_commit === 'string' ? body.build_commit.slice(0, 40) : null;

  // OS & Node
  const osPlatform = typeof body.os?.platform === 'string' ? body.os.platform.slice(0, 32) : null;
  const osArch = typeof body.os?.arch === 'string' ? body.os.arch.slice(0, 32) : null;
  const nodeVersion = typeof body.os?.node_version === 'string' ? body.os.node_version.slice(0, 32) : null;

  // Runtime
  const isDocker = body.runtime?.is_docker === true ? 1 : 0;

  // Privacy-first Geo: country code from header forwarded by gateway or Cloudflare edge. Never log or store IP!
  const cfCountry = request.headers.get('cf-ipcountry') || (request as any).cf?.country;
  const country = typeof cfCountry === 'string' && cfCountry.length === 2 ? cfCountry.toUpperCase() : 'XX';

  // Feature flags sanitized
  let featuresJson: string | null = null;
  if (body.features && typeof body.features === 'object') {
    const cleanFeatures: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body.features)) {
      if (typeof v === 'boolean') {
        cleanFeatures[k.slice(0, 32)] = v;
      }
    }
    featuresJson = JSON.stringify(cleanFeatures);
  }

  // Coarse usage buckets (e.g. "1-10", "11-50", "51-200", "200+")
  const itemsBucket = typeof body.usage?.items_bucket === 'string' ? body.usage.items_bucket.slice(0, 16) : null;
  const storesBucket = typeof body.usage?.stores_bucket === 'string' ? body.usage.stores_bucket.slice(0, 16) : null;
  const usersBucket = typeof body.usage?.users_bucket === 'string' ? body.usage.users_bucket.slice(0, 16) : null;

  // Upsert into D1
  await env.DB.prepare(`
    INSERT INTO instances (
      instance_id, first_seen_at, last_seen_at, version, build_commit,
      os_platform, os_arch, node_version, is_docker, country,
      features_json, items_bucket, stores_bucket, users_bucket, ping_count
    ) VALUES (?1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1)
    ON CONFLICT(instance_id) DO UPDATE SET
      last_seen_at = CURRENT_TIMESTAMP,
      version = excluded.version,
      build_commit = excluded.build_commit,
      os_platform = excluded.os_platform,
      os_arch = excluded.os_arch,
      node_version = excluded.node_version,
      is_docker = excluded.is_docker,
      country = excluded.country,
      features_json = excluded.features_json,
      items_bucket = excluded.items_bucket,
      stores_bucket = excluded.stores_bucket,
      users_bucket = excluded.users_bucket,
      ping_count = instances.ping_count + 1
  `).bind(
    body.instance_id,
    version,
    buildCommit,
    osPlatform,
    osArch,
    nodeVersion,
    isDocker,
    country,
    featuresJson,
    itemsBucket,
    storesBucket,
    usersBucket
  ).run();

  // Periodic pruning of dead instances (unseen for > 180 days) in background
  if (Math.random() < 0.05) {
    ctx.waitUntil(
      env.DB.prepare(`
        DELETE FROM instances
        WHERE last_seen_at < datetime('now', '-180 days')
      `).run().catch(() => null)
    );
  }

  return jsonResponse({
    ok: true,
    server_time: new Date().toISOString(),
  });
}

async function fetchStatsData(env: Env) {
  const activeStats = await env.DB.prepare(`
    SELECT
      COUNT(CASE WHEN last_seen_at >= datetime('now', '-7 days') THEN 1 END) as active_7d,
      COUNT(CASE WHEN last_seen_at >= datetime('now', '-30 days') THEN 1 END) as active_30d,
      COUNT(*) as total_instances,
      AVG(CASE WHEN last_seen_at >= datetime('now', '-30 days') THEN is_docker ELSE NULL END) as docker_ratio
    FROM instances
  `).first<{
    active_7d: number;
    active_30d: number;
    total_instances: number;
    docker_ratio: number | null;
  }>();

  const topVersions = await env.DB.prepare(`
    SELECT version, COUNT(*) as count
    FROM instances
    WHERE last_seen_at >= datetime('now', '-30 days')
    GROUP BY version
    ORDER BY count DESC
    LIMIT 10
  `).all<{ version: string; count: number }>();

  const topPlatforms = await env.DB.prepare(`
    SELECT os_platform, os_arch, COUNT(*) as count
    FROM instances
    WHERE last_seen_at >= datetime('now', '-30 days')
    GROUP BY os_platform, os_arch
    ORDER BY count DESC
    LIMIT 10
  `).all<{ os_platform: string; os_arch: string; count: number }>();

  const topCountries = await env.DB.prepare(`
    SELECT country, COUNT(*) as count
    FROM instances
    WHERE last_seen_at >= datetime('now', '-30 days')
    GROUP BY country
    ORDER BY count DESC
    LIMIT 15
  `).all<{ country: string; count: number }>();

  return {
    generated_at: new Date().toISOString(),
    active_7d: activeStats?.active_7d ?? 0,
    active_30d: activeStats?.active_30d ?? 0,
    total_instances: activeStats?.total_instances ?? 0,
    docker_ratio: activeStats?.docker_ratio != null ? Math.round(activeStats.docker_ratio * 100) : 0,
    versions: topVersions.results ?? [],
    platforms: topPlatforms.results ?? [],
    countries: topCountries.results ?? [],
  };
}

async function handleStats(env: Env): Promise<Response> {
  const stats = await fetchStatsData(env);
  return jsonResponse(stats, 200, {
    'Cache-Control': 'public, max-age=1800',
  });
}

async function renderDashboardHtml(env: Env): Promise<Response> {
  const stats = await fetchStatsData(env);

  const versionLabels = JSON.stringify(stats.versions.map(v => v.version));
  const versionCounts = JSON.stringify(stats.versions.map(v => v.count));

  const platformLabels = JSON.stringify(stats.platforms.map(p => `${p.os_platform}/${p.os_arch}`));
  const platformCounts = JSON.stringify(stats.platforms.map(p => p.count));

  const countryRows = stats.countries
    .map(c => `<tr><td><strong>${c.country}</strong></td><td style="text-align: right;">${c.count}</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PriceStalker Telemetry Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-green: #34d399;
      --accent-purple: #a78bfa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      min-height: 100vh;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
    }
    h1 { font-size: 1.75rem; font-weight: 700; color: #fff; }
    .subtitle { color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(56, 189, 248, 0.1);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.2);
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    .card-title { color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-value { font-size: 2rem; font-weight: 700; margin-top: 0.5rem; color: #fff; }
    .card-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .chart-container { position: relative; height: 260px; margin-top: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.875rem; }
    th, td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); text-align: left; }
    th { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; }
    footer { text-align: center; color: var(--text-muted); font-size: 0.75rem; margin-top: 3rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>PriceStalker Telemetry</h1>
        <div class="subtitle">Cloudflare D1 Edge Analytics & Fleet Insights</div>
      </div>
      <div class="badge">
        <span>Cloudflare Protected</span>
      </div>
    </header>

    <div class="metrics-grid">
      <div class="card">
        <div class="card-title">Total Registered</div>
        <div class="card-value">${stats.total_instances}</div>
        <div class="card-desc">Lifetime distinct installations</div>
      </div>
      <div class="card">
        <div class="card-title">Active (7 Days)</div>
        <div class="card-value" style="color: var(--accent-green);">${stats.active_7d}</div>
        <div class="card-desc">Seen in the past 7 days</div>
      </div>
      <div class="card">
        <div class="card-title">Active (30 Days)</div>
        <div class="card-value" style="color: var(--accent);">${stats.active_30d}</div>
        <div class="card-desc">Seen in the past 30 days</div>
      </div>
      <div class="card">
        <div class="card-title">Containerized</div>
        <div class="card-value" style="color: var(--accent-purple);">${stats.docker_ratio}%</div>
        <div class="card-desc">Docker deployments</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-title">Release Version Adoption (30d)</div>
        <div class="chart-container">
          <canvas id="versionChart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Platform & Architecture (30d)</div>
        <div class="chart-container">
          <canvas id="platformChart"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Geographic Distribution (Country Codes - 30d)</div>
      <table>
        <thead>
          <tr><th>Country</th><th style="text-align: right;">Active Instances</th></tr>
        </thead>
        <tbody>
          ${countryRows || '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No country records yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <footer>
      Last computed: ${stats.generated_at} &bull; Data privacy strictly enforced (zero PII, zero IPs, zero URLs stored)
    </footer>
  </div>

  <script>
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      }
    };

    new Chart(document.getElementById('versionChart'), {
      type: 'doughnut',
      data: {
        labels: ${versionLabels},
        datasets: [{
          data: ${versionCounts},
          backgroundColor: ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#f87171']
        }]
      },
      options: chartOptions
    });

    new Chart(document.getElementById('platformChart'), {
      type: 'bar',
      data: {
        labels: ${platformLabels},
        datasets: [{
          label: 'Instances',
          data: ${platformCounts},
          backgroundColor: '#38bdf8',
          borderRadius: 6
        }]
      },
      options: {
        ...chartOptions,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', precision: 0 }, grid: { color: '#334155' } }
        }
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      ...SECURITY_HEADERS,
    },
  });
}
