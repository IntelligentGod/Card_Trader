import type { CardSummary } from '@card-trader/shared';

export function cardSubtitle(card: Pick<CardSummary, 'cardNumber' | 'variant'> & { set: { name: string } }): string {
  return [card.set.name, `#${card.cardNumber}`, card.variant || null].filter(Boolean).join(' · ');
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Sat, Nov 14 · 9:00 AM – 5:00 PM" or "Nov 14 – Nov 15" for multi-day shows (device time zone). */
export function formatEventDates(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (start.toDateString() === end.toDateString()) return `${day(start)} · ${time(start)} – ${time(end)}`;
  return `${day(start)} – ${day(end)}`;
}

/** Short badge text for an event date, e.g. { month: 'NOV', day: '14' }. */
export function eventDateBadge(startsAt: string): { month: string; day: string } {
  const d = new Date(startsAt);
  return { month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), day: String(d.getDate()) };
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(iso);
}
