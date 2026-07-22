#!/usr/bin/env node
/**
 * Fails if any emoji appear in the frontend source.
 *
 * The UI uses an SVG icon set (frontend/src/components/Icon), never emoji --
 * see CLAUDE.md rule 1. This catches both literal emoji and the Unicode-escape
 * form (`'\u{1F514}'`, `'🔔'`) that a plain text search misses, which
 * is how a batch of them nearly shipped once.
 *
 * Run locally:  node scripts/check-no-emoji.mjs
 * CI runs the same script, so a clean local run means a clean CI check.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'frontend/src';

// Emoji / pictographic ranges. Deliberately excludes the plain arrows
// (U+2190–U+21FF) that CLAUDE.md permits as genuine text.
const RANGES = [
  [0x1f300, 0x1faff], // symbols, pictographs, supplemental, extended-A
  [0x1f000, 0x1f0ff], // mahjong, dominoes, playing cards
  [0x2600, 0x27bf], // misc symbols + dingbats (☀ ✂ ✅ ✈ …)
  [0x2b00, 0x2bff], // misc symbols and arrows (⬅ ⬆ ⭐ …)
  [0xfe00, 0xfe0f], // variation selectors (the "️" that trails many emoji)
  [0x1f1e6, 0x1f1ff], // regional indicators (flags)
];

const inRange = (cp) => RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);

// Literal codepoints, plus escaped forms: \u{1F514}, \uD83D, \x{1F514}
const ESCAPE_RE = /\\u\{([0-9a-fA-F]{2,6})\}|\\u([0-9a-fA-F]{4})|\\x\{([0-9a-fA-F]{2,6})\}/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      yield* walk(p);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      yield p;
    }
  }
}

const findings = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    // literal emoji
    for (const ch of line) {
      const cp = ch.codePointAt(0);
      if (inRange(cp)) {
        findings.push({ file, line: i + 1, kind: 'literal', ch });
      }
    }
    // escaped emoji
    for (const m of line.matchAll(ESCAPE_RE)) {
      const cp = parseInt(m[1] ?? m[2] ?? m[3], 16);
      // A lone surrogate (\uD83D) is escaped-emoji territory even though it is
      // not itself in a range above; flag the high-surrogate block.
      if (inRange(cp) || (cp >= 0xd800 && cp <= 0xdbff)) {
        findings.push({ file, line: i + 1, kind: 'escaped', ch: m[0] });
      }
    }
  });
}

if (findings.length === 0) {
  console.log('✓ no emoji in frontend/src');
  process.exit(0);
}

console.error(`\nEmoji found in frontend/src (${findings.length}). Use <Icon name="..."/> instead — see CLAUDE.md rule 1.\n`);
for (const f of findings) {
  console.error(`  ${relative('.', f.file)}:${f.line}  [${f.kind}]  ${f.ch}`);
}
console.error('');
process.exit(1);
