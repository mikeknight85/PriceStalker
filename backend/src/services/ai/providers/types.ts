export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  text: string;
  usage?: AIUsage;
}

export interface AIRequestOptions {
  maxTokens?: number;
  jsonMode?: boolean;
  productId?: number;
  retryLabel?: string;
}

export interface AIProvider {
  generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse>;
}
