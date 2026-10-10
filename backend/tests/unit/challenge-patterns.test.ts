import { describe, it, expect } from 'vitest';

export function buildChallengeRegex(customPhrases?: string[]): RegExp {
  const defaultPhrases = [
    'are you a robot',
    'just a moment',
    'access denied',
    'verify you are human',
    'pardon our interruption',
    'security check',
    'attention required',
  ];
  const phrases = customPhrases && customPhrases.length > 0 ? customPhrases : defaultPhrases;
  return new RegExp(
    phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'i'
  );
}

describe('Challenge Pattern Interstitials', () => {
  const pattern = buildChallengeRegex();

  it('matches common bot-wall and anti-bot challenge titles', () => {
    expect(pattern.test('<title>Pardon Our Interruption</title>')).toBe(true);
    expect(pattern.test('<title>Just a moment...</title>')).toBe(true);
    expect(pattern.test('<h1>Security Check</h1>')).toBe(true);
    expect(pattern.test('<div>Please verify you are human before continuing</div>')).toBe(true);
    expect(pattern.test('<h2>Access Denied</h2>')).toBe(true);
    expect(pattern.test('<span>Are you a robot?</span>')).toBe(true);
    expect(pattern.test('<h1>Attention Required! | Cloudflare</h1>')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(pattern.test('pardon our interruption')).toBe(true);
    expect(pattern.test('PARDON OUR INTERRUPTION')).toBe(true);
    expect(pattern.test('SeCuRiTy ChEcK')).toBe(true);
  });

  it('does not match standard product pages without challenges', () => {
    const regularHtml = `
      <html>
        <head><title>Nintendo Switch OLED Console - EB Games Australia</title></head>
        <body>
          <h1>Nintendo Switch OLED</h1>
          <span class="price">$539.00</span>
          <p>This console features a vibrant 7-inch OLED screen.</p>
        </body>
      </html>
    `;
    expect(pattern.test(regularHtml)).toBe(false);
  });

  it('supports custom retailer-specific challenge phrases', () => {
    const customPattern = buildChallengeRegex(['blocked by perimeterx', 'human verification needed']);
    expect(customPattern.test('<div>blocked by perimeterx</div>')).toBe(true);
    expect(customPattern.test('<div>human verification needed</div>')).toBe(true);
    expect(customPattern.test('<div>pardon our interruption</div>')).toBe(false);
  });
});
