import { type CheerioAPI } from 'cheerio';

/**
 * Detects common bot challenges in HTML.
 */
export function detectBotChallenge(html: string, $: CheerioAPI): string | null {
  const title = $('title').text().toLowerCase();

  // Akamai / Edgesuite (Kmart)
  if (title === 'access denied' || html.includes('Reference #18.') || html.includes('errors.edgesuite.net')) {
    return 'Akamai Access Denied';
  }

  // Cloudflare
  if (title.includes('just a moment') || title.includes('cloudflare') || html.includes('cloudflare-static') || html.includes('cf-browser-verification')) {
    return 'Cloudflare Challenge';
  }

  // DataDome
  if (html.includes('geo.captcha') || html.includes('dd-captcha') || html.includes('datadome.co')) {
    return 'DataDome Challenge';
  }

  // Imperva / Incapsula
  if (html.includes('Incapsula incident ID') || html.includes('_Incapsula_Resource')) {
    return 'Imperva/Incapsula Challenge';
  }

  // PerimeterX
  if (html.includes('perimeterx') || html.includes('px-captcha') || title.includes('access to this page has been denied') || html.includes('block.perimeterx.net')) {
    return 'PerimeterX Challenge';
  }

  // Generic Captcha / Bot signals
  if (html.length < 15000 && (html.includes('captcha') || title.includes('captcha') || html.includes('Prove you are human') || html.includes('Are you a robot'))) {
    return 'Generic Bot Challenge';
  }

  return null;
}
