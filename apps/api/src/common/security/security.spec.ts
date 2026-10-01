import { SecretBox } from './secret-box';
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  hotp,
  normalizeRecoveryCode,
  otpauthUrl,
  totpStep,
  verifyTotp,
} from './totp';

describe('TOTP (RFC 6238 test vectors)', () => {
  // RFC 6238 Appendix B, SHA-1 seed "12345678901234567890", 8 digits.
  const seed = Buffer.from('12345678901234567890', 'ascii');
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('time %i → %s', (seconds, expected) => {
    expect(hotp(seed, totpStep(seconds * 1000), 8)).toBe(expected);
  });

  it('round-trips base32 like authenticator apps expect', () => {
    expect(base32Encode(seed)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').equals(seed)).toBe(true);
  });

  it('accepts the current and adjacent steps, rejects others and replays', () => {
    const secret = base32Encode(seed);
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    const code = hotp(seed, step);
    expect(verifyTotp(secret, code, now, null)).toBe(step);
    expect(verifyTotp(secret, hotp(seed, step - 1), now, null)).toBe(step - 1);
    expect(verifyTotp(secret, hotp(seed, step - 3), now, null)).toBeNull();
    // Already used this step → replay refused.
    expect(verifyTotp(secret, code, now, step)).toBeNull();
    expect(verifyTotp(secret, '12345', now, null)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', now, null)).toBeNull();
  });

  it('builds an otpauth URI authenticator apps can read', () => {
    const url = otpauthUrl('Card Trader', 'tom@example.com', 'ABC');
    expect(url).toBe('otpauth://totp/Card%20Trader%3Atom%40example.com?secret=ABC&issuer=Card+Trader&algorithm=SHA1&digits=6&period=30');
  });
});

describe('recovery codes', () => {
  it('generates distinct, readable codes and normalises user input', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect(normalizeRecoveryCode(' K7M2-9QXA-4tpw ')).toBe('k7m29qxa4tpw');
  });
});

describe('SecretBox', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('encrypts so the same secret never looks the same, and decrypts it back', () => {
    const box = new SecretBox(key);
    const a = box.seal('JBSWY3DPEHPK3PXP');
    const b = box.seal('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(box.open(a)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuses tampered data and the wrong key', () => {
    const box = new SecretBox(key);
    const sealed = box.seal('secret');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => box.open(parts.join('.'))).toThrow();
    expect(() => new SecretBox(Buffer.alloc(32, 9).toString('base64')).open(sealed)).toThrow();
    expect(() => new SecretBox(Buffer.alloc(16).toString('base64'))).toThrow();
  });
});
