import { Transform } from 'class-transformer';

// Strips ASCII control characters except tab/newline; user text is stored as
// plain text and always rendered as text (never HTML) by clients.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(CONTROL_CHARS, '').trim();
}

/** Trim + strip control chars. Empty strings become null when `emptyToNull`. */
export function SanitizedText(options: { emptyToNull?: boolean } = {}) {
  return Transform(({ value }) => {
    const cleaned = sanitizeText(value);
    if (options.emptyToNull && cleaned === '') return null;
    return cleaned;
  });
}

export function LowercaseEmail() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
}
