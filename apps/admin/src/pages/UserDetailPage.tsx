import {
  LISTING_STATUS_LABELS,
  VENDOR_APPLICATION_LABELS,
  type AdminAuditEntry,
  type AdminReview,
  type AdminTradeListItem,
  type AdminUserDetail,
  type AdminUserReviews,
  type CollectionItemResponse,
  type Paginated,
  type SocialLinks,
  type PaidVia,
} from '@card-trader/shared';
import { useState } from 'react';
import { qs, request } from '../api';
import { AuditList } from '../forms';
import {
  AsyncView,
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Field,
  LoadMore,
  Spinner,
  Stars,
  Stat,
  StatusBadge,
  Thumb,
  UserLink,
  conditionText,
} from '../components';
import { dateTime, humanize, money, num } from '../format';
import { useAsync, usePaginated } from '../hooks';
import { href, navigate, paths, useLocation } from '../router';
import { TradeTable } from '../TradeTable';
import { UserActions } from './UserActions';
import { UserEditPanel } from './UserEdit';

/** Where an account's one-time unlock came from. */
const PAID_VIA_LABELS: Record<PaidVia, string> = {
  APP_STORE: 'App Store purchase',
  PLAY_STORE: 'Google Play purchase',
  ADMIN: 'Granted by an admin',
  SEED: 'Demo account',
};

const PAGE_SIZE = 50;
const TABS = ['collection', 'trades', 'reviews', 'events', 'history'] as const;
type Tab = (typeof TABS)[number];

function socialHref(key: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, '');
  switch (key) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'x':
      return `https://x.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    case 'youtube':
      return `https://youtube.com/@${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    default:
      return `https://${value}`;
  }
}

function SocialList({ links }: { links: SocialLinks }) {
  const entries = Object.entries(links).filter((e): e is [string, string] => !!e[1]);
  if (entries.length === 0) return <span className="muted">—</span>;
  return (
    <span className="inline-list">
      {entries.map(([k, v]) => (
        <a key={k} href={socialHref(k, v)} target="_blank" rel="noreferrer noopener">
          {humanize(k)}: {v}
        </a>
      ))}
    </span>
  );
}

