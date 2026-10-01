import { useState, type FormEvent } from 'react';
import { CATEGORY_LABELS, type AdminCardDetail, type AdminUpdateCardRequest } from '@card-trader/shared';
import { request } from '../api';
import { AsyncView, Badge, Empty, Field, Stat, Thumb, UserLink } from '../components';
import { AuditList, ConfirmDialog, FormError, FormSuccess, TextField, nullable } from '../forms';
import { dateTime, humanize, money, num } from '../format';
import { useAsync } from '../hooks';
import { href, paths } from '../router';
import { VerifiedBadge } from './CardsPage';

function cardUrl(id: string): string {
  return `/admin/cards/${encodeURIComponent(id)}`;
}

export function CardDetailPage({ id }: { id: string }) {
  const state = useAsync((signal) => request<AdminCardDetail>(cardUrl(id), { signal }), [id]);

  return (
    <div className="page">
      <div className="breadcrumbs">
        <a href={href(paths.cards())}>Catalog</a> / <span>{state.data?.name ?? id}</span>
      </div>
      <AsyncView state={state}>
        {(c) => (
          <>
            <CardHeader card={c} />
            <VerifyControl card={c} onSaved={state.setData} />
            <MarketValues card={c} />
            <CardEditForm card={c} onSaved={state.setData} />
            <section>
              <h2>History</h2>
              <AuditList entries={c.history} />
            </section>
          </>
        )}
      </AsyncView>
    </div>
  );
}

function CardHeader({ card: c }: { card: AdminCardDetail }) {
  return (
    <div className="card profile">
      <div className="profile-top">
        <Thumb url={c.imageUrl} size={110} />
        <div className="profile-names">
          <h1>{c.name}</h1>
          <div className="muted">
            {c.set.name}
            {c.set.year !== null ? ` (${c.set.year})` : ''} · #{c.cardNumber}
            {c.variant ? ` · ${c.variant}` : ''}
          </div>
          <div className="inline-list">
            <VerifiedBadge verified={c.isVerified} />
            <Badge>{CATEGORY_LABELS[c.category] ?? c.category}</Badge>
            <Badge tone="blue">{humanize(c.source)}</Badge>
          </div>
        </div>
      </div>
      <div className="stats">
        <Stat label="Owners" value={num(c.ownerCount)} />
        <Stat label="Copies" value={num(c.copies)} hint={`${num(c.collectionItemCount)} collection rows`} />
        <Stat label="Trade items" value={num(c.tradeItemCount)} />
        <Stat label="Top value" value={money(c.topValueCents)} />
      </div>
      <dl className="fields">
        <Field label="Card ID">
          <code>{c.id}</code>
        </Field>
        <Field label="Subject">{c.subject ?? <span className="muted">—</span>}</Field>
        <Field label="Rarity">{c.rarity ?? <span className="muted">—</span>}</Field>
        <Field label="Set code">{c.set.code}</Field>
        <Field label="Manufacturer">{c.set.manufacturer ?? <span className="muted">—</span>}</Field>
        <Field label="External ref">{c.externalRef ?? <span className="muted">—</span>}</Field>
        <Field label="Submitted by">
          {c.submittedBy ? <UserLink user={c.submittedBy} /> : <span className="muted">—</span>}
        </Field>
        <Field label="Image URL">
          {c.imageUrl ? (
            <a href={c.imageUrl} target="_blank" rel="noreferrer noopener" className="break">
              {c.imageUrl}
            </a>
          ) : (
            <span className="muted">—</span>
          )}
        </Field>
        <Field label="Created">{dateTime(c.createdAt)}</Field>
        <Field label="Updated">{dateTime(c.updatedAt)}</Field>
      </dl>
    </div>
  );
}

