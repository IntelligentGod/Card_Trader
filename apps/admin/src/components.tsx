import { useState, type ReactNode } from 'react';
import {
  CONDITION_LABELS,
  type CardCondition,
  type GradingCompany,
  type PublicUserLite,
} from '@card-trader/shared';
import { errorMessage } from './api';
import { humanize } from './format';
import { href, paths } from './router';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <span>{errorMessage(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state state-empty">{children}</div>;
}

/** Renders loading / error / content for a useAsync result. */
export function AsyncView<T>({
  state,
  children,
}: {
  state: { data: T | null; error: unknown; loading: boolean; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === null) return <Spinner />;
  return <>{children(state.data)}</>;
}

export function LoadMore({
  hasMore,
  loading,
  error,
  onClick,
}: {
  hasMore: boolean;
  loading: boolean;
  error: unknown;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="load-more">
      {error ? <span className="text-error">{errorMessage(error)}</span> : null}
      <button type="button" className="btn" onClick={onClick} disabled={loading}>
        {loading ? 'Loading…' : error ? 'Try again' : 'Load more'}
      </button>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export function Avatar({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (url && !failed) {
    return <img className="avatar" src={url} alt="" style={style} loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <span className="avatar avatar-fallback" style={style} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Thumb({ url, size = 40 }: { url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: Math.round(size * 1.4) };
  if (url && !failed) {
    return <img className="thumb" src={url} alt="" style={style} loading="lazy" onError={() => setFailed(true)} />;
  }
  return <span className="thumb thumb-fallback" style={style} aria-hidden />;
}

export type BadgeTone = 'neutral' | 'green' | 'red' | 'amber' | 'blue' | 'purple';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const STATUS_TONES: Record<string, BadgeTone> = {
  SUPER_ADMIN: 'red',
  ADMIN: 'purple',
  USER: 'neutral',
  ACTIVE: 'green',
  BLOCKED: 'red',
  DISABLED: 'neutral',
  DRAFT: 'neutral',
  PROPOSED: 'blue',
  ACCEPTED: 'purple',
  COMPLETED: 'green',
  CANCELLED: 'red',
  DECLINED: 'amber',
  PUBLISHED: 'green',
  PENDING: 'blue',
  APPROVED: 'green',
  WITHDRAWN: 'neutral',
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return <Badge tone={STATUS_TONES[value] ?? 'neutral'}>{label ?? humanize(value)}</Badge>;
}

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="stars" title={`${rating} / 5`} aria-label={`${rating} out of 5`}>
      {'★'.repeat(full)}
      <span className="stars-empty">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

export function UserLink({ user, showAvatar = true }: { user: PublicUserLite; showAvatar?: boolean }) {
  return (
    <a className="user-link" href={href(paths.user(user.publicId))} onClick={(e) => e.stopPropagation()}>
      {showAvatar && <Avatar url={user.avatarUrl} name={user.displayName} size={24} />}
      <span>
        {user.displayName} <span className="muted">@{user.username}</span>
      </span>
    </a>
  );
}

export function conditionText(
  condition: CardCondition,
  gradingCompany: GradingCompany | null,
  grade: number | null,
): string {
  if (condition === 'GRADED') return `${gradingCompany ?? 'Graded'} ${grade ?? ''}`.trim();
  return CONDITION_LABELS[condition] ?? condition;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
