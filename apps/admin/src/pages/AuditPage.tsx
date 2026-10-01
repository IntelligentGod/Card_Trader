import type { AdminAuditEntry, AdminTargetType, Paginated } from '@card-trader/shared';
import { qs, request } from '../api';
import { Empty, ErrorState, LoadMore, Spinner } from '../components';
import { AUDIT_ACTIONS, AuditActor, AuditChanges, AuditTarget, auditActionLabel } from '../forms';
import { dateTime } from '../format';
import { usePaginated } from '../hooks';
import { href, navigate, paths, useLocation } from '../router';

const PAGE_SIZE = 50;
const TARGET_TYPES: { value: AdminTargetType; label: string }[] = [
  { value: 'USER', label: 'Users' },
  { value: 'CARD', label: 'Cards' },
  { value: 'SYSTEM', label: 'System' },
];

export function AuditPage() {
  const { query } = useLocation();
  const action = query.get('action') ?? '';
  const targetType = query.get('targetType') ?? '';
  const setFilters = (next: { action?: string; targetType?: string }) =>
    navigate(href(paths.audit(), { action, targetType, ...next }), true);

  const list = usePaginated(
    (cursor, signal) =>
      request<Paginated<AdminAuditEntry>>(`/admin/audit${qs({ action, targetType, cursor, limit: PAGE_SIZE })}`, {
        signal,
      }),
    [action, targetType],
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Audit log</h1>
      </div>
      <div className="toolbar">
        <select className="input" value={action} onChange={(e) => setFilters({ action: e.target.value })}>
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {auditActionLabel(a)}
            </option>
          ))}
        </select>
        <select className="input" value={targetType} onChange={(e) => setFilters({ targetType: e.target.value })}>
          <option value="">All targets</option>
          {TARGET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {list.loading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <Empty>No audit entries match these filters.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>IP</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((e) => (
                  <tr key={e.id}>
                    <td className="small nowrap">{dateTime(e.createdAt)}</td>
                    <td>{auditActionLabel(e.action)}</td>
                    <td className="small">
                      <AuditActor admin={e.admin} />
                    </td>
                    <td>
                      <AuditTarget entry={e} />
                    </td>
                    <td className="small">{e.reason ?? <span className="muted">—</span>}</td>
                    <td className="small nowrap">{e.ipAddress ?? <span className="muted">—</span>}</td>
                    <td>
                      {Object.keys(e.changes).length > 0 ? (
                        <AuditChanges changes={e.changes} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
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
