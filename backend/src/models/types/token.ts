export interface SystemApiToken {
  id: number;
  admin_id: number | null;
  token_hash: string;
  label: string;
  description: string | null;
  created_at: Date;
  expires_at: Date | null;
  last_used_at: Date | null;
}

export interface CreateSystemApiToken {
  admin_id?: number;
  token_hash: string;
  label: string;
  description?: string;
  expires_at?: Date;
}
