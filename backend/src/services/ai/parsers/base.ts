/**
 * Strip thinking mode tags from model responses (Qwen3, DeepSeek, etc.)
 */
export function stripThinkingTags(text: string): string {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return stripped.length > 0 ? stripped : text;
}

/**
 * Extracts a JSON object from a string that might contain markdown or other text.
 */
export function extractJson(text: string): any {
  const cleanedText = stripThinkingTags(text);
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}
