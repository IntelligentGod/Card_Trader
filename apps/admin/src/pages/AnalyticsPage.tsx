import {
  CARD_CATEGORIES,
  CATEGORY_LABELS,
  GRADING_COMPANIES,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  TRADE_STATUSES,
  TRADE_STATUS_LABELS,
  UserStatus,
  type AdminAnalytics,
  type AdminMonthCount,
  type CatalogSource,
} from '@card-trader/shared';
import { request } from '../api';
import {
  BarChart,
  CATEGORY_COLORS,
  ChartCard,
  DataTable,
  GRADER_COLORS,
  LISTING_COLORS,
  Meter,
  PieChart,
  PieTable,
  SOURCE_COLORS,
  TRADE_STATUS_COLORS,
  fmtPct,
  pct,
  type BarDatum,
  type PieDatum,
} from '../charts';
import { AsyncView, Empty, Stat } from '../components';
import { dateTime, humanize, money, num } from '../format';
import { useAsync } from '../hooks';
import { href, paths } from '../router';

const SOURCES: CatalogSource[] = ['SEED', 'IMPORT', 'USER_SUBMITTED'];

const compactNum = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const compactMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function toBars<T extends AdminMonthCount>(rows: T[], pick: (r: T) => number): BarDatum[] {
  return rows.map((r) => ({ key: r.month, label: monthLabel(r.month), value: pick(r) }));
}

function PieCard({
  title,
  data,
  format = num,
}: {
  title: string;
  data: PieDatum[];
  format?: (n: number) => string;
}) {
  return (
    <ChartCard title={title} table={<PieTable data={data} format={format} />}>
      <PieChart title={title} data={data} format={format} />
    </ChartCard>
  );
}

function BarCard({
  title,
  subtitle,
  data,
  format,
  tickFormat,
}: {
  title: string;
  subtitle: string;
  data: BarDatum[];
  format: (n: number) => string;
  tickFormat: (n: number) => string;
}) {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={<DataTable columns={['Month', title]} rows={data.map((d) => [d.label, format(d.value)])} />}
    >
      <BarChart title={title} data={data} format={format} tickFormat={tickFormat} />
    </ChartCard>
  );
}

export function AnalyticsPage() {
  const state = useAsync((signal) => request<AdminAnalytics>('/admin/analytics', { signal }), []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Analytics</h1>
        <div className="inline-list">
          {state.data && <span className="muted small">Generated {dateTime(state.data.generatedAt)}</span>}
          <button type="button" className="btn" onClick={state.reload} disabled={state.loading}>
            Refresh
          </button>
        </div>
      </div>
      <AsyncView state={state}>{(a) => <AnalyticsBody a={a} />}</AsyncView>
    </div>
  );
}

