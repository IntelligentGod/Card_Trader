import { useState, type FormEvent } from 'react';
import type { AdminCreateAdminRequest, AdminUserDetail, AdminUserListItem, Paginated } from '@card-trader/shared';
import { qs, request } from '../api';
import { Avatar, Badge, Empty, ErrorState, LoadMore, Spinner, StatusBadge } from '../components';
import { Checkbox, FormError, TextField } from '../forms';
import { dateOnly, dateTime } from '../format';
import { usePaginated } from '../hooks';
import { href, navigate, paths } from '../router';
import { PASSWORD_MAX, PASSWORD_MIN } from './ChangePasswordPage';

const PAGE_SIZE = 50;

export function AdminsPage() {
  const [showForm, setShowForm] = useState(false);
  const list = usePaginated(
    (cursor, signal) =>
      request<Paginated<AdminUserListItem>>(`/admin/users${qs({ role: 'ADMIN', cursor, limit: PAGE_SIZE })}`, {
        signal,
      }),
    [],
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admins</h1>
        <button type="button" className={`btn ${showForm ? '' : 'btn-primary'}`} onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : 'Add admin'}
        </button>
      </div>
      {showForm && <AddAdminForm onCreated={list.reload} />}

      {list.loading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <Empty>There are no admins besides you.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((u) => (
                  <tr key={u.publicId} className="clickable" onClick={() => navigate(href(paths.user(u.publicId)))}>
                    <td>
                      <Avatar url={u.avatarUrl} name={u.displayName} />
                    </td>
                    <td>
                      <a href={href(paths.user(u.publicId))} onClick={(e) => e.stopPropagation()}>
                        {u.displayName}
                      </a>
                      <div className="muted small">@{u.username}</div>
                    </td>
                    <td>
                      {u.email}
                      <div className="inline-list">
                        {u.twoFactorEnabled ? <Badge tone="green">2FA</Badge> : <Badge>No 2FA</Badge>}
                      </div>
                    </td>
                    <td>
                      <StatusBadge value={u.status} />
                    </td>
                    <td className="small">{dateTime(u.lastLoginAt)}</td>
                    <td>{dateOnly(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            hasMore={list.nextCursor !== null}
            loading={list.loadingMore}
            error={list.loadMoreError}
            onClick={list.loadMore}
          />
        </>
      )}
    </div>
  );
}

function AddAdminForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<AdminUserDetail | null>(null);

  const valid =
    email.trim().length > 3 &&
    /^[a-z0-9_]{3,20}$/.test(username.trim()) &&
    displayName.trim().length >= 2 &&
    password.length >= PASSWORD_MIN &&
    password.length <= PASSWORD_MAX;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const body: AdminCreateAdminRequest = {
        email: email.trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        temporaryPassword: password,
      };
      const res = await request<AdminUserDetail>('/admin/admins', { method: 'POST', body });
      setCreated(res);
      setEmail('');
      setUsername('');
      setDisplayName('');
      setPassword('');
      setShowPassword(false);
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Add admin</h2>
      <p className="muted">
        Creates a new account with the Admin role. They must verify their email and change the temporary password at
        first sign-in. Share the temporary password through a safe channel.
      </p>
      <FormError error={error} />
      {created && (
        <div className="alert alert-success" role="status">
          Admin <a href={href(paths.user(created.publicId))}>{created.displayName}</a> (@{created.username}) created.
        </div>
      )}
      <div className="form-grid">
        <TextField label="Email" type="email" value={email} onChange={setEmail} maxLength={254} required />
        <TextField
          label="Username"
          value={username}
          onChange={(v) => setUsername(v.toLowerCase())}
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_]{3,20}"
          hint="3–20 characters: a–z, 0–9, _"
          required
        />
        <TextField label="Display name" value={displayName} onChange={setDisplayName} minLength={2} maxLength={40} required />
        <label className="form-field">
          <span>
            Temporary password ({PASSWORD_MIN}–{PASSWORD_MAX} characters)
          </span>
          <input
            className="input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      <Checkbox label="Show password" checked={showPassword} onChange={setShowPassword} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
          {busy ? 'Creating…' : 'Create admin'}
        </button>
      </div>
    </form>
  );
}
