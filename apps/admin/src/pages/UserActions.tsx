import { useState } from 'react';
import type {
  AdminBlockRequest,
  AdminChangeRoleRequest,
  AdminResetPasswordRequest,
  AdminUserDetail,
} from '@card-trader/shared';
import { request } from '../api';
import { Checkbox, ConfirmDialog, TextField, nullable } from '../forms';
import { PASSWORD_MAX, PASSWORD_MIN } from './ChangePasswordPage';

type Dialog = 'role' | 'reset' | 'block' | 'unblock' | null;

function userUrl(publicId: string): string {
  return `/admin/users/${encodeURIComponent(publicId)}`;
}

/**
 * Role / password / block actions. Every button is gated by `detail.permissions`
 * (the API enforces the same rules). `onChanged` receives a fresh detail.
 */
export function UserActions({ user, onChanged }: { user: AdminUserDetail; onChanged: (u: AdminUserDetail) => void }) {
  const { permissions: can } = user;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [requireChange, setRequireChange] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isBlocked = user.status === 'BLOCKED';
  const canChangeRole = can.changeRole && (user.role === 'USER' || user.role === 'ADMIN');
  const nextRole: AdminChangeRoleRequest['role'] = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
  const anyAction = canChangeRole || can.resetPassword || can.block;

  function open(d: Dialog) {
    setReason('');
    setPassword('');
    setConfirm('');
    setRequireChange(true);
    setError(null);
    setNotice(null);
    setDialog(d);
  }

  function close() {
    // Never keep a typed password around after the dialog closes.
    setPassword('');
    setConfirm('');
    setDialog(null);
  }

  async function run(path: string, method: 'POST' | 'PATCH', body: unknown, done: string) {
    setBusy(true);
    setError(null);
    try {
      await request<unknown>(`${userUrl(user.publicId)}${path}`, { method, body });
      // Re-read so every field (status, role, blockedAt, permissions…) is current.
      const fresh = await request<AdminUserDetail>(userUrl(user.publicId));
      close();
      setNotice(done);
      onChanged(fresh);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const pwTooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const pwMismatch = confirm.length > 0 && confirm !== password;
  const pwValid = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX && password === confirm;

  const reasonField = (required: boolean) => (
    <TextField
      label={required ? 'Reason (required)' : 'Reason (optional, saved in the history)'}
      value={reason}
      onChange={setReason}
      maxLength={500}
      multiline
    />
  );

  return (
    <section className="card form">
      <h2>Account actions</h2>
      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {anyAction ? (
        <div className="inline-list">
          {canChangeRole && (
            <button type="button" className="btn" onClick={() => open('role')}>
              {nextRole === 'ADMIN' ? 'Make admin…' : 'Remove admin role…'}
            </button>
          )}
          {can.resetPassword && (
            <button type="button" className="btn" onClick={() => open('reset')}>
              Reset password…
            </button>
          )}
          {can.block &&
            (isBlocked ? (
              <button type="button" className="btn btn-primary" onClick={() => open('unblock')}>
                Unblock user…
              </button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={() => open('block')}>
                Block user…
              </button>
            ))}
        </div>
      ) : (
        <p className="muted">
          You can't change this account. Admins manage user accounts; only a super admin can manage admins, and nobody
          can change their own role or status.
        </p>
      )}

      {dialog === 'role' && (
        <ConfirmDialog
          title={nextRole === 'ADMIN' ? `Make ${user.displayName} an admin?` : `Remove admin role from ${user.displayName}?`}
          confirmLabel={nextRole === 'ADMIN' ? 'Make admin' : 'Remove admin role'}
          danger={nextRole === 'USER'}
          busy={busy}
          error={error}
          onConfirm={() =>
            void run(
              '/role',
              'PATCH',
              { role: nextRole, reason: nullable(reason) } satisfies AdminChangeRoleRequest,
              nextRole === 'ADMIN' ? 'Role changed to Admin.' : 'Role changed to User.',
            )
          }
          onCancel={close}
        >
          <p>
            {nextRole === 'ADMIN'
              ? `@${user.username} will be able to sign in to this console and manage user accounts.`
              : `@${user.username} will lose access to this console.`}
          </p>
          {reasonField(false)}
        </ConfirmDialog>
      )}

      {dialog === 'reset' && (
        <ConfirmDialog
          title={`Reset password for ${user.displayName}`}
          confirmLabel="Reset password"
          danger
          busy={busy}
          error={error}
          confirmDisabled={!pwValid}
          onConfirm={() =>
            void run(
              '/reset-password',
              'POST',
              { newPassword: password, requireChange, reason: nullable(reason) } satisfies AdminResetPasswordRequest,
              requireChange
                ? 'Password reset. The user was signed out everywhere and must choose a new password at next sign-in.'
                : 'Password reset. The user was signed out everywhere.',
            )
          }
          onCancel={close}
        >
          <p>
            @{user.username} is signed out on every device immediately. Share the new password with them through a
            safe channel — it is not shown again.
          </p>
          <label className="form-field">
            <span>
              New password ({PASSWORD_MIN}–{PASSWORD_MAX} characters)
            </span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {pwTooShort && <small className="text-error">At least {PASSWORD_MIN} characters.</small>}
          </label>
          <label className="form-field">
            <span>Confirm new password</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {pwMismatch && <small className="text-error">Passwords don't match.</small>}
          </label>
          <Checkbox
            label="Require a new password at next sign-in"
            checked={requireChange}
            onChange={setRequireChange}
          />
          {reasonField(false)}
        </ConfirmDialog>
      )}

      {dialog === 'block' && (
        <ConfirmDialog
          title="Block user"
          confirmLabel="Block user"
          danger
          busy={busy}
          error={error}
          onConfirm={() =>
            void run('/block', 'POST', { reason: nullable(reason) } satisfies AdminBlockRequest, 'User blocked.')
          }
          onCancel={close}
        >
          <p>
            <strong>Are you sure you want to block this user?</strong>
          </p>
          <p>
            @{user.username} is signed out on every device immediately and can't sign in or use the app until
            unblocked.
          </p>
          {reasonField(false)}
        </ConfirmDialog>
      )}

      {dialog === 'unblock' && (
        <ConfirmDialog
          title="Unblock user"
          confirmLabel="Unblock user"
          busy={busy}
          error={error}
          onConfirm={() =>
            void run('/unblock', 'POST', { reason: nullable(reason) } satisfies AdminBlockRequest, 'User unblocked.')
          }
          onCancel={close}
        >
          <p>@{user.username} will be able to sign in and use the app again.</p>
          {reasonField(false)}
        </ConfirmDialog>
      )}
    </section>
  );
}
