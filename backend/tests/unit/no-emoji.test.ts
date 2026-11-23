import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Enforces Rule 1 from AGENTS.md: "Do not reintroduce emoji into the UI".
 *
 * Runs the exact emoji checks as `scripts/check-no-emoji.mjs` inside Vitest so that
 * unit test suites immediately catch any emoji or escaped Unicode codepoint in frontend/src.
 */

const RANGES: [number, number][] = [
  [0x1f300, 0x1faff], // symbols, pictographs, supplemental, extended-A
  [0x1f000, 0x1f0ff], // mahjong, dominoes, playing cards
  [0x2600, 0x27bf],   // misc symbols + dingbats
  [0x2b00, 0x2bff],   // misc symbols and arrows
  [0xfe00, 0xfe0f],   // variation selectors
  [0x1f1e6, 0x1f1ff], // regional indicators
  [0x231a, 0x231b],   // Watch, hourglass
  [0x23e9, 0x23f3],   // Media fast-forward, alarm, timers
  [0x23f8, 0x23fa],   // Pause, stop, record
  [0x2934, 0x2935],   // Curved arrows presented as emoji
];

const inRange = (cp: number) => RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);

const ESCAPE_RE = /\\u\{([0-9a-fA-F]{2,6})\}|\\u([0-9a-fA-F]{4})|\\x\{([0-9a-fA-F]{2,6})\}/g;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      yield* walk(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx')) {
      yield p;
    }
  }
}

describe('Rule 1: No emoji in UI source (frontend/src)', () => {
  it('contains zero emoji or unicode-escaped emoji in frontend/src', () => {
    const srcDir = resolve(__dirname, '../../../frontend/src');
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of walk(srcDir)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Literal emoji
        for (const ch of line) {
          const cp = ch.codePointAt(0);
          if (cp && inRange(cp)) {
            violations.push({
              file,
              line: i + 1,
              text: `Literal character with codepoint U+${cp.toString(16).toUpperCase()}`,
            });
          }
        }

        // 2. Escaped emoji
        for (const m of line.matchAll(ESCAPE_RE)) {
          const cp = parseInt(m[1] ?? m[2] ?? m[3], 16);
          if (inRange(cp) || (cp >= 0xd800 && cp <= 0xdbff)) {
            violations.push({
              file,
              line: i + 1,
              text: `Escaped character ${m[0]} with codepoint U+${cp.toString(16).toUpperCase()}`,
            });
          }
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} emoji violation(s) in frontend/src:\n${violations.map(v => `${v.file}:${v.line} - ${v.text}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('detects both literal and unicode-escaped emoji patterns accurately', () => {
    // Dynamically constructed strings so no literal emoji or escape tokens exist in source
    const sampleLiteralBell = String.fromCodePoint(0x1f514);
    const sampleHourglass = String.fromCodePoint(0x23f3);

    expect(inRange(sampleLiteralBell.codePointAt(0)!)).toBe(true);
    expect(inRange(sampleHourglass.codePointAt(0)!)).toBe(true);

    // Normal characters and allowed arrows (U+2190 - U+21FF) should NOT be in emoji range
    const arrowLeft = '←';
    const arrowRight = '→';
    expect(inRange(arrowLeft.codePointAt(0)!)).toBe(false);
    expect(inRange(arrowRight.codePointAt(0)!)).toBe(false);
  });
});
