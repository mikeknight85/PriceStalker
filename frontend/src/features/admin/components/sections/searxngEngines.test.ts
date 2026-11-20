import { describe, it, expect } from 'vitest';
import {
  parseSearXNGEngines,
  addSearXNGEngine,
  removeSearXNGEngine,
  toggleSearXNGEngine,
  DEFAULT_RECOMMENDED_ENGINES
} from './searxngEngines';

describe('searxngEngines', () => {
  describe('parseSearXNGEngines', () => {
    it('returns empty array when input is null or undefined or empty', () => {
      expect(parseSearXNGEngines(null)).toEqual([]);
      expect(parseSearXNGEngines(undefined)).toEqual([]);
      expect(parseSearXNGEngines('')).toEqual([]);
      expect(parseSearXNGEngines('   ')).toEqual([]);
    });

    it('splits comma separated string, trims whitespace and downcases', () => {
      expect(parseSearXNGEngines(' Brave , Google, BING ')).toEqual(['brave', 'google', 'bing']);
    });

    it('deduplicates identical engines', () => {
      expect(parseSearXNGEngines('brave,google,brave,Google')).toEqual(['brave', 'google']);
    });
  });

  describe('addSearXNGEngine', () => {
    it('adds new engine to empty string', () => {
      expect(addSearXNGEngine('', 'brave')).toBe('brave');
      expect(addSearXNGEngine(null, 'brave')).toBe('brave');
    });

    it('appends new engine to existing list', () => {
      expect(addSearXNGEngine('brave,google', 'bing')).toBe('brave,google,bing');
    });

    it('ignores duplicate addition', () => {
      expect(addSearXNGEngine('brave,google', 'Google')).toBe('brave,google');
    });

    it('ignores empty input', () => {
      expect(addSearXNGEngine('brave,google', '   ')).toBe('brave,google');
    });
  });

  describe('removeSearXNGEngine', () => {
    it('removes engine from list', () => {
      expect(removeSearXNGEngine('brave,google,bing', 'google')).toBe('brave,bing');
    });

    it('removes case-insensitively', () => {
      expect(removeSearXNGEngine('brave,google,bing', 'Google')).toBe('brave,bing');
    });

    it('returns empty string when last engine is removed', () => {
      expect(removeSearXNGEngine('brave', 'brave')).toBe('');
    });
  });

  describe('toggleSearXNGEngine', () => {
    it('adds engine if not present', () => {
      expect(toggleSearXNGEngine('brave,google', 'bing')).toBe('brave,google,bing');
    });

    it('removes engine if already present', () => {
      expect(toggleSearXNGEngine('brave,google,bing', 'google')).toBe('brave,bing');
    });
  });

  describe('DEFAULT_RECOMMENDED_ENGINES', () => {
    it('contains expected default engines', () => {
      expect(parseSearXNGEngines(DEFAULT_RECOMMENDED_ENGINES)).toEqual([
        'brave',
        'startpage',
        'duckduckgo_web',
        'google',
        'bing'
      ]);
    });
  });
});
