import { useEffect, useState } from 'react';
import { UserRole, UserStatus, type AdminUserListItem, type Paginated } from '@card-trader/shared';
import { getSession, qs, request } from '../api';
import { Avatar, Badge, Empty, ErrorState, LoadMore, Spinner, StatusBadge } from '../components';
import { dateOnly, dateTime, humanize, num } from '../format';
import { useDebounced, usePaginated } from '../hooks';
import { href, navigate, paths, useLocation } from '../router';

const PAGE_SIZE = 50;

export function UsersPage() {
  const { query } = useLocation();
  const q = query.get('q') ?? '';
  const role = query.get('role') ?? '';
  const status = query.get('status') ?? '';

  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebounced(search, 300);

  // Keep the filters in the URL so "back" from a user restores them.
  const setFilters = (next: { q?: string; role?: string; status?: string }) =>
    navigate(href(paths.users(), { q, role, status, ...next }), true);

  useEffect(() => {
    if (debouncedSearch.trim() !== q) setFilters({ q: debouncedSearch.trim() });
  }, [debouncedSearch]);

  // Back/forward navigation can change ?q= underneath the input.
  useEffect(() => {
    setSearch((s) => (s.trim() === q ? s : q));
  }, [q]);

  const list = usePaginated(
    (cursor, signal) =>
      request<Paginated<AdminUserListItem>>(`/admin/users${qs({ q, role, status, cursor, limit: PAGE_SIZE })}`, {
        signal,
      }),
    [q, role, status],
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Users</h1>
      </div>
      <div className="toolbar">
        <input
          type="search"
          className="input search"
          placeholder="Search email, username or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={role} onChange={(e) => setFilters({ role: e.target.value })}>
          <option value="">All roles</option>
          {Object.values(UserRole)
            .filter((r) => r !== 'SUPER_ADMIN' || getSession()?.user.role === 'SUPER_ADMIN')
            .map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setFilters({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.values(UserStatus).map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
      </div>

      {list.loading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <Empty>No users match these filters.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Vendor</th>
                  <th className="num">Collection</th>
                  <th className="num">Trades</th>
                  <th>Last login</th>
                  <th>Joined</th>
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
                        {u.twoFactorEnabled && <Badge tone="green">2FA</Badge>}
                      </div>
                    </td>
                    <td>
                      <StatusBadge value={u.role} />
                    </td>
                    <td>
                      <StatusBadge value={u.status} />
                    </td>
                    <td>
                      {u.vendor ? (
                        <>
                          {u.vendor.businessName}
                          {!u.vendor.isActive && <span className="muted small"> (off)</span>}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num">{num(u.collectionCount)}</td>
                    <td className="num">{num(u.tradeCount)}</td>
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
