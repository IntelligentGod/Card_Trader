import type { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';
import { SOCIAL_LINK_KEYS, type SocialLinkKey, type SocialLinks } from '@card-trader/shared';
import { sanitizeText } from './transforms';

export const MAX_SOCIAL_LINK_LENGTH = 200;
// Handles ("@cardshop") or http(s) URLs; no spaces, no other schemes.
const LINK_PATTERN = /^(@?[\w.-]{1,60}|https?:\/\/[^\s]{3,190})$/i;

function isSocialKey(key: string): key is SocialLinkKey {
  return (SOCIAL_LINK_KEYS as readonly string[]).includes(key);
}

/** Trims values and drops empty ones, so clearing a field removes the link. */
export function NormalizeSocialLinks() {
  return Transform(({ value }) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitizeText(raw);
      if (cleaned === '' || cleaned === null || cleaned === undefined) continue;
      out[key] = cleaned;
    }
    return out;
  });
}

/** Only known networks; each value is a handle or an http(s) URL. */
export function IsSocialLinks(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isSocialLinks',
      target: target.constructor,
      propertyName,
      options: {
        message: `Social links accept ${SOCIAL_LINK_KEYS.join(', ')} as handles or http(s) links`,
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
          return Object.entries(value as Record<string, unknown>).every(
            ([key, link]) =>
              isSocialKey(key) &&
              typeof link === 'string' &&
              link.length <= MAX_SOCIAL_LINK_LENGTH &&
              LINK_PATTERN.test(link),
          );
        },
      },
    });
}

/** Reads a stored JSON column defensively: unknown keys and non-strings are dropped. */
export function readSocialLinks(json: Prisma.JsonValue | null | undefined): SocialLinks {
  if (json === null || json === undefined || typeof json !== 'object' || Array.isArray(json)) return {};
  const links: SocialLinks = {};
  for (const [key, value] of Object.entries(json)) {
    if (isSocialKey(key) && typeof value === 'string' && value.length > 0) links[key] = value;
  }
  return links;
}
