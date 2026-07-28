export interface LocaleOption {
  label: string;
  value: string;
  subLabel: string;
}

export const AUTOMATIC_CURRENCY_OPTION = {
  label: 'Automatic',
  value: '',
  subLabel: 'Show retailer prices without conversion',
};

export const AUTOMATIC_LOCALE_OPTION: LocaleOption = {
  label: 'Automatic',
  value: '',
  subLabel: 'Use your browser format',
};

/**
 * Display formats for the shopping markets PriceStalker already supports.
 *
 * This is intentionally a compact, frontend-only list rather than a general
 * BCP 47 catalogue. It includes every existing currency default plus the
 * country/language variants covered by the current regional domain mappings.
 */
export const LOCALE_OPTIONS: LocaleOption[] = [
  { label: 'Arabic (United Arab Emirates)', value: 'ar-AE', subLabel: 'ar-AE' },
  { label: 'Czech (Czechia)', value: 'cs-CZ', subLabel: 'cs-CZ' },
  { label: 'Danish (Denmark)', value: 'da-DK', subLabel: 'da-DK' },
  { label: 'German (Austria)', value: 'de-AT', subLabel: 'de-AT' },
  { label: 'German (Switzerland)', value: 'de-CH', subLabel: 'de-CH' },
  { label: 'German (Germany)', value: 'de-DE', subLabel: 'de-DE' },
  { label: 'Greek (Cyprus)', value: 'el-CY', subLabel: 'el-CY' },
  { label: 'Greek (Greece)', value: 'el-GR', subLabel: 'el-GR' },
  { label: 'English (Australia)', value: 'en-AU', subLabel: 'en-AU' },
  { label: 'English (Canada)', value: 'en-CA', subLabel: 'en-CA' },
  { label: 'English (United Kingdom)', value: 'en-GB', subLabel: 'en-GB' },
  { label: 'English (Ireland)', value: 'en-IE', subLabel: 'en-IE' },
  { label: 'English (India)', value: 'en-IN', subLabel: 'en-IN' },
  { label: 'English (New Zealand)', value: 'en-NZ', subLabel: 'en-NZ' },
  { label: 'English (Philippines)', value: 'en-PH', subLabel: 'en-PH' },
  { label: 'English (Singapore)', value: 'en-SG', subLabel: 'en-SG' },
  { label: 'English (United States)', value: 'en-US', subLabel: 'en-US' },
  { label: 'English (South Africa)', value: 'en-ZA', subLabel: 'en-ZA' },
  { label: 'Spanish (Argentina)', value: 'es-AR', subLabel: 'es-AR' },
  { label: 'Spanish (Chile)', value: 'es-CL', subLabel: 'es-CL' },
  { label: 'Spanish (Colombia)', value: 'es-CO', subLabel: 'es-CO' },
  { label: 'Spanish (Spain)', value: 'es-ES', subLabel: 'es-ES' },
  { label: 'Spanish (Mexico)', value: 'es-MX', subLabel: 'es-MX' },
  { label: 'Estonian (Estonia)', value: 'et-EE', subLabel: 'et-EE' },
  { label: 'Finnish (Finland)', value: 'fi-FI', subLabel: 'fi-FI' },
  { label: 'French (Belgium)', value: 'fr-BE', subLabel: 'fr-BE' },
  { label: 'French (Canada)', value: 'fr-CA', subLabel: 'fr-CA' },
  { label: 'French (Switzerland)', value: 'fr-CH', subLabel: 'fr-CH' },
  { label: 'French (France)', value: 'fr-FR', subLabel: 'fr-FR' },
  { label: 'French (Luxembourg)', value: 'fr-LU', subLabel: 'fr-LU' },
  { label: 'Hebrew (Israel)', value: 'he-IL', subLabel: 'he-IL' },
  { label: 'Hungarian (Hungary)', value: 'hu-HU', subLabel: 'hu-HU' },
  { label: 'Indonesian (Indonesia)', value: 'id-ID', subLabel: 'id-ID' },
  { label: 'Icelandic (Iceland)', value: 'is-IS', subLabel: 'is-IS' },
  { label: 'Italian (Switzerland)', value: 'it-CH', subLabel: 'it-CH' },
  { label: 'Italian (Italy)', value: 'it-IT', subLabel: 'it-IT' },
  { label: 'Japanese (Japan)', value: 'ja-JP', subLabel: 'ja-JP' },
  { label: 'Korean (South Korea)', value: 'ko-KR', subLabel: 'ko-KR' },
  { label: 'Lithuanian (Lithuania)', value: 'lt-LT', subLabel: 'lt-LT' },
  { label: 'Latvian (Latvia)', value: 'lv-LV', subLabel: 'lv-LV' },
  { label: 'Maltese (Malta)', value: 'mt-MT', subLabel: 'mt-MT' },
  { label: 'Malay (Malaysia)', value: 'ms-MY', subLabel: 'ms-MY' },
  { label: 'Dutch (Belgium)', value: 'nl-BE', subLabel: 'nl-BE' },
  { label: 'Dutch (Netherlands)', value: 'nl-NL', subLabel: 'nl-NL' },
  { label: 'Norwegian Bokmål (Norway)', value: 'nb-NO', subLabel: 'nb-NO' },
  { label: 'Polish (Poland)', value: 'pl-PL', subLabel: 'pl-PL' },
  { label: 'Portuguese (Brazil)', value: 'pt-BR', subLabel: 'pt-BR' },
  { label: 'Portuguese (Portugal)', value: 'pt-PT', subLabel: 'pt-PT' },
  { label: 'Romanian (Romania)', value: 'ro-RO', subLabel: 'ro-RO' },
  { label: 'Russian (Russia)', value: 'ru-RU', subLabel: 'ru-RU' },
  { label: 'Slovak (Slovakia)', value: 'sk-SK', subLabel: 'sk-SK' },
  { label: 'Slovenian (Slovenia)', value: 'sl-SI', subLabel: 'sl-SI' },
  { label: 'Swedish (Sweden)', value: 'sv-SE', subLabel: 'sv-SE' },
  { label: 'Thai (Thailand)', value: 'th-TH', subLabel: 'th-TH' },
  { label: 'Turkish (Turkey)', value: 'tr-TR', subLabel: 'tr-TR' },
  { label: 'Ukrainian (Ukraine)', value: 'uk-UA', subLabel: 'uk-UA' },
  { label: 'Vietnamese (Vietnam)', value: 'vi-VN', subLabel: 'vi-VN' },
  { label: 'Chinese (China)', value: 'zh-CN', subLabel: 'zh-CN' },
  { label: 'Chinese (Hong Kong)', value: 'zh-HK', subLabel: 'zh-HK' },
];
