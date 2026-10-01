import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

// OWASP-recommended argon2id baseline (19 MiB, t=2, p=1).
const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '1234567890',
  '12345678910',
  'qwertyuiop',
  'iloveyou123',
  'letmein123',
  'welcome123',
  'pokemon123',
  'pikachu123',
  'charizard1',
  'onepiece123',
]);

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Used to spend equal time when an email is unknown (prevents user enumeration by timing). */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('dummy-password-for-timing', HASH_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async verify(hash: string | null, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash ?? this.dummyHash, password);
    } catch {
      return false;
    }
  }

  /** Returns a human-readable reason when the password is too weak, else null. */
  weaknessReason(password: string, email: string): string | null {
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower)) return 'This password is too common';
    const local = email.split('@')[0]?.toLowerCase() ?? '';
    if (local.length >= 4 && lower.includes(local)) return 'Password must not contain your email';
    if (new Set(password).size < 4) return 'Password is too repetitive';
    return null;
  }
}
