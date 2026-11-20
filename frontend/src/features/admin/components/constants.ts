export const DEFAULT_CHROME_VERSION = '154.0.0.0';

export interface UserAgentPreset {
  label: string;
  value: string;
  os?: string;
  deviceType?: 'desktop' | 'mobile';
  family?: 'chromium' | 'safari' | 'firefox';
}

export interface UserAgentGroup {
  group: string;
  options: UserAgentPreset[];
}

export const GROUPED_PRESET_USER_AGENTS: UserAgentGroup[] = [
  {
    group: 'Desktop Chromium (Recommended)',
    options: [
      {
        label: 'Windows 11 / 10 - Chrome 154 (Canonical)',
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
        os: 'Windows',
        deviceType: 'desktop',
        family: 'chromium',
      },
      {
        label: 'Windows 11 / 10 - Edge 154',
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0',
        os: 'Windows',
        deviceType: 'desktop',
        family: 'chromium',
      },
      {
        label: 'macOS - Chrome 154',
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
        os: 'macOS',
        deviceType: 'desktop',
        family: 'chromium',
      },
      {
        label: 'Linux (x86_64) - Chrome 154',
        value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
        os: 'Linux',
        deviceType: 'desktop',
        family: 'chromium',
      },
      {
        label: 'ChromeOS - Chrome 154',
        value: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
        os: 'ChromeOS',
        deviceType: 'desktop',
        family: 'chromium',
      },
    ],
  },
  {
    group: 'Mobile Chromium',
    options: [
      {
        label: 'Android (Samsung Galaxy) - Chrome 154',
        value: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36',
        os: 'Android',
        deviceType: 'mobile',
        family: 'chromium',
      },
      {
        label: 'Android (Google Pixel) - Chrome 154',
        value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36',
        os: 'Android',
        deviceType: 'mobile',
        family: 'chromium',
      },
      {
        label: 'iPad - Chrome 154',
        value: 'Mozilla/5.0 (iPad; CPU OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/154.0.0.0 Mobile/15E148 Safari/604.1',
        os: 'iPadOS',
        deviceType: 'mobile',
        family: 'chromium',
      },
    ],
  },
  {
    group: 'Non-Chromium (Plain HTTP Scraper Only)',
    options: [
      {
        label: 'macOS - Safari 18.4',
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',
        os: 'macOS',
        deviceType: 'desktop',
        family: 'safari',
      },
      {
        label: 'iOS (iPhone) - Safari 18.4',
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
        os: 'iOS',
        deviceType: 'mobile',
        family: 'safari',
      },
      {
        label: 'Windows 11 / 10 - Firefox 140',
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        os: 'Windows',
        deviceType: 'desktop',
        family: 'firefox',
      },
      {
        label: 'Linux (x86_64) - Firefox 140',
        value: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
        os: 'Linux',
        deviceType: 'desktop',
        family: 'firefox',
      },
    ],
  },
];

// Flat list for simple select dropdowns or iterate-all use cases
export const PRESET_USER_AGENTS: UserAgentPreset[] = GROUPED_PRESET_USER_AGENTS.flatMap(
  (group) => group.options
);

export interface UserAgentDiagnostic {
  isMismatchedEngine: boolean;
  isOutdated: boolean;
  browserFamily: 'chromium' | 'safari' | 'firefox' | 'unknown';
  majorVersion: number | null;
  message?: string;
}

/**
 * Validates a retailer's User-Agent string against the retailer's scraper configuration.
 * Warns if:
 * 1. The retailer uses the Browser Scraper (Puppeteer/Chromium) but configures a Safari/Firefox User-Agent.
 * 2. The User-Agent is a Chromium build older than Chrome 140 (which risks anti-bot challenge triggers).
 */
export function diagnoseRetailerUserAgent(
  userAgent?: string | null,
  useBrowserScraper?: boolean
): UserAgentDiagnostic {
  if (!userAgent || !userAgent.trim()) {
    return {
      isMismatchedEngine: false,
      isOutdated: false,
      browserFamily: 'chromium',
      majorVersion: 154,
    };
  }

  const ua = userAgent.trim();
  let family: 'chromium' | 'safari' | 'firefox' | 'unknown' = 'unknown';
  let majorVersion: number | null = null;

  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/(\d+)/i);
  const firefoxMatch = ua.match(/Firefox\/(\d+)/i);
  const safariMatch = ua.match(/Version\/(\d+)/i);

  if (chromeMatch) {
    family = 'chromium';
    majorVersion = parseInt(chromeMatch[1], 10);
  } else if (firefoxMatch) {
    family = 'firefox';
    majorVersion = parseInt(firefoxMatch[1], 10);
  } else if (safariMatch && ua.includes('Safari')) {
    family = 'safari';
    majorVersion = parseInt(safariMatch[1], 10);
  }

  const isMismatchedEngine = Boolean(useBrowserScraper && family !== 'chromium');
  const isOutdated = Boolean(family === 'chromium' && majorVersion !== null && majorVersion < 140);

  let message: string | undefined;
  if (isMismatchedEngine) {
    message = `Browser Scraper runs Chromium, but this User-Agent specifies ${family}. Engine mismatch can increase anti-bot challenge rates.`;
  } else if (isOutdated) {
    message = `User-Agent specifies Chrome v${majorVersion}, which is older than modern anti-bot baselines (v140+).`;
  }

  return {
    isMismatchedEngine,
    isOutdated,
    browserFamily: family,
    majorVersion,
    message,
  };
}
