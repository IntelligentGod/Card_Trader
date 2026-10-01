import type { NotificationResponse } from '@card-trader/shared';
import { validatePasswordChange } from '../features/auth/screens/ChangePasswordScreen';
import { createAppleNonce, randomNonce } from '../features/auth/socialSignIn';
import {
  groupSecret,
  isCompleteOtp,
  isCompleteRecoveryCode,
  normalizeOtp,
  normalizeRecoveryCode,
  recoveryCodesText,
  twoFactorProof,
} from '../features/auth/twoFactor';
import { HELP_ARTICLES, HELP_SECTIONS, searchHelp } from '../features/help/articles';
import { supportMailto } from '../features/help/contactSupport';
import { advanceBanner, EMPTY_BANNER_QUEUE, enqueueBanner } from '../features/notifications/bannerQueue';
import { notificationTarget } from '../features/notifications/hooks';
import { emitNotification, subscribeNotifications } from '../features/notifications/notificationEvents';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  getRandomBytes: jest.fn((count: number) => Uint8Array.from({ length: count }, (_, i) => (i * 37) % 256)),
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => `ABCDEF${data.length}`),
}));

describe('2FA code input', () => {
  it('keeps 6 digits from typed or pasted codes', () => {
    expect(normalizeOtp('123 456')).toBe('123456');
    expect(normalizeOtp('12-34-56-78')).toBe('123456');
    expect(normalizeOtp('abc')).toBe('');
    expect(isCompleteOtp('123456')).toBe(true);
    expect(isCompleteOtp('12345')).toBe(false);
  });

  it('formats recovery codes as xxxx-xxxx-xxxx', () => {
    expect(normalizeRecoveryCode('K7M29QXA4TPW')).toBe('k7m2-9qxa-4tpw');
    expect(normalizeRecoveryCode(' k7m2 9qxa-4tpw ')).toBe('k7m2-9qxa-4tpw');
    expect(normalizeRecoveryCode('k7m2-9q')).toBe('k7m2-9q');
    expect(isCompleteRecoveryCode('k7m2-9qxa-4tpw')).toBe(true);
    expect(isCompleteRecoveryCode('k7m2-9qxa')).toBe(false);
  });

  it('sends exactly one kind of proof', () => {
    expect(twoFactorProof('code', '123 456')).toEqual({ code: '123456' });
    expect(twoFactorProof('recovery', 'K7M2 9QXA 4TPW')).toEqual({ recoveryCode: 'k7m2-9qxa-4tpw' });
  });

  it('groups the secret and lists recovery codes for sharing', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    const text = recoveryCodesText(['aaaa-bbbb-cccc', 'dddd-eeee-ffff']);
    expect(text).toContain(' 1. aaaa-bbbb-cccc');
    expect(text).toContain(' 2. dddd-eeee-ffff');
  });
});

describe('password change validation', () => {
  it('needs the current password only when asked, and a matching 10+ char new one', () => {
    expect(validatePasswordChange('', 'long-enough-pass', 'long-enough-pass', true)).toEqual({ current: expect.any(String) });
    expect(validatePasswordChange('', 'long-enough-pass', 'long-enough-pass', false)).toEqual({});
    expect(Object.keys(validatePasswordChange('x', 'short', 'other', true)).sort()).toEqual(['confirm', 'next']);
  });
});

describe('Apple nonce', () => {
  it('sends the lowercase SHA-256 hex to Apple and keeps the raw nonce for the server', async () => {
    const raw = randomNonce();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    const nonce = await createAppleNonce();
    expect(nonce.raw).toBe(raw);
    expect(nonce.hashed).toBe('abcdef64');
    const crypto = jest.requireMock<typeof import('expo-crypto')>('expo-crypto');
    expect(crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', raw, { encoding: 'hex' });
  });
});

describe('help search', () => {
  it('matches title and body words in any order, titles first', () => {
    const results = searchHelp('recovery code');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.title.toLowerCase()).toContain('recovery code');
    expect(searchHelp('POKEMON').some((a) => a.id === 'what-is-card-trader')).toBe(true); // accent-insensitive
    expect(searchHelp('confirm received').map((a) => a.id)).toContain('complete-trade');
    expect(searchHelp('zzzz-no-such-topic')).toEqual([]);
    expect(searchHelp('   ')).toEqual([]);
  });

  it('has articles in every section, with unique ids', () => {
    for (const section of HELP_SECTIONS) expect(HELP_ARTICLES.some((a) => a.section === section.id)).toBe(true);
    expect(new Set(HELP_ARTICLES.map((a) => a.id)).size).toBe(HELP_ARTICLES.length);
  });
});

describe('contact support', () => {
  it('pre-fills subject, version, platform and public code', () => {
    const url = supportMailto({ version: '0.1.0', platform: 'android 35', publicId: 'AbCdEfGhIjKl' }, 'help@example.com');
    expect(url.startsWith('mailto:help@example.com?subject=Card%20Trader%20support&body=')).toBe(true);
    const body = decodeURIComponent(url.split('body=')[1]!);
    expect(body).toContain('App version: 0.1.0');
    expect(body).toContain('Platform: android 35');
    expect(body).toContain('Public code: AbCdEfGhIjKl');
    expect(decodeURIComponent(supportMailto({ version: '1', platform: 'ios' }))).not.toContain('Public code');
  });
});

const notification = (id: string): NotificationResponse => ({
  id,
  type: 'ANNOUNCEMENT',
  title: `Title ${id}`,
  body: 'Body',
  data: {},
  isRead: false,
  readAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
});

describe('notification banner queue', () => {
  it('shows one at a time, in order, without duplicates', () => {
    let q = enqueueBanner(EMPTY_BANNER_QUEUE, notification('a'));
    q = enqueueBanner(q, notification('b'));
    q = enqueueBanner(q, notification('a'));
    q = enqueueBanner(q, notification('b'));
    expect(q.current?.id).toBe('a');
    expect(q.waiting.map((n) => n.id)).toEqual(['b']);
    q = advanceBanner(q);
    expect(q.current?.id).toBe('b');
    q = advanceBanner(q);
    expect(q).toEqual(EMPTY_BANNER_QUEUE);
  });

  it('drops the oldest waiting banners beyond the limit', () => {
    let q = enqueueBanner(EMPTY_BANNER_QUEUE, notification('a'));
    for (const id of ['b', 'c', 'd', 'e']) q = enqueueBanner(q, notification(id), 2);
    expect(q.current?.id).toBe('a');
    expect(q.waiting.map((n) => n.id)).toEqual(['d', 'e']);
  });

  it('delivers emitted notifications to subscribers until they unsubscribe', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeNotifications((n) => seen.push(n.id));
    emitNotification(notification('x'));
    unsubscribe();
    emitNotification(notification('y'));
    expect(seen).toEqual(['x']);
  });

  it('opens nothing for announcements and security notices', () => {
    expect(notificationTarget('ANNOUNCEMENT', { tradeId: 't1' })).toBeNull();
    expect(notificationTarget('ACCOUNT_SECURITY', {})).toBeNull();
  });
});
