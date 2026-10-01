import { TRADE_STATUS_LABELS, type AdminTradeListItem, type TradeCash } from '@card-trader/shared';
import { Badge, StatusBadge, UserLink } from './components';
import { dateTime, money } from './format';
import { href, navigate, paths } from './router';

export function cashText(cash: TradeCash, initiatorName: string, counterpartyName: string): string {
  if (!cash.payer || cash.amountCents <= 0) return 'No cash';
  const [from, to] = cash.payer === 'INITIATOR' ? [initiatorName, counterpartyName] : [counterpartyName, initiatorName];
  return `${from} pays ${to} ${money(cash.amountCents)}`;
}

export function TradeTable({ trades }: { trades: AdminTradeListItem[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Initiator</th>
            <th className="num">Gives</th>
            <th>Counterparty</th>
            <th className="num">Gives</th>
            <th>Cash</th>
            <th className="num">Items</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="clickable" onClick={() => navigate(href(paths.trade(t.id)))}>
              <td>
                <StatusBadge value={t.status} label={TRADE_STATUS_LABELS[t.status]} />
                {t.isCounterOffer && (
                  <>
                    {' '}
                    <Badge tone="blue">Counter</Badge>
                  </>
                )}
              </td>
              <td>
                <UserLink user={t.initiator} />
              </td>
              <td className="num">{money(t.initiatorItemsTotalCents)}</td>
              <td>
                <UserLink user={t.counterparty} />
              </td>
              <td className="num">{money(t.counterpartyItemsTotalCents)}</td>
              <td className="small">{cashText(t.cash, t.initiator.displayName, t.counterparty.displayName)}</td>
              <td className="num">{t.itemCount}</td>
              <td className="small">
                {dateTime(t.updatedAt)}
                {t.event && <div className="muted">@ {t.event.title}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
