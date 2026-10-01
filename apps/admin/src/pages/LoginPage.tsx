import { useState, type FormEvent } from 'react';
import { API_URL, ApiError, errorMessage, getNotice, login, verifyTwoFactor } from '../api';

type Step = { kind: 'credentials' } | { kind: 'twoFactor'; challengeToken: string };

export function LoginPage() {
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(() => getNotice());

  async function onCredentials(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const next = await login(email.trim(), password);
      if (next.kind === 'twoFactor') {
        setStep({ kind: 'twoFactor', challengeToken: next.challengeToken });
        setCode('');
        setUseRecovery(false);
        setSubmitting(false);
      }
      // On 'done' the session listener swaps this page out.
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  async function onTwoFactor(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== 'twoFactor') return;
    setSubmitting(true);
    setError(null);
    try {
      const value = code.trim();
      await verifyTwoFactor(step.challengeToken, useRecovery ? { recoveryCode: value } : { code: value.replace(/\s/g, '') });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.code === '2FA_CHALLENGE_EXPIRED') {
        // Too slow or too many wrong codes: start over.
        setStep({ kind: 'credentials' });
        setPassword('');
      }
      setError(errorMessage(err));
    }
  }

  function backToCredentials() {
    setStep({ kind: 'credentials' });
    setPassword('');
    setError(null);
  }

  return (
    <div className="login-wrap">
      {step.kind === 'credentials' ? (
        <form className="card login-card" onSubmit={onCredentials}>
          <h1>Card Trader Admin</h1>
          <p className="muted">Sign in with an admin account.</p>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="muted small">API: {API_URL}</p>
        </form>
      ) : (
        <form className="card login-card" onSubmit={onTwoFactor}>
          <h1>Two-factor authentication</h1>
          <p className="muted">
            {useRecovery
              ? 'Enter one of the recovery codes you saved when you set up two-factor authentication.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <label className="form-field">
            <span>{useRecovery ? 'Recovery code' : 'Authentication code'}</span>
            {useRecovery ? (
              <input
                key="recovery"
                type="text"
                autoComplete="off"
                required
                placeholder="xxxx-xxxx-xxxx"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            ) : (
              <input
                key="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            )}
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <div className="login-links">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setUseRecovery((r) => !r);
                setCode('');
                setError(null);
              }}
            >
              {useRecovery ? 'Use an authenticator code' : 'Use a recovery code'}
            </button>
            <button type="button" className="link-button" onClick={backToCredentials}>
              Back to sign in
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
