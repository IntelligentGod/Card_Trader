import { TRADE_STATUS_LABELS, type AdminTradeDetail, type TradeParticipantResponse } from '@card-trader/shared';
import { request } from '../api';
import { AsyncView, Avatar, Badge, Empty, Field, Stars, StatusBadge, Thumb, UserLink, conditionText } from '../components';
import { dateTime, humanize, money } from '../format';
import { useAsync } from '../hooks';
import { href, paths } from '../router';
import { cashText } from '../TradeTable';

function Participant({ title, p }: { title: string; p: TradeParticipantResponse }) {
  return (
    <section className="card participant">
      <div className="participant-head">
        <Avatar url={p.user.avatarUrl} name={p.user.displayName} size={44} />
        <div>
          <div className="muted small">{title}</div>
          <a href={href(paths.user(p.user.publicId))}>
            <strong>{p.user.displayName}</strong>
          </a>{' '}
          <span className="muted">@{p.user.username}</span>
          {p.user.vendorName && <div className="muted small">{p.user.vendorName}</div>}
        </div>
      </div>
      <div className="inline-list">
        <Badge tone={p.hasAcceptedCurrentVersion ? 'green' : 'neutral'}>
          {p.hasAcceptedCurrentVersion ? 'Accepted current version' : 'Not accepted'}
        </Badge>
        <Badge tone={p.completionConfirmed ? 'green' : 'neutral'}>
          {p.completionConfirmed ? 'Confirmed completion' : 'Completion not confirmed'}
        </Badge>
      </div>
      {p.items.length === 0 ? (
        <Empty>No items.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th />
                <th>Card</th>
                <th>Condition</th>
                <th className="num">Qty</th>
                <th className="num">Unit</th>
                <th className="num">Line</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <Thumb url={it.imageUrl} size={32} />
                  </td>
                  <td>
                    {it.cardName}
                    <div className="muted small">
                      {it.setName} · #{it.cardNumber}
                      {it.variant ? ` · ${it.variant}` : ''}
                    </div>
                  </td>
                  <td>
                    {conditionText(it.condition, it.gradingCompany, it.grade)}
                    {it.valueConfidence !== 'HIGH' && (
                      <div className="muted small">{humanize(it.valueConfidence)} confidence</div>
                    )}
                  </td>
                  <td className="num">{it.quantity}</td>
                  <td className="num">{money(it.unitValueCents)}</td>
                  <td className="num">{money(it.lineTotalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="total-row">
        <span>Items total</span>
        <strong>{money(p.itemsTotalCents)}</strong>
      </div>
    </section>
  );
}

export function TradeDetailPage({ id }: { id: string }) {
  const state = useAsync(
    (signal) => request<AdminTradeDetail>(`/admin/trades/${encodeURIComponent(id)}`, { signal }),
    [id],
  );

  return (
    <div className="page">
      <div className="breadcrumbs">
        <a href={href(paths.trades())}>Trades</a> / <code>{id}</code>
      </div>
      <AsyncView state={state}>
        {(t) => {
          const iName = t.initiator.user.displayName;
          const cName = t.counterparty.user.displayName;
          const roleName = (role: string | null) =>
            role === 'INITIATOR' ? iName : role === 'COUNTERPARTY' ? cName : '—';
          return (
            <>
              <div className="page-header">
                <h1>
                  Trade <StatusBadge value={t.status} label={TRADE_STATUS_LABELS[t.status]} />
                  {t.isCounterOffer && (
                    <>
                      {' '}
                      <Badge tone="blue">Counteroffer</Badge>
                    </>
                  )}
                </h1>
                <span className="muted">Version {t.version}</span>
              </div>
              {t.event && <p className="muted">Started at event: {t.event.title}</p>}

              <div className="two-col">
                <Participant title="Initiator" p={t.initiator} />
                <Participant title="Counterparty" p={t.counterparty} />
              </div>

              <div className="two-col">
                <section className="card">
                  <h2>Calculation</h2>
                  <dl className="fields">
                    <Field label={`${iName} items`}>{money(t.calculation.initiatorTotalCents)}</Field>
                    <Field label={`${cName} items`}>{money(t.calculation.counterpartyTotalCents)}</Field>
                    <Field label="Difference (initiator − counterparty)">{money(t.calculation.differenceCents)}</Field>
                    <Field label="Suggested cash">
                      {t.calculation.suggestedCashPayer && t.calculation.suggestedCashCents > 0
                        ? `${roleName(t.calculation.suggestedCashPayer)} pays ${money(t.calculation.suggestedCashCents)}`
                        : 'None'}
                    </Field>
                    {t.calculation.hasUnpricedItems && (
                      <Field label="Warning">
                        <Badge tone="amber">Some items have no market value</Badge>
                      </Field>
                    )}
                  </dl>
                </section>
                <section className="card">
                  <h2>Cash &amp; final value</h2>
                  <dl className="fields">
                    <Field label="Cash">
                      {cashText(t.cash, iName, cName)}
                      {t.cash.isManual && (
                        <>
                          {' '}
                          <Badge>Manual</Badge>
                        </>
                      )}
                    </Field>
                    <Field label={`${iName} gives`}>{money(t.finalValue.initiatorGivesCents)}</Field>
                    <Field label={`${cName} gives`}>{money(t.finalValue.counterpartyGivesCents)}</Field>
                  </dl>
                </section>
              </div>

              <section className="card">
                <h2>Timeline</h2>
                <dl className="fields">
                  <Field label="Created">{dateTime(t.createdAt)}</Field>
                  <Field label="Proposed">{dateTime(t.proposedAt)}</Field>
                  <Field label="Proposed by">{roleName(t.proposedByRole)}</Field>
                  <Field label="Accepted">{dateTime(t.acceptedAt)}</Field>
                  <Field label="Completed">{dateTime(t.completedAt)}</Field>
                  <Field label="Cancelled">{dateTime(t.cancelledAt)}</Field>
                  <Field label="Declined">{dateTime(t.declinedAt)}</Field>
                  <Field label="Last updated">{dateTime(t.updatedAt)}</Field>
                  <Field label="Offers sent">{t.proposalCount}</Field>
                  <Field label="Counteroffer">{t.isCounterOffer ? 'Yes' : 'No'}</Field>
                </dl>
              </section>

              <section className="card">
                <h2>Reviews ({t.reviews.length})</h2>
                {t.reviews.length === 0 ? (
                  <Empty>No reviews for this trade.</Empty>
                ) : (
                  <ul className="review-list">
                    {t.reviews.map((r) => (
                      <li key={r.id} className="review">
                        <div className="review-head">
                          <Stars rating={r.rating} />
                          <span className="muted small">by</span>
                          <UserLink user={r.reviewer} />
                          {r.verifiedTrade && <Badge tone="green">Verified trade</Badge>}
                        </div>
                        {r.comment ? <p>{r.comment}</p> : <p className="muted">No comment.</p>}
                        <div className="muted small">{dateTime(r.createdAt)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="disclaimer">{t.disclaimer}</p>
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
