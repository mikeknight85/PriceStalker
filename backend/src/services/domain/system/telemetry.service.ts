import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import pool from '../../../config/database';
import { systemSettingsRepository } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { APP_VERSION } from '../../../utils/system/app-version';

export interface TelemetryPayload {
  instance_id: string;
  version: string;
  build_commit?: string | null;
  os: {
    platform: string;
    arch: string;
    node_version: string;
  };
  runtime: {
    is_docker: boolean;
    uptime_hours: number;
  };
  features: {
    ai_enabled: boolean;
    remote_scraper_enabled: boolean;
    searxng_enabled: boolean;
    sso_enabled: boolean;
  };
  usage: {
    items_bucket: string;
    stores_bucket: string;
    users_bucket: string;
  };
}

export const TELEMETRY_ENDPOINT = 'https://ps-telemetry.enuff.com/v1/ping';

export class TelemetryService {
  /**
   * Checks whether telemetry reporting is permitted.
   * Both the environment variable (DISABLE_TELEMETRY / DO_NOT_TRACK) and
   * the database setting (telemetry_enabled) can disable telemetry.
   */
  async isEnabled(): Promise<boolean> {
    if (this.isEnvDisabled()) {
      return false;
    }

    const setting = await systemSettingsRepository.get('telemetry_enabled');
    // Enabled by default unless explicitly set to 'false'
    return setting !== 'false';
  }

  /**
   * Environment variable check (headless / Docker deployment override).
   */
  isEnvDisabled(): boolean {
    return (
      process.env.DISABLE_TELEMETRY === 'true' ||
      process.env.DO_NOT_TRACK === '1' ||
      process.env.TELEMETRY_ENABLED === 'false'
    );
  }

  /**
   * Retrieves or initializes the persistent anonymous instance UUID.
   */
  async getInstanceId(): Promise<string> {
    let instanceId = await systemSettingsRepository.get('telemetry_instance_id');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!instanceId || !uuidRegex.test(instanceId)) {
      instanceId = crypto.randomUUID();
      await systemSettingsRepository.set('telemetry_instance_id', instanceId);
    }

    return instanceId;
  }

  /**
   * Constructs the anonymous telemetry payload without any PII or specific store data.
   */
  async getPayload(): Promise<TelemetryPayload> {
    const instanceId = await this.getInstanceId();
    const settings = await systemSettingsRepository.getAll();

    // Usage buckets to prevent fingerprinting
    const usage = await this.getUsageBuckets();

    // Enabled features (flags only, zero credentials/URLs)
    const features = {
      ai_enabled: Boolean(
        settings.anthropic_api_key ||
        settings.openai_api_key ||
        settings.gemini_api_key ||
        settings.openrouter_api_key
      ),
      remote_scraper_enabled: Boolean(settings.remote_scraper_url?.trim()),
      searxng_enabled: settings.searxng_enabled === 'true',
      sso_enabled: process.env.ENABLE_SSO === 'true',
    };

    const isDocker = (
      fs.existsSync('/.dockerenv') ||
      fs.existsSync('/run/.containerenv') ||
      Boolean(process.env.DOCKER_CONTAINER)
    );

    const buildCommit = process.env.BUILD_COMMIT?.slice(0, 8) || process.env.GIT_COMMIT?.slice(0, 8) || null;

    return {
      instance_id: instanceId,
      version: APP_VERSION,
      build_commit: buildCommit,
      os: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
      },
      runtime: {
        is_docker: isDocker,
        uptime_hours: Math.round(process.uptime() / 3600),
      },
      features,
      usage,
    };
  }

  /**
   * Sends the anonymous daily telemetry ping to the telemetry receiver.
   * Completely non-blocking and silent on failure.
   */
  async sendPing(): Promise<{ success: boolean; error?: string }> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        return { success: false, error: 'Telemetry is disabled' };
      }

      const payload = await this.getPayload();

      await axios.post(TELEMETRY_ENDPOINT, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `PriceStalker-Telemetry/${APP_VERSION}`,
        },
      });

      const now = new Date().toISOString();
      await systemSettingsRepository.set('telemetry_last_ping_at', now);

      logger.debug('Telemetry | Ping delivered successfully', 'Telemetry');
      return { success: true };
    } catch (err: any) {
      // Never throw or interrupt application flow
      logger.debug(`Telemetry | Ping skipped or unreachable: ${err?.message || err}`, 'Telemetry');
      return { success: false, error: err?.message || 'Failed to send telemetry' };
    }
  }

  /**
   * Full status report for the admin UI settings screen.
   */
  async getStatus(): Promise<{
    enabled: boolean;
    envDisabled: boolean;
    instanceId: string;
    lastPingAt: string | null;
    preview: TelemetryPayload;
  }> {
    const [enabled, instanceId, lastPingAt, preview] = await Promise.all([
      this.isEnabled(),
      this.getInstanceId(),
      systemSettingsRepository.get('telemetry_last_ping_at'),
      this.getPayload(),
    ]);

    return {
      enabled,
      envDisabled: this.isEnvDisabled(),
      instanceId,
      lastPingAt,
      preview,
    };
  }

  private async getUsageBuckets(): Promise<{
    items_bucket: string;
    stores_bucket: string;
    users_bucket: string;
  }> {
    try {
      const res = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM items) as items_count,
          (SELECT COUNT(*) FROM products) as stores_count,
          (SELECT COUNT(*) FROM users) as users_count
      `);

      const row = res.rows[0] || {};
      const itemsCount = parseInt(row.items_count, 10) || 0;
      const storesCount = parseInt(row.stores_count, 10) || 0;
      const usersCount = parseInt(row.users_count, 10) || 0;

      return {
        items_bucket: this.toBucket(itemsCount),
        stores_bucket: this.toBucket(storesCount),
        users_bucket: usersCount <= 1 ? '1' : usersCount <= 5 ? '2-5' : '6+',
      };
    } catch {
      return {
        items_bucket: 'unknown',
        stores_bucket: 'unknown',
        users_bucket: 'unknown',
      };
    }
  }

  private toBucket(count: number): string {
    if (count === 0) return '0';
    if (count <= 10) return '1-10';
    if (count <= 50) return '11-50';
    if (count <= 200) return '51-200';
    return '200+';
  }
}

export const telemetryService = new TelemetryService();
