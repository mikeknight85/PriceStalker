import { api } from '../../../api/client';
import { RetailerConfig, TestRetailerConfigResult } from '../../../types/api';

export const RetailerAdminService = {
  getRetailers: () => api.get<RetailerConfig[]>('/admin/retailers'),
  getRetailerByDomain: (domain: string) => api.get<RetailerConfig>(`/admin/retailers/domain/${domain}`),
  lookupRetailerByUrl: (url: string) => api.get<RetailerConfig>('/admin/retailers/lookup', { params: { url } }),
  testRetailerConfig: (config: Partial<RetailerConfig>, testUrl: string) =>
    api.post<TestRetailerConfigResult>('/admin/retailers/test', { config, url: testUrl }),
  upsertRetailer: (config: Partial<RetailerConfig>) =>
    api.post<RetailerConfig>('/admin/retailers', config),
  deleteRetailer: (id: number) => api.delete(`/admin/retailers/${id}`),

  debugExtract: (url: string, config?: Partial<RetailerConfig>, mode?: string, returnHtml?: boolean, use_ai?: boolean, force_ai?: boolean) => 
    api.post<any>('/admin/debug/extract', { url, config, mode, returnHtml, use_ai, force_ai }),
};
