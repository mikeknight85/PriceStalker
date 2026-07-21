export interface AISettings {
  ai_enabled: boolean;
  ai_verification_enabled: boolean;
  ai_auto_mapping_enabled: boolean;
  ai_provider: 'anthropic' | 'openai' | 'ollama' | 'gemini' | 'deepseek' | 'groq' | 'mistral' | 'vertex' | null;
  anthropic_api_key: string | null;
  anthropic_model: string | null;
  openai_api_key: string | null;
  openai_model: string | null;
  ollama_base_url: string | null;
  ollama_model: string | null;
  gemini_api_key: string | null;
  gemini_model: string | null;
  vertex_project_id: string | null;
  vertex_location: string | null;
  vertex_api_key: string | null;
  vertex_model: string | null;
  deepseek_api_key: string | null;
  deepseek_model: string | null;
  groq_api_key: string | null;
  groq_model: string | null;
  mistral_api_key: string | null;
  mistral_model: string | null;
  jsonld_image_key: string | null;
  jsonld_price_key: string | null;
  jsonld_name_key: string | null;
  prefer_jsonld_image?: boolean;
  ai_timeout: number;
  ai_max_retries: number;
  redact_api_keys?: boolean;
}

export interface SystemLog {
  id: number;
  level: string;
  context: string;
  message: string;
  details: any;
  created_at: Date;
}
