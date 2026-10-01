import { TRADE_STATUSES, TRADE_STATUS_LABELS, type AdminOverview } from '@card-trader/shared';
import { request } from '../api';
import { AsyncView, Stat } from '../components';
import { money, num } from '../format';
import { useAsync } from '../hooks';
import { href, paths } from '../router';

export function OverviewPage() {
  const state = useAsync((signal) => request<AdminOverview>('/admin/overview', { signal }), []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Overview</h1>
        <button type="button" className="btn" onClick={state.reload} disabled={state.loading}>
          Refresh
        </button>
      </div>
      <AsyncView state={state}>
        {(o) => (
          <>
            <section>
              <h2>
                <a href={href(paths.users())}>Users</a>
              </h2>
              <div className="stats">
                <Stat label="Total" value={num(o.users.total)} />
                <Stat label="Active" value={num(o.users.active)} />
                <Stat label="Blocked" value={num(o.users.blocked)} />
                <Stat label="Admins" value={num(o.users.admins)} />
                <Stat label="Vendors" value={num(o.users.vendors)} />
                <Stat label="New (last 7 days)" value={num(o.users.newLast7Days)} />
              </div>
            </section>
            <section>
              <h2>Collections</h2>
              <div className="stats">
                <Stat label="Collection items" value={num(o.collection.items)} />
                <Stat label="Cards (sum of quantities)" value={num(o.collection.cards)} />
                <Stat label="Total estimated value" value={money(o.collection.totalValueCents)} />
              </div>
            </section>
            <section>
              <h2>
                <a href={href(paths.trades())}>Trades</a>
              </h2>
              <div className="stats">
                <Stat label="Total" value={num(o.trades.total)} />
                {TRADE_STATUSES.map((s) => (
                  <a key={s} className="stat-link" href={href(paths.trades(), { status: s })}>
                    <Stat label={TRADE_STATUS_LABELS[s]} value={num(o.trades.byStatus[s] ?? 0)} />
                  </a>
                ))}
              </div>
            </section>
            <section>
              <h2>Events</h2>
              <div className="stats">
                <Stat label="Total" value={num(o.events.total)} />
                <Stat label="Published" value={num(o.events.published)} />
                <Stat label="Upcoming" value={num(o.events.upcoming)} />
              </div>
            </section>
            <section>
              <h2>Reviews</h2>
              <div className="stats">
                <Stat label="Total" value={num(o.reviews.total)} />
                <Stat
                  label="Average rating"
                  value={o.reviews.averageRating === null ? '—' : `${o.reviews.averageRating.toFixed(2)} / 5`}
                />
              </div>
            </section>
          </>
        )}
      </AsyncView>
    </div>
  );
}