export function UserDetailPage({ publicId }: { publicId: string }) {
  const { query } = useLocation();
  const tabParam = query.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'collection';
  const state = useAsync(
    (signal) => request<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}`, { signal }),
    [publicId],
  );
  const [editing, setEditing] = useState(false);
  // Bumped after every save so the History tab refetches.
  const [revision, setRevision] = useState(0);

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumbs">
          <a href={href(paths.users())}>Users</a> / <span>{state.data?.displayName ?? publicId}</span>
        </div>
        {state.data?.permissions.editProfile && (
          <button type="button" className={`btn ${editing ? '' : 'btn-primary'}`} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done editing' : 'Edit'}
          </button>
        )}
      </div>
      <AsyncView state={state}>
        {(u) => (
          <>
            <UserHeader user={u} />
            <UserActions
              user={u}
              onChanged={(next) => {
                state.setData(next);
                setRevision((r) => r + 1);
              }}
            />
            {editing && u.permissions.editProfile && (
              <UserEditPanel
                user={u}
                onSaved={(next) => {
                  state.setData(next);
                  setRevision((r) => r + 1);
                }}
              />
            )}
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? 'active' : ''}
                  onClick={() => navigate(href(paths.user(publicId), { tab: t }), true)}
                >
                  {humanize(t)}
                  {t !== 'history' && <span className="tab-count">
                    {t === 'collection'
                      ? u.counts.collectionItems
                      : t === 'trades'
                        ? u.counts.trades
                        : t === 'reviews'
                          ? u.counts.reviewsReceived + u.counts.reviewsWritten
                          : t === 'events'
                            ? u.events.length
                            : null}
                  </span>}
                </button>
              ))}
            </div>
            {tab === 'collection' && <CollectionTab publicId={publicId} />}
            {tab === 'trades' && <TradesTab publicId={publicId} />}
            {tab === 'reviews' && <ReviewsTab publicId={publicId} />}
            {tab === 'events' && <EventsTab user={u} />}
            {tab === 'history' && <HistoryTab publicId={publicId} revision={revision} />}
          </>
        )}
      </AsyncView>
    </div>
  );
}

function UserHeader({ user: u }: { user: AdminUserDetail }) {
  return (
    <div className="card profile">
      <div className="profile-top">
        <Avatar url={u.avatarUrl} name={u.displayName} size={72} />
        <div className="profile-names">
          <h1>{u.displayName}</h1>
          <div className="muted">
            @{u.username} · {u.email}
          </div>
          <div className="inline-list">
            <StatusBadge value={u.role} />
            <StatusBadge value={u.status} />
            {u.vendor && <Badge tone={u.vendor.isActive ? 'green' : 'neutral'}>Vendor {u.vendor.isActive ? 'on' : 'off'}</Badge>}
          </div>
          {u.bio && <p className="bio">{u.bio}</p>}
        </div>
      </div>

      <div className="stats">
        <Stat label="Collection value" value={money(u.collectionValueCents)} />
        <Stat label="Collection items" value={num(u.counts.collectionItems)} hint={`${num(u.counts.cards)} cards`} />
        <Stat label="Trades" value={num(u.counts.trades)} hint={`${num(u.counts.activeTrades)} active`} />
        <Stat label="Completed trades" value={num(u.stats.completedTradeCount)} />
        <Stat
          label="Rating"
          value={u.stats.ratingAverage === null ? '—' : u.stats.ratingAverage.toFixed(2)}
          hint={`${num(u.stats.ratingCount)} ratings`}
        />
        <Stat label="Reviews" value={num(u.counts.reviewsReceived)} hint={`${num(u.counts.reviewsWritten)} written`} />
      </div>

      <dl className="fields">
        <Field label="Public ID">
          <code>{u.publicId}</code>
        </Field>
        <Field label="Location">{u.location ?? <span className="muted">—</span>}</Field>
        <Field label="Profile updated">{dateTime(u.updatedAt)}</Field>
        <Field label="Social">
          <SocialList links={u.socialLinks} />
        </Field>
      </dl>

      <AccountInfo user={u} />

      {u.vendor && (
        <div className="vendor-box">
          <div className="vendor-head">
            {u.vendor.logoUrl && <Avatar url={u.vendor.logoUrl} name={u.vendor.businessName} size={40} />}
            <div>
              <strong>{u.vendor.businessName}</strong>{' '}
              <Badge tone={u.vendor.isActive ? 'green' : 'neutral'}>{u.vendor.isActive ? 'Active' : 'Inactive'}</Badge>
              {u.vendor.website && (
                <div>
                  <a href={socialHref('website', u.vendor.website)} target="_blank" rel="noreferrer noopener">
                    {u.vendor.website}
                  </a>
                </div>
              )}
            </div>
          </div>
          {u.vendor.description && <p>{u.vendor.description}</p>}
          <SocialList links={u.vendor.socialLinks} />
        </div>
      )}
    </div>
  );
}

function CollectionTab({ publicId }: { publicId: string }) {
  const list = usePaginated(
    (cursor, signal) =>
      request<Paginated<CollectionItemResponse>>(
        `/admin/users/${encodeURIComponent(publicId)}/collection${qs({ cursor, limit: PAGE_SIZE })}`,
        { signal },
      ),
    [publicId],
  );
  if (list.loading) return <Spinner />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0) return <Empty>This user has no cards in their collection.</Empty>;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Card</th>
              <th>Set</th>
              <th>#</th>
              <th>Condition</th>
              <th>Listing</th>
              <th className="num">Qty</th>
              <th className="num">Est. value (each)</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((it) => (
              <tr key={it.id}>
                <td>
                  <Thumb url={it.imageUrl} />
                </td>
                <td>
                  {it.card.name}
                  {it.card.variant && <div className="muted small">{it.card.variant}</div>}
                  {it.lockedInTrade && <Badge tone="amber">In trade</Badge>}
                </td>
                <td>{it.card.set.name}</td>
                <td>{it.card.cardNumber}</td>
                <td>
                  {conditionText(it.condition, it.gradingCompany, it.grade)}
                  {it.certNumber && <div className="muted small">Cert {it.certNumber}</div>}
                </td>
                <td>
                  <Badge tone={it.listingStatus === 'PERSONAL' ? 'neutral' : 'blue'}>
                    {LISTING_STATUS_LABELS[it.listingStatus] ?? it.listingStatus}
                  </Badge>
                  {it.askingPriceCents !== null && <div className="muted small">Asking {money(it.askingPriceCents)}</div>}
                </td>
                <td className="num">{it.quantity}</td>
                <td className="num">{money(it.estimatedValueCents)}</td>
                <td className="num">{money(it.totalValueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMore hasMore={list.nextCursor !== null} loading={list.loadingMore} error={list.loadMoreError} onClick={list.loadMore} />
    </>
  );
}

function TradesTab({ publicId }: { publicId: string }) {
  const list = usePaginated(
    (cursor, signal) =>
      request<Paginated<AdminTradeListItem>>(
        `/admin/users/${encodeURIComponent(publicId)}/trades${qs({ cursor, limit: PAGE_SIZE })}`,
        { signal },
      ),
    [publicId],
  );
  if (list.loading) return <Spinner />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0) return <Empty>This user has no trades.</Empty>;
  return (
    <>
      <TradeTable trades={list.items} />
      <LoadMore hasMore={list.nextCursor !== null} loading={list.loadingMore} error={list.loadMoreError} onClick={list.loadMore} />
    </>
  );
}

function ReviewList({ reviews, mode }: { reviews: AdminReview[]; mode: 'received' | 'written' }) {
  if (reviews.length === 0) return <Empty>No reviews {mode}.</Empty>;
  return (
    <ul className="review-list">
      {reviews.map((r) => (
        <li key={r.id} className="review">
          <div className="review-head">
            <Stars rating={r.rating} />
            <span className="muted small">
              {mode === 'received' ? 'from' : 'about'}
            </span>
            <UserLink user={mode === 'received' ? r.reviewer : r.subject} />
            {r.verifiedTrade && <Badge tone="green">Verified trade</Badge>}
          </div>
          {r.comment ? <p>{r.comment}</p> : <p className="muted">No comment.</p>}
          <div className="muted small">
            {dateTime(r.createdAt)} · <a href={href(paths.trade(r.tradeId))}>View trade</a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReviewsTab({ publicId }: { publicId: string }) {
  const state = useAsync(
    (signal) => request<AdminUserReviews>(`/admin/users/${encodeURIComponent(publicId)}/reviews`, { signal }),
    [publicId],
  );
  return (
    <AsyncView state={state}>
      {(r) => (
        <div className="two-col">
          <section>
            <h2>Received ({r.received.length})</h2>
            <ReviewList reviews={r.received} mode="received" />
          </section>
          <section>
            <h2>Written ({r.written.length})</h2>
            <ReviewList reviews={r.written} mode="written" />
          </section>
        </div>
      )}
    </AsyncView>
  );
}

function EventsTab({ user }: { user: AdminUserDetail }) {
  if (user.events.length === 0) return <Empty>This user has no event activity.</Empty>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Relation</th>
            <th>Status</th>
            <th>Starts</th>
            <th>Vendor status</th>
            <th>Table</th>
          </tr>
        </thead>
        <tbody>
          {user.events.map((e) => (
            <tr key={`${e.id}-${e.relation}`}>
              <td>{e.title}</td>
              <td>{humanize(e.relation)}</td>
              <td>
                <StatusBadge value={e.status} label={humanize(e.status)} />
              </td>
              <td>{dateTime(e.startsAt)}</td>
              <td>
                {e.vendorStatus ? (
                  <StatusBadge value={e.vendorStatus} label={VENDOR_APPLICATION_LABELS[e.vendorStatus]} />
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>{e.tableNumber ?? <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function HistoryTab({ publicId, revision }: { publicId: string; revision: number }) {
  const state = useAsync(
    (signal) => request<AdminAuditEntry[]>(`/admin/users/${encodeURIComponent(publicId)}/history`, { signal }),
    [publicId, revision],
  );
  return <AsyncView state={state}>{(entries) => <AuditList entries={entries} />}</AsyncView>;
}

const PROVIDER_LABELS: Record<string, string> = { PASSWORD: 'Email & password', GOOGLE: 'Google', APPLE: 'Apple' };

function YesNo({ value, yes, no, warnWhenNo }: { value: boolean; yes: string; no: string; warnWhenNo?: boolean }) {
  return <Badge tone={value ? 'green' : warnWhenNo ? 'amber' : 'neutral'}>{value ? yes : no}</Badge>;
}

function AccountInfo({ user: u }: { user: AdminUserDetail }) {
  const methods = u.authProviders.length > 0 ? u.authProviders : u.hasPassword ? ['PASSWORD'] : [];
  return (
    <div className="account-box">
      <h2>Account</h2>
      <dl className="fields">
        <Field label="Full access">
          {u.hasFullAccess ? (
            <>
              {u.paidVia ? PAID_VIA_LABELS[u.paidVia] : 'Included with role'}
              {u.paidAt && <span className="muted"> · {dateTime(u.paidAt)}</span>}
            </>
          ) : (
            <Badge tone="amber">Not unlocked</Badge>
          )}
        </Field>
        <Field label="Two-factor authentication">
          <YesNo value={u.twoFactorEnabled} yes="Enabled" no="Off" />
        </Field>
        <Field label="Sign-in methods">
          {methods.length > 0 ? (
            methods.map((m) => PROVIDER_LABELS[m] ?? humanize(m)).join(', ')
          ) : (
            <span className="muted">—</span>
          )}
        </Field>
        <Field label="Password">
          {!u.hasPassword ? (
            <span className="muted">No password (social sign-in only)</span>
          ) : u.mustChangePassword ? (
            <Badge tone="amber">Must change at next sign-in</Badge>
          ) : (
            'Set'
          )}
        </Field>
        <Field label="Created">{dateTime(u.createdAt)}</Field>
        <Field label="Last login">{dateTime(u.lastLoginAt)}</Field>
        <Field label="Last active">{dateTime(u.lastActiveAt)}</Field>
        {(u.status === 'BLOCKED' || u.blockedAt) && (
          <>
            <Field label="Blocked since">{dateTime(u.blockedAt)}</Field>
            <Field label="Block reason">{u.blockReason ?? <span className="muted">No reason given</span>}</Field>
          </>
        )}
      </dl>
    </div>
  );
}
