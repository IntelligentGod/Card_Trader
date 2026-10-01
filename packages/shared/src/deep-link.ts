/**
 * QR codes contain ONLY a deep link with the user's random public id.
 * No email, internal id, or other personal data is ever encoded.
 */
export const APP_SCHEME = 'cardtrader';
export const PUBLIC_ID_LENGTH = 12;
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{10,16}$/;

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

export function buildUserDeepLink(publicId: string): string {
  if (!isValidPublicId(publicId)) throw new Error('Invalid public id');
  return `${APP_SCHEME}://u/${publicId}`;
}

/**
 * Strictly parses scanned QR content. Anything that is not exactly our
 * deep-link format is rejected, so scanning arbitrary codes is harmless.
 */
export function parseUserDeepLink(raw: string): string | null {
  const match = /^cardtrader:\/\/u\/([A-Za-z0-9_-]{10,16})$/.exec(raw.trim());
  return match?.[1] ?? null;
}
