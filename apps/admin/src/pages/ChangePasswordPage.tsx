import { useState, type FormEvent } from 'react';
import { changePassword, errorMessage, logout } from '../api';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Shown before the console when an admin reset this account's password. */
export function ChangePasswordPage({ displayName }: { displayName: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await changePassword(password);
      // The session now holds new tokens with mustChangePassword=false; the console opens.
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>Choose a new password</h1>
        <p className="muted">
          Hi {displayName}, your password was reset by an administrator. Choose a new password to continue. Your
          other sessions will be signed out.
        </p>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <label className="form-field">
          <span>New password ({PASSWORD_MIN}–{PASSWORD_MAX} characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {tooShort && <small className="text-error">At least {PASSWORD_MIN} characters.</small>}
        </label>
        <label className="form-field">
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && <small className="text-error">Passwords don't match.</small>}
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={!valid || submitting}>
          {submitting ? 'Saving…' : 'Change password'}
        </button>
        <button type="button" className="link-button" onClick={() => void logout()}>
          Sign out
        </button>
      </form>
    </div>
  );
}
