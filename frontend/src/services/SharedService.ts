import { api } from '../api/client';
import { GlobalCurrency } from '../types/api';

export const SharedService = {
  getCurrencies: () => api.get<GlobalCurrency[]>('/settings/currencies'),
};
