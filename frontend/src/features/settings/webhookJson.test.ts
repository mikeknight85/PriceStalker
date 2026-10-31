import { describe, it, expect } from 'vitest';
import { webhookHeadersProblem, webhookSendsPlainText, webhookTemplateProblem } from './webhookJson';

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
  });

  it('is true for a content type that is not JSON, whatever its case', () => {
    expect(webhookSendsPlainText('{"Content-Type": "text/plain"}')).toBe(true);
    expect(webhookSendsPlainText('{"CONTENT-TYPE": "application/x-www-form-urlencoded"}')).toBe(true);
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
