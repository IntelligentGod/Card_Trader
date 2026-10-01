import { useEffect, useState } from 'react';
import {
  CARD_CATEGORIES,
  CATEGORY_LABELS,
  CatalogSource,
  type AdminCardListItem,
  type Paginated,
} from '@card-trader/shared';
import { qs, request } from '../api';
import { Badge, Empty, ErrorState, LoadMore, Spinner, Thumb, UserLink } from '../components';
import { humanize, money, num } from '../format';
import { useDebounced, usePaginated } from '../hooks';
import { href, navigate, paths, useLocation } from '../router';

const PAGE_SIZE = 50;

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return <Badge tone={verified ? 'green' : 'amber'}>{verified ? 'Verified' : 'Unverified'}</Badge>;
}

export function CardsPage() {
  const { query } = useLocation();
  const q = query.get('q') ?? '';
  const category = query.get('category') ?? '';
  const source = query.get('source') ?? '';
  const verified = query.get('verified') ?? '';

  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebounced(search, 300);

  const setFilters = (next: { q?: string; category?: string; source?: string; verified?: string }) =>
    navigate(href(paths.cards(), { q, category, source, verified, ...next }), true);

  useEffect(() => {
    if (debouncedSearch.trim() !== q) setFilters({ q: debouncedSearch.trim() });
  }, [debouncedSearch]);

  useEffect(() => {
    setSearch((s) => (s.trim() === q ? s : q));
  }, [q]);

  const list = usePaginated(
    (cursor, signal) =>
      request<Paginated<AdminCardListItem>>(
        `/admin/cards${qs({ q, category, source, verified, cursor, limit: PAGE_SIZE })}`,
        { signal },
      ),
    [q, category, source, verified],
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Catalog</h1>
      </div>
      <div className="toolbar">
        <input
          type="search"
          className="input search"
          placeholder="Search name, number, subject or set…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={category} onChange={(e) => setFilters({ category: e.target.value })}>
          <option value="">All categories</option>
          {CARD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className="input" value={source} onChange={(e) => setFilters({ source: e.target.value })}>
          <option value="">All sources</option>
          {Object.values(CatalogSource).map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        <select className="input" value={verified} onChange={(e) => setFilters({ verified: e.target.value })}>
          <option value="">All</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </div>

      {list.loading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <Empty>No cards match these filters.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>#</th>
                  <th>Variant</th>
                  <th>Set</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Verified</th>
                  <th>Submitted by</th>
                  <th className="num">In collections</th>
                  <th className="num">Top value</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(href(paths.card(c.id)))}>
                    <td>
                      <Thumb url={c.imageUrl} size={32} />
                    </td>
                    <td>
                      <a href={href(paths.card(c.id))} onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </a>
                      {c.subject && <div className="muted small">{c.subject}</div>}
                    </td>
                    <td>{c.cardNumber}</td>
                    <td>{c.variant || <span className="muted">—</span>}</td>
                    <td>
                      {c.set.name}
                      {c.set.year !== null && <span className="muted"> ({c.set.year})</span>}
                    </td>
                    <td>{CATEGORY_LABELS[c.category] ?? c.category}</td>
                    <td>{humanize(c.source)}</td>
                    <td>
                      <VerifiedBadge verified={c.isVerified} />
                    </td>
                    <td>{c.submittedBy ? <UserLink user={c.submittedBy} /> : <span className="muted">—</span>}</td>
                    <td className="num">{num(c.collectionItemCount)}</td>
                    <td className="num">{money(c.topValueCents)}</td>
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
