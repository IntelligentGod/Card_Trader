import {
  TRADE_STATUSES,
  TRADE_STATUS_LABELS,
  type AdminTradeListItem,
  type Paginated,
  type TradeStatus,
} from '@card-trader/shared';
import { qs, request } from '../api';
import { Empty, ErrorState, LoadMore, Spinner } from '../components';
import { usePaginated } from '../hooks';
import { href, navigate, paths, useLocation } from '../router';
import { TradeTable } from '../TradeTable';

const PAGE_SIZE = 50;

const statusLabel = (s: string): string => TRADE_STATUS_LABELS[s as TradeStatus] ?? s;

export function TradesPage() {
  const { query } = useLocation();
  const status = query.get('status') ?? '';

  const list = usePaginated(
    (cursor, signal) =>
      request<Paginated<AdminTradeListItem>>(`/admin/trades${qs({ status, cursor, limit: PAGE_SIZE })}`, { signal }),
    [status],
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Trades</h1>
      </div>
      <div className="toolbar">
        <div className="segmented" role="tablist">
          {['', ...TRADE_STATUSES].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={status === s ? 'active' : ''}
              onClick={() => navigate(href(paths.trades(), { status: s }), true)}
            >
              {s ? statusLabel(s) : 'All'}
            </button>
          ))}
        </div>
      </div>
      {list.loading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <Empty>No trades{status ? ` with status ${statusLabel(status)}` : ''}.</Empty>
      ) : (
        <>
          <TradeTable trades={list.items} />
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
