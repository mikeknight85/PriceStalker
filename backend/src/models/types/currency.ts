export interface RegionalCurrencyMapping {
  id: number;
  pattern: string;
  currency: string;
  match_type: 'tld' | 'path';
  active: boolean;
}

export interface GlobalCurrency {
  id: number;
  country_territory: string;
  currency_name: string;
  iso: string;
  symbol: string;
  locale: string;
  separation: string;
  position: string;
}

export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: Date;
}
