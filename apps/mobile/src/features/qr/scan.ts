import { parseUserDeepLink } from '@card-trader/shared';

export type ScanOutcome = { kind: 'user'; publicId: string } | { kind: 'invalid' };

/**
 * Interprets scanned QR content. Only our exact deep-link format is accepted;
 * URLs, payment codes, or anything else are ignored — never opened.
 */
export function interpretScan(data: string, ownPublicId: string | undefined): ScanOutcome | { kind: 'self' } {
  const publicId = parseUserDeepLink(data);
  if (!publicId) return { kind: 'invalid' };
  if (publicId === ownPublicId) return { kind: 'self' };
  return { kind: 'user', publicId };
}
