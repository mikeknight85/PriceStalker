import { describe, expect, it } from 'vitest';
import { LOCALE_OPTIONS } from './regionalOptions';

const EXISTING_DEFAULT_LOCALES = [
  'de-CH', 'en-US', 'de-DE', 'en-GB', 'en-AU', 'en-CA', 'en-NZ', 'ja-JP',
  'zh-CN', 'en-IN', 'pt-BR', 'es-MX', 'pl-PL', 'sv-SE', 'nb-NO', 'da-DK',
  'cs-CZ', 'hu-HU', 'ro-RO', 'tr-TR', 'ru-RU', 'ko-KR', 'en-SG', 'zh-HK',
  'en-ZA', 'he-IL', 'ar-AE', 'th-TH', 'ms-MY', 'en-PH', 'id-ID', 'vi-VN',
  'es-CL', 'es-AR', 'es-CO', 'uk-UA',
];

const TARGETED_ADDITIONS = [
  'is-IS', 'de-AT', 'fr-BE', 'nl-BE', 'fr-FR', 'it-IT', 'es-ES', 'nl-NL',
  'en-IE', 'pt-PT', 'fi-FI', 'el-GR', 'sk-SK', 'sl-SI', 'et-EE', 'lv-LV',
  'lt-LT', 'fr-LU', 'el-CY', 'mt-MT', 'fr-CA', 'fr-CH', 'it-CH',
];

describe('LOCALE_OPTIONS', () => {
  it('contains every existing currency default and only the targeted additions', () => {
    const localeCodes = LOCALE_OPTIONS.map(({ value }) => value);

    expect(localeCodes).toHaveLength(EXISTING_DEFAULT_LOCALES.length + TARGETED_ADDITIONS.length);
    expect(new Set(localeCodes).size).toBe(localeCodes.length);
    expect(localeCodes).toEqual(expect.arrayContaining(EXISTING_DEFAULT_LOCALES));
    expect(localeCodes).toEqual(expect.arrayContaining(TARGETED_ADDITIONS));
  });

  it('includes Icelandic formatting for the newly supported currency', () => {
    expect(LOCALE_OPTIONS).toContainEqual({
      label: 'Icelandic (Iceland)',
      value: 'is-IS',
      subLabel: 'is-IS',
    });
  });
});
