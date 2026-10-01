import type { MailMessage } from './mail.service';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Plain, client-safe HTML: inline styles only, one table, works in Gmail/Outlook/Apple Mail. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f5fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<tr><td><h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr></table></body></html>`;
}

export function verifyEmailMessage(to: string, displayName: string, link: string, ttlHours: number): MailMessage {
  const name = escapeHtml(displayName);
  return {
    to,
    subject: 'Verify your Card Trader email',
    text: `Welcome to Card Trader, ${displayName}.\n\nPlease verify your email address by opening this link:\n${link}\n\nThe link expires in ${ttlHours} hours.\n\nIf you did not create this account, you can ignore this email.`,
    html: layout(
      'Welcome to Card Trader',
      `<p style="font-size:16px;line-height:1.5">Hi ${name}, please verify your email address by clicking the button below:</p>
<p style="margin:28px 0"><a href="${escapeHtml(link)}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;display:inline-block">Verify Email</a></p>
<p style="font-size:13px;color:#64748b;line-height:1.5">The link expires in ${ttlHours} hours. If the button does not work, copy this address into your browser:<br>${escapeHtml(link)}</p>
<p style="font-size:13px;color:#64748b">If you did not create this account, you can ignore this email.</p>`,
    ),
  };
}

/** The page the verification link opens: friendly, no app required. */
export function verifyEmailPage(ok: boolean, message: string, appLink: string): string {
  const title = ok ? 'Email verified' : 'This link didn’t work';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Card Trader</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f5fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<main style="max-width:420px;margin:24px;background:#fff;border-radius:20px;padding:32px;text-align:center">
<div style="font-size:44px" aria-hidden="true">${ok ? '✓' : '!'}</div>
<h1 style="font-size:22px;margin:12px 0">${escapeHtml(title)}</h1>
<p style="font-size:16px;line-height:1.5;color:#334155">${escapeHtml(message)}</p>
<p style="margin-top:24px"><a href="${escapeHtml(appLink)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;display:inline-block">Open Card Trader</a></p>
</main></body></html>`;
}
