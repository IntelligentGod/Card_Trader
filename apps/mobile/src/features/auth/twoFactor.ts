import type { TwoFactorProofRequest } from '@card-trader/shared';

/** Authenticator codes are 6 digits; keep only digits so pasted "123 456" works. */
export function normalizeOtp(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

export const isCompleteOtp = (code: string) => /^\d{6}$/.test(code);

/**
 * Recovery codes look like "abcd-efgh-ijkl". Accept any case, spaces or
 * missing dashes and put the dashes back.
 */
export function normalizeRecoveryCode(input: string): string {
  const chars = input.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  return chars.match(/.{1,4}/g)?.join('-') ?? '';
}

export const isCompleteRecoveryCode = (code: string) => /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(code);

/** What the API expects for either kind of proof. */
export function twoFactorProof(mode: 'code' | 'recovery', value: string): TwoFactorProofRequest {
  return mode === 'code' ? { code: normalizeOtp(value) } : { recoveryCode: normalizeRecoveryCode(value) };
}

/** Base32 secret in groups of 4, easier to type into an authenticator by hand. */
export function groupSecret(secret: string): string {
  return secret.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') ?? '';
}

/** Plain-text list for Share / saving in a password manager. */
export function recoveryCodesText(codes: string[]): string {
  return [
    'Card Trader recovery codes',
    'Each code works once. Use one if you lose access to your authenticator app.',
    '',
    ...codes.map((code, index) => `${String(index + 1).padStart(2, ' ')}. ${code}`),
  ].join('\n');
}
