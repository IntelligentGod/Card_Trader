import { createHash, randomBytes } from 'crypto';
import { PUBLIC_ID_LENGTH } from '@card-trader/shared';

/** 12 url-safe chars ≈ 72 bits of entropy: not guessable or enumerable. */
export function generatePublicId(): string {
  return randomBytes(9).toString('base64url').slice(0, PUBLIC_ID_LENGTH);
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
