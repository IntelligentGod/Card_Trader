import { USERNAME_PATTERN } from '@card-trader/shared';

/** Client-side checks for fast feedback only. The API remains the authority. */
export interface AuthFormErrors {
  email?: string;
  password?: string;
  displayName?: string;
  username?: string;
}

/** Same normalization as the API: case-insensitive, a leading "@" is ignored. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function validateUsername(value: string): string | undefined {
  return USERNAME_PATTERN.test(normalizeUsername(value)) ? undefined : 'Use 3–20 letters, numbers or underscores';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(email: string, password: string): AuthFormErrors {
  const errors: AuthFormErrors = {};
  if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Enter your password';
  return errors;
}

export function validateRegister(email: string, password: string, displayName: string, username?: string): AuthFormErrors {
  const errors: AuthFormErrors = {};
  if (username !== undefined) {
    const usernameError = validateUsername(username);
    if (usernameError) errors.username = usernameError;
  }
  if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address';
  if (password.length < 10) errors.password = 'Use at least 10 characters';
  const name = displayName.trim();
  if (name.length < 2 || name.length > 40) errors.displayName = 'Display name must be 2–40 characters';
  return errors;
}

export const hasErrors = (errors: AuthFormErrors) => Object.keys(errors).length > 0;