function AnalyticsBody({ a }: { a: AdminAnalytics }) {
  const userTotal = Object.values(UserStatus).reduce((s, k) => s + (a.users.byStatus[k] ?? 0), 0);
  const categoryRows = CARD_CATEGORIES.map(
    (c) => a.collection.byCategory.find((r) => r.category === c) ?? { category: c, items: 0, cards: 0, valueCents: 0 },
  );
  const rawGradedTotal = a.collection.rawItems + a.collection.gradedItems;

  return (
    <>
      <section>
        <h2>Users</h2>
        <div className="stats">
          {Object.values(UserStatus).map((s) => (
            <Stat
              key={s}
              label={humanize(s)}
              value={num(a.users.byStatus[s] ?? 0)}
              hint={fmtPct(pct(a.users.byStatus[s] ?? 0, userTotal))}
            />
          ))}
          <Stat label="Admins" value={num(a.users.byRole.ADMIN ?? 0)} />
          {a.users.byRole.SUPER_ADMIN !== undefined && (
            <Stat label="Super admins" value={num(a.users.byRole.SUPER_ADMIN)} />
          )}
          <Stat label="Vendors" value={num(a.users.vendors)} />
        </div>
        <div className="chart-grid chart-grid-wide">
          <BarCard
            title="Signups by month"
            subtitle="New accounts, last 12 months (UTC)"
            data={toBars(a.users.signupsByMonth, (r) => r.count)}
            format={num}
            tickFormat={compactNum}
          />
        </div>
      </section>

      <section>
        <h2>Collections</h2>
        <div className="stats">
          <Stat
            label="Raw vs graded"
            value={`${fmtPct(pct(a.collection.gradedItems, rawGradedTotal))} graded`}
            hint={
              <>
                <Meter value={a.collection.gradedItems} total={rawGradedTotal} label="Share of graded items" />
                {num(a.collection.rawItems)} raw · {num(a.collection.gradedItems)} graded
              </>
            }
          />
        </div>
        <div className="chart-grid">
          <ChartCard
            title="Collection value by category"
            table={
              <DataTable
                columns={['Category', 'Items', 'Cards', 'Value', 'Share']}
                rows={categoryRows.map((r) => {
                  const total = categoryRows.reduce((s, x) => s + x.valueCents, 0);
                  return [CATEGORY_LABELS[r.category], num(r.items), num(r.cards), money(r.valueCents), fmtPct(pct(r.valueCents, total))];
                })}
              />
            }
          >
            <PieChart
              title="Collection value by category"
              format={money}
              data={categoryRows.map((r) => ({
                key: r.category,
                label: CATEGORY_LABELS[r.category],
                value: r.valueCents,
                color: CATEGORY_COLORS[r.category],
              }))}
            />
          </ChartCard>
          <PieCard
            title="Collection items by listing status"
            data={LISTING_STATUSES.map((s) => ({
              key: s,
              label: LISTING_STATUS_LABELS[s],
              value: a.collection.byListingStatus[s] ?? 0,
              color: LISTING_COLORS[s],
            }))}
          />
          <PieCard
            title="Graded items by grader"
            data={GRADING_COMPANIES.map((g) => ({
              key: g,
              label: g === 'OTHER' ? 'Other' : g,
              value: a.collection.byGrader[g] ?? 0,
              color: GRADER_COLORS[g],
            }))}
          />
        </div>
      </section>

      <section>
        <h2>Catalog</h2>
        <div className="stats">
          <Stat label="Cards in catalog" value={num(a.catalog.total)} />
          <Stat label="Verified" value={num(a.catalog.verified)} hint={fmtPct(pct(a.catalog.verified, a.catalog.total))} />
          <Stat
            label="Unverified"
            value={num(a.catalog.unverified)}
            hint={fmtPct(pct(a.catalog.unverified, a.catalog.total))}
          />
        </div>
        <div className="chart-grid">
          <PieCard
            title="Catalog by source"
            data={SOURCES.map((s) => ({
              key: s,
              label: humanize(s),
              value: a.catalog.bySource[s] ?? 0,
              color: SOURCE_COLORS[s],
            }))}
          />
          <PieCard
            title="Catalog by category"
            data={CARD_CATEGORIES.map((c) => ({
              key: c,
              label: CATEGORY_LABELS[c],
              value: a.catalog.byCategory[c] ?? 0,
              color: CATEGORY_COLORS[c],
            }))}
          />
        </div>
      </section>

      <section>
        <h2>Trades</h2>
        <div className="stats">
          <Stat label="Average completed trade value" value={money(a.trades.averageCompletedValueCents)} />
        </div>
        <div className="chart-grid">
          <PieCard
            title="Trades by status"
            data={TRADE_STATUSES.map((s) => ({
              key: s,
              label: TRADE_STATUS_LABELS[s],
              value: a.trades.byStatus[s] ?? 0,
              color: TRADE_STATUS_COLORS[s],
            }))}
          />
        </div>
        <div className="chart-grid chart-grid-wide">
          <BarCard
            title="Completed trades by month"
            subtitle="Number of trades completed, last 12 months (UTC)"
            data={toBars(a.trades.completedByMonth, (r) => r.count)}
            format={num}
            tickFormat={compactNum}
          />
          <BarCard
            title="Completed trade value by month"
            subtitle="Both sides' card totals, last 12 months (UTC)"
            data={toBars(a.trades.completedByMonth, (r) => r.valueCents)}
            format={money}
            tickFormat={compactMoney}
          />
        </div>
      </section>

      <section>
        <h2>Top cards by total value</h2>
        {a.topCards.length === 0 ? (
          <Empty>No valued cards in any collection yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Card</th>
                  <th>Set</th>
                  <th>Category</th>
                  <th className="num">Copies</th>
                  <th className="num">Total value</th>
                </tr>
              </thead>
              <tbody>
                {a.topCards.map((c, i) => (
                  <tr key={c.cardId}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <a href={href(paths.card(c.cardId))}>{c.name}</a>
                    </td>
                    <td>{c.setName}</td>
                    <td>{CATEGORY_LABELS[c.category] ?? c.category}</td>
                    <td className="num">{num(c.copies)}</td>
                    <td className="num">{money(c.valueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
