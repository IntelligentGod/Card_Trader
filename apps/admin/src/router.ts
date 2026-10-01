import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'overview' }
  | { name: 'users' }
  | { name: 'user'; publicId: string }
  | { name: 'trades' }
  | { name: 'trade'; id: string }
  | { name: 'cards' }
  | { name: 'card'; id: string }
  | { name: 'analytics' }
  | { name: 'admins' }
  | { name: 'audit' }
  | { name: 'announce' }
  | { name: 'notFound' };

export interface Location {
  route: Route;
  query: URLSearchParams;
}

function parseHash(hash: string): Location {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart = '/', queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart);
  const [first, second, ...rest] = segments;
  let route: Route = { name: 'notFound' };
  if (rest.length === 0) {
    if (!first) route = { name: 'overview' };
    else if (first === 'users') route = second ? { name: 'user', publicId: second } : { name: 'users' };
    else if (first === 'trades') route = second ? { name: 'trade', id: second } : { name: 'trades' };
    else if (first === 'cards') route = second ? { name: 'card', id: second } : { name: 'cards' };
    else if (!second && (first === 'analytics' || first === 'admins' || first === 'audit' || first === 'announce')) {
      route = { name: first };
    }
  }
  return { route, query };
}

let current = parseHash(window.location.hash);
let currentHash = window.location.hash;

function getSnapshot(): Location {
  if (window.location.hash !== currentHash) {
    currentHash = window.location.hash;
    current = parseHash(currentHash);
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useLocation(): Location {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function href(path: string, query?: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v) sp.set(k, v);
  const s = sp.toString();
  return `#${path}${s ? `?${s}` : ''}`;
}

export function navigate(target: string, replace = false): void {
  if (replace) window.location.replace(target);
  else window.location.hash = target.replace(/^#/, '');
}

export const paths = {
  overview: () => '/',
  users: () => '/users',
  user: (publicId: string) => `/users/${encodeURIComponent(publicId)}`,
  trades: () => '/trades',
  trade: (id: string) => `/trades/${encodeURIComponent(id)}`,
  cards: () => '/cards',
  card: (id: string) => `/cards/${encodeURIComponent(id)}`,
  analytics: () => '/analytics',
  admins: () => '/admins',
  audit: () => '/audit',
  announce: () => '/announce',
};
