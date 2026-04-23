/**
 * errors.ts — translate opaque backend error codes into user-facing
 * messages. Raw exception details must never reach users (CodeQL:
 * py/stack-trace-exposure); the backend now returns sanitised codes
 * like "upstream_timeout". This module maps them to localised strings
 * and leaves unknown values as-is (the backend already guarantees they
 * are not stack traces).
 */
import { t, type Lang, type TranslationKey } from './i18n';

const KNOWN_CODES: Record<string, TranslationKey> = {
  upstream_timeout: 'error.upstream_timeout',
  upstream_network_error: 'error.upstream_network_error',
  upstream_unavailable: 'error.upstream_unavailable',
  upstream_empty_response: 'error.upstream_empty_response',
};

export function formatBackendError(code: string | null | undefined, lang: Lang): string {
  if (!code) return '';
  const key = KNOWN_CODES[code];
  if (key) return t(key, lang);
  return code;
}
