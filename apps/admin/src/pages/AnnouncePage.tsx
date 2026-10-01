import { useState, type FormEvent } from 'react';
import type { AdminBroadcastRequest, AdminBroadcastResponse } from '@card-trader/shared';
import { request } from '../api';
import { ConfirmDialog, FormSuccess, TextField } from '../forms';
import { num } from '../format';

export function AnnouncePage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<{ title: string; recipients: number } | null>(null);

  const t = title.trim();
  const m = message.trim();
  const valid = t.length >= 3 && t.length <= 120 && m.length >= 3 && m.length <= 300;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setConfirming(true);
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await request<AdminBroadcastResponse>('/admin/notifications/broadcast', {
        method: 'POST',
        body: { title: t, message: m } satisfies AdminBroadcastRequest,
      });
      setSent({ title: t, recipients: res.recipients });
      setTitle('');
      setMessage('');
      setConfirming(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Announcement</h1>
      </div>
      <form className="card form narrow" onSubmit={onSubmit}>
        <p className="muted">
          Sends an announcement notification to every active user. It can&apos;t be recalled.
        </p>
        {sent && (
          <FormSuccess>
            &ldquo;{sent.title}&rdquo; was sent to {num(sent.recipients)} {sent.recipients === 1 ? 'user' : 'users'}.
          </FormSuccess>
        )}
        <TextField label="Title (3–120)" value={title} onChange={setTitle} minLength={3} maxLength={120} required />
        <TextField
          label="Message (3–300)"
          value={message}
          onChange={setMessage}
          minLength={3}
          maxLength={300}
          multiline
          required
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Send announcement…
          </button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title="Send this announcement to every active user?"
          confirmLabel="Send"
          busy={busy}
          error={error}
          onConfirm={() => void send()}
          onCancel={() => setConfirming(false)}
        >
          <div className="announce-preview">
            <strong>{t}</strong>
            <p>{m}</p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
