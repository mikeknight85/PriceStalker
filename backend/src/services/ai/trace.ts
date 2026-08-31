import { logger } from '../../utils/system/logger';

/**
 * Debug tracing for AI provider exchanges (logging audit L-02).
 *
 * Only token counts were logged, so a wrong extraction gave no way to tell
 * whether the model was asked the wrong question or answered the right one
 * badly. The prompt and the raw response are the two things you need, and
 * neither was recorded anywhere.
 *
 * Both are capped rather than logged whole. A prompt carries the denoised
 * product page, so an uncapped trace would put a page of HTML into the console,
 * the log file and -- if DB_LOG_LEVEL is set to debug -- a system_logs row, for
 * every scrape. The audit's suggested `substring(0, 500)` is the right instinct;
 * this makes the limit configurable because 500 characters frequently cuts off
 * before the part you are looking at.
 *
 * Nothing here bypasses the scrubber: these go through logger.debug like any
 * other line, so URL credentials are redacted on the way out.
 */

const DEFAULT_TRACE_CHARS = 2000;

function traceLimit(): number {
  const configured = Number(process.env.AI_TRACE_CHARS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TRACE_CHARS;
}

function clip(value: string): string {
  const limit = traceLimit();
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}... [${value.length - limit} more chars]`;
}

export interface AiTraceMeta {
  provider: string;
  productId?: number;
  label?: string;
}

/** Records the prompt sent to a model. Costs nothing unless DEBUG is enabled. */
export function traceAiRequest(prompt: string, meta: AiTraceMeta): void {
  logger.debug(
    `AI | ${meta.provider} | Request${meta.label ? ` | ${meta.label}` : ''} | ${clip(prompt)}`,
    'AI',
    { provider: meta.provider, product_id: meta.productId, promptChars: prompt.length }
  );
}

/**
 * Records what the model actually returned, before any parsing.
 *
 * The raw form matters: most AI extraction failures are a model wrapping JSON in
 * prose or a code fence, which is invisible once parsing has already failed.
 */
export function traceAiResponse(raw: string | null | undefined, meta: AiTraceMeta): void {
  logger.debug(
    `AI | ${meta.provider} | Response${meta.label ? ` | ${meta.label}` : ''} | ${
      raw ? clip(raw) : '(empty)'
    }`,
    'AI',
    { provider: meta.provider, product_id: meta.productId, responseChars: raw?.length ?? 0 }
  );
}
