import { api, type RequestOptions } from '../api/client';
import { GlobalCurrency } from '../types/api';

export const SharedService = {
  getCurrencies: (options?: RequestOptions) => api.get<GlobalCurrency[]>('/settings/currencies', options),
};
