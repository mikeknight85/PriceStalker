import { settingsCache } from '../../../utils/cache';

export const STEALTH_REFERRERS = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://www.facebook.com/',
  'https://www.instagram.com/',
  'https://t.co/', // Twitter shortener
  'https://www.reddit.com/',
  'https://duckduckgo.com/'
];

export function getRandomReferrer(): string {
  return STEALTH_REFERRERS[Math.floor(Math.random() * STEALTH_REFERRERS.length)];
}

export async function getHeaders(userAgent?: string): Promise<Record<string, string>> {
  const ua = userAgent || await settingsCache.getDefaultUserAgent();
  const headers: Record<string, string> = {
    'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-AU,en;q=0.9',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
  return headers;
}
