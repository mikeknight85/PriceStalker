import { describe, it, expect } from 'vitest';
import {
  webhookHeadersProblem,
  webhookSendsPlainText,
  webhookTemplateFormat,
  webhookTemplateProblem,
} from './webhookJson';

describe('webhookHeadersProblem', () => {
  it('accepts empty headers and a JSON object', () => {
    expect(webhookHeadersProblem('')).toBeNull();
    expect(webhookHeadersProblem('   ')).toBeNull();
    expect(webhookHeadersProblem('{"Authorization": "Bearer abc"}')).toBeNull();
  });

  it('rejects text that is not JSON', () => {
    expect(webhookHeadersProblem('{"Authorization": Bearer abc')).not.toBeNull();
  });

  it.each(['[1, 2]', '"x"', 'null', '42'])('rejects %s, which is JSON but not an object', (text) => {
    expect(webhookHeadersProblem(text)).toMatch(/JSON object/);
  });
});

describe('webhookSendsPlainText', () => {
  it('is false by default and for JSON content types', () => {
    expect(webhookSendsPlainText('')).toBe(false);
    expect(webhookSendsPlainText('{"Authorization": "x"}')).toBe(false);
    expect(webhookSendsPlainText('{"Content-Type": "application/json; charset=utf-8"}')).toBe(false);
    expect(webhookSendsPlainText('{"content-type": "application/vnd.api+json"}')).toBe(false);
    expect(webhookSendsPlainText('{"Content-Type": "application/problem+json"}')).toBe(false);
  });

  it('is true for a content type that is not JSON, whatever its case', () => {
    expect(webhookSendsPlainText('{"Content-Type": "text/plain"}')).toBe(true);
    expect(webhookSendsPlainText('{"CONTENT-TYPE": "application/x-www-form-urlencoded"}')).toBe(true);
  });

  it('ignores "json" in a parameter of a non-JSON content type', () => {
    expect(webhookSendsPlainText('{"Content-Type": "text/plain; profile=\\"json\\""}')).toBe(true);
  });

  it('is false when the headers cannot be read, so the headers error shows instead', () => {
    expect(webhookSendsPlainText('{"Content-Type": text/plain')).toBe(false);
    expect(webhookSendsPlainText('[1]')).toBe(false);
  });
});

describe('webhookTemplateProblem', () => {
  it('accepts empty and well-formed templates, with variables inside quotes', () => {
    expect(webhookTemplateProblem('', false)).toBeNull();
    expect(webhookTemplateProblem('{"title": "{{product_name}}", "body": "{{type}}: {{price}}"}', false)).toBeNull();
    expect(webhookTemplateProblem('{"title": "{{ product_name }}"}', false)).toBeNull();
  });

  it.each(['{{product_name}}', '{{price}}', '{{current_price}}'])(
    'asks for quotes around a bare %s, even a numeric one that reads "unavailable" without a price',
    (variable) => {
      expect(webhookTemplateProblem(`{"value": ${variable}}`, false)).toMatch(/inside quotes/);
    }
  );

  it('reports the parser error when the template is broken for another reason', () => {
    const problem = webhookTemplateProblem('{"title": "{{product_name}}",}', false);
    expect(problem).not.toBeNull();
    expect(problem).not.toMatch(/inside quotes/);
  });

  it('does not judge a plain-text template', () => {
    expect(webhookTemplateProblem('Now {{product_name}} at {{price}}', true)).toBeNull();
  });
});

describe('webhookTemplateFormat (issue #272 regression)', () => {
  /*
   * The headers are a credential and are not returned by the API, so on a
   * freshly loaded page the Headers field is empty even for a configured
   * webhook. Reading the format off that empty draft said "JSON", a working
   * text/plain template was reported as broken, and the section's single Save
   * then refused every channel. The stored answer has to come from the server.
   */

  it('follows the draft whenever the user has typed headers', () => {
    expect(webhookTemplateFormat('{"Content-Type": "text/plain"}', false)).toBe('plain-text');
    expect(webhookTemplateFormat('{"Content-Type": "application/json"}', true)).toBe('json');
    // Still the draft's answer even when the server has not sent a hint.
    expect(webhookTemplateFormat('{"Content-Type": "text/plain"}', undefined)).toBe('plain-text');
  });

  it('falls back to the stored hint when the draft is empty', () => {
    expect(webhookTemplateFormat('', true)).toBe('plain-text');
    expect(webhookTemplateFormat('   ', true)).toBe('plain-text');
    expect(webhookTemplateFormat('', false)).toBe('json');
  });

  it('is unknown when no hint arrived, rather than guessing JSON', () => {
    // A stale backend, a misconfigured proxy, or the e2e suite's `{}`.
    expect(webhookTemplateFormat('', undefined)).toBe('unknown');
  });

  it('does not report a stored plain-text template as broken after a page load', () => {
    const template = 'Now {{price}} at {{store}}: {{product_url}}';
    // The field the user sees on load: headers empty, template returned in full.
    expect(webhookTemplateProblem(template, webhookTemplateFormat('', true))).toBeNull();
    // And not when the hint is missing either.
    expect(webhookTemplateProblem(template, webhookTemplateFormat('', undefined))).toBeNull();
    // A JSON webhook is still checked, which is the point of the feature.
    expect(webhookTemplateProblem(template, webhookTemplateFormat('', false))).not.toBeNull();
  });

  it('still takes a plain boolean, as the pre-hint callers passed', () => {
    expect(webhookTemplateProblem('not json', true)).toBeNull();
    expect(webhookTemplateProblem('not json', false)).not.toBeNull();
  });

  it('agrees with webhookSendsPlainText on a draft it can read', () => {
    for (const headers of [
      '{"Content-Type": "text/plain"}',
      '{"content-type": "application/x-www-form-urlencoded"}',
      '{"Content-Type": "application/vnd.api+json"}',
      '{"Authorization": "Bearer abc"}',
    ]) {
      const expected = webhookSendsPlainText(headers) ? 'plain-text' : 'json';
      expect(webhookTemplateFormat(headers, undefined)).toBe(expected);
    }
  });
});