function MarketValues({ card: c }: { card: AdminCardDetail }) {
  return (
    <section>
      <h2>Market values</h2>
      {c.marketValues.length === 0 ? (
        <Empty>No market values computed for this card yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tier</th>
                <th className="num">Value</th>
                <th>Confidence</th>
                <th className="num">Sample size</th>
                <th>Last sale</th>
                <th>Computed</th>
              </tr>
            </thead>
            <tbody>
              {c.marketValues.map((m) => (
                <tr key={m.tierKey}>
                  <td>{m.tierLabel}</td>
                  <td className="num">{money(m.valueCents)}</td>
                  <td>{humanize(m.confidence)}</td>
                  <td className="num">{num(m.sampleSize)}</td>
                  <td>{dateTime(m.lastSaleAt)}</td>
                  <td>{dateTime(m.computedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface Props {
  card: AdminCardDetail;
  onSaved: (card: AdminCardDetail) => void;
}

function VerifyControl({ card, onSaved }: Props) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const next = !card.isVerified;

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const updated = await request<AdminCardDetail>(cardUrl(card.id), {
        method: 'PATCH',
        body: { isVerified: next, reason: reason.trim() } satisfies AdminUpdateCardRequest,
      });
      setReason('');
      onSaved(updated);
    } catch (err) {
      setError(err);
    } finally {
      setConfirming(false);
      setBusy(false);
    }
  }

  return (
    <section className="card form">
      <h2>
        Verification <VerifiedBadge verified={card.isVerified} />
      </h2>
      <p className="muted">
        {card.isVerified
          ? 'Verified cards are visible to everyone in the catalog.'
          : 'Unverified cards are only visible to the user who submitted them.'}
      </p>
      <FormError error={error} />
      <TextField label="Reason (required)" value={reason} onChange={setReason} maxLength={500} multiline />
      <div className="form-actions">
        <button
          type="button"
          className={`btn ${next ? 'btn-primary' : 'btn-danger'}`}
          disabled={!reason.trim()}
          onClick={() => setConfirming(true)}
        >
          {next ? 'Verify…' : 'Unverify…'}
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={next ? `Verify "${card.name}"?` : `Unverify "${card.name}"?`}
          confirmLabel={next ? 'Verify' : 'Unverify'}
          danger={!next}
          busy={busy}
          onConfirm={() => void apply()}
          onCancel={() => setConfirming(false)}
        >
          <p>
            {next
              ? 'The card becomes visible to every user in the catalog.'
              : 'The card is hidden from the catalog for everyone except its submitter.'}
          </p>
          <p className="muted">Reason: {reason.trim()}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function CardEditForm({ card, onSaved }: Props) {
  const [name, setName] = useState(card.name);
  const [cardNumber, setCardNumber] = useState(card.cardNumber);
  const [variant, setVariant] = useState(card.variant);
  const [subject, setSubject] = useState(card.subject ?? '');
  const [rarity, setRarity] = useState(card.rarity ?? '');
  const [imageUrl, setImageUrl] = useState(card.imageUrl ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const patch: AdminUpdateCardRequest = {};
  if (name.trim() !== card.name) patch.name = name.trim();
  if (cardNumber.trim() !== card.cardNumber) patch.cardNumber = cardNumber.trim();
  if (variant.trim() !== card.variant) patch.variant = variant.trim();
  if (nullable(subject) !== (card.subject ?? null)) patch.subject = nullable(subject);
  if (nullable(rarity) !== (card.rarity ?? null)) patch.rarity = nullable(rarity);
  if (nullable(imageUrl) !== (card.imageUrl ?? null)) patch.imageUrl = nullable(imageUrl);
  const dirty = Object.keys(patch).length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await request<AdminCardDetail>(cardUrl(card.id), {
        method: 'PATCH',
        body: { ...patch, reason: nullable(reason) },
      });
      setName(next.name);
      setCardNumber(next.cardNumber);
      setVariant(next.variant);
      setSubject(next.subject ?? '');
      setRarity(next.rarity ?? '');
      setImageUrl(next.imageUrl ?? '');
      setReason('');
      setSaved(true);
      onSaved(next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Edit card</h2>
      <FormError error={error} />
      {saved && <FormSuccess>Card saved.</FormSuccess>}
      <div className="form-grid">
        <TextField label="Name" value={name} onChange={setName} maxLength={120} required />
        <TextField label="Card number" value={cardNumber} onChange={setCardNumber} maxLength={32} required />
        <TextField label="Variant" value={variant} onChange={setVariant} maxLength={80} />
        <TextField label="Subject" value={subject} onChange={setSubject} maxLength={120} />
        <TextField label="Rarity" value={rarity} onChange={setRarity} maxLength={40} />
        <TextField
          label="Image URL"
          type="url"
          value={imageUrl}
          onChange={setImageUrl}
          maxLength={500}
          pattern="https?://.+"
          placeholder="https://…"
        />
      </div>
      <TextField
        label="Reason (optional, saved in the history)"
        value={reason}
        onChange={setReason}
        maxLength={500}
        multiline
      />
      <div className="form-actions">
        <span className="muted small">{dirty ? `Changed: ${Object.keys(patch).join(', ')}` : 'No changes'}</span>
        <button type="submit" className="btn btn-primary" disabled={!dirty || busy}>
          {busy ? 'Saving…' : 'Save card'}
        </button>
      </div>
    </form>
  );
}
