import { useEffect, useRef, type ReactNode } from 'react';
import { SOCIAL_LINK_KEYS, type AdminAuditEntry, type SocialLinks } from '@card-trader/shared';
import { errorMessage } from './api';
import { Empty } from './components';
import { dateTime, humanize } from './format';
import { href, paths } from './router';

// ───────────── Inputs ─────────────

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  type?: 'text' | 'email' | 'url';
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  disabled?: boolean;
}

export function TextField(p: TextFieldProps) {
  const common = {
    value: p.value,
    maxLength: p.maxLength,
    minLength: p.minLength,
    required: p.required,
    placeholder: p.placeholder,
    disabled: p.disabled,
  };
  return (
    <label className="form-field">
      <span>
        {p.label}
        {p.maxLength ? (
          <span className="muted">
            {' '}
            ({p.value.length}/{p.maxLength})
          </span>
        ) : null}
      </span>
      {p.multiline ? (
        <textarea className="input" rows={3} {...common} onChange={(e) => p.onChange(e.target.value)} />
      ) : (
        <input
          className="input"
          type={p.type ?? 'text'}
          pattern={p.pattern}
          {...common}
          onChange={(e) => p.onChange(e.target.value)}
        />
      )}
      {p.hint ? <small className="muted">{p.hint}</small> : null}
    </label>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="alert" role="alert">
      {errorMessage(error)}
    </div>
  );
}

export function FormSuccess({ children }: { children: ReactNode }) {
  return (
    <div className="alert alert-success" role="status">
      {children}
    </div>
  );
}

// ───────────── Social links ─────────────

export type SocialDraft = Record<(typeof SOCIAL_LINK_KEYS)[number], string>;

export function socialDraft(links: SocialLinks): SocialDraft {
  const out = {} as SocialDraft;
  for (const k of SOCIAL_LINK_KEYS) out[k] = links[k] ?? '';
  return out;
}

/** Trimmed links without empty keys. */
export function socialFromDraft(draft: SocialDraft): SocialLinks {
  const out: SocialLinks = {};
  for (const k of SOCIAL_LINK_KEYS) {
    const v = draft[k].trim();
    if (v) out[k] = v;
  }
  return out;
}

export function sameSocial(a: SocialLinks, b: SocialLinks): boolean {
  return SOCIAL_LINK_KEYS.every((k) => (a[k] ?? '') === (b[k] ?? ''));
}

export function SocialFields({ draft, onChange }: { draft: SocialDraft; onChange: (d: SocialDraft) => void }) {
  return (
    <div className="form-grid">
      {SOCIAL_LINK_KEYS.map((k) => (
        <TextField
          key={k}
          label={k === 'x' ? 'X' : humanize(k)}
          value={draft[k]}
          maxLength={200}
          placeholder={k === 'website' ? 'https://…' : 'handle or URL'}
          onChange={(v) => onChange({ ...draft, [k]: v })}
        />
      ))}
    </div>
  );
}

/** '' → null for optional text fields. */
export function nullable(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

// ───────────── Confirm dialog ─────────────

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  busy,
  confirmDisabled,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  /** shown inside the dialog, e.g. an API error */
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ busy, onCancel });
  latest.current = { busy, onCancel };
  useEffect(() => {
    // Focus the first field if the dialog has one, else Cancel (only on open).
    const field = bodyRef.current?.querySelector<HTMLElement>('input, textarea, select');
    (field ?? cancelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !latest.current.busy) latest.current.onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <FormError error={error} />
        <div className="modal-body" ref={bodyRef}>
          {children}
        </div>
        <div className="form-actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────── Audit history ─────────────

export const AUDIT_ACTIONS = [
  'USER_UPDATED',
  'USER_DISABLED',
  'USER_ENABLED',
  'USER_PASSWORD_RESET',
  'VENDOR_UPDATED',
  'ADMIN_CREATED',
  'ADMIN_ROLE_CHANGED',
  'ADMIN_REMOVED',
  'ADMIN_DISABLED',
  'ADMIN_ENABLED',
  'CARD_UPDATED',
  'CARD_VERIFIED',
  'CARD_UNVERIFIED',
  'ANNOUNCEMENT_SENT',
] as const;

const ACTION_LABELS: Record<string, string> = {
  USER_DISABLED: 'User blocked',
  USER_ENABLED: 'User unblocked',
  USER_PASSWORD_RESET: 'Password reset',
  ADMIN_DISABLED: 'Admin blocked',
  ADMIN_ENABLED: 'Admin unblocked',
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action);
}

function auditValue(v: unknown): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="muted">(empty)</span>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return <code>{JSON.stringify(v)}</code>;
}

/** The acting admin; a hidden super admin comes back with null fields. */
export function AuditActor({ admin }: { admin: AdminAuditEntry['admin'] }) {
  if (!admin.publicId) return <span>Administrator</span>;
  return (
    <span>
      <a href={href(paths.user(admin.publicId))}>{admin.displayName}</a>
      {admin.email && <span className="muted"> ({admin.email})</span>}
    </span>
  );
}

export function AuditTarget({ entry }: { entry: AdminAuditEntry }) {
  if (entry.target) return <a href={href(paths.user(entry.target.publicId))}>{entry.target.displayName}</a>;
  if (entry.targetType === 'CARD') return <a href={href(paths.card(entry.targetId))}>Card</a>;
  if (entry.targetType === 'SYSTEM') return <span className="muted">System</span>;
  return <span className="muted">—</span>;
}

export function AuditChanges({ changes }: { changes: AdminAuditEntry['changes'] }) {
  const rows = Object.entries(changes);
  if (rows.length === 0) return null;
  return (
    <table className="table compact audit-changes">
      <tbody>
        {rows.map(([field, c]) => (
          <tr key={field}>
            <td className="audit-field">{field}</td>
            <td>{auditValue(c.from)}</td>
            <td className="muted" aria-label="changed to">
              →
            </td>
            <td>{auditValue(c.to)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuditList({ entries }: { entries: AdminAuditEntry[] }) {
  if (entries.length === 0) return <Empty>No admin changes recorded.</Empty>;
  return (
    <ul className="audit-list">
      {entries.map((e) => (
        <li key={e.id} className="audit">
          <div className="audit-head">
            <strong>{auditActionLabel(e.action)}</strong>
            <span className="muted small">
              by <AuditActor admin={e.admin} /> · {dateTime(e.createdAt)}
              {e.ipAddress && <> · IP {e.ipAddress}</>}
            </span>
          </div>
          {e.target && (
            <div className="small">
              <span className="muted">Target:</span> <AuditTarget entry={e} />
            </div>
          )}
          {e.reason && (
            <p>
              <span className="muted">Reason:</span> {e.reason}
            </p>
          )}
          <AuditChanges changes={e.changes} />
        </li>
      ))}
    </ul>
  );
}
