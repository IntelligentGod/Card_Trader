import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import type { Paginated } from '@card-trader/shared';

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (data: T) => void;
}

/** Runs `fn` whenever deps change; ignores stale results. */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ data: null, error: null, loading: true });
    fn(ctrl.signal).then(
      (data) => !ctrl.signal.aborted && setState({ data, error: null, loading: false }),
      (error: unknown) => !ctrl.signal.aborted && setState({ data: null, error, loading: false }),
    );
    return () => ctrl.abort();
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  /** Replaces the data in place (e.g. with a PATCH response) without a loading flash. */
  const setData = useCallback((data: T) => setState({ data, error: null, loading: false }), []);
  return { ...state, reload, setData };
}

export interface PaginatedState<T> {
  items: T[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  loadMoreError: unknown;
  loadMore: () => void;
  reload: () => void;
}

/** Cursor pagination: the first page reloads on deps change, later pages append. */
export function usePaginated<T>(
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<Paginated<T>>,
  deps: DependencyList,
): PaginatedState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loadMoreError, setLoadMoreError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const ctrlRef = useRef<AbortController | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    fetchRef.current(null, ctrl.signal).then(
      (page) => {
        if (ctrl.signal.aborted) return;
        setItems(page.data);
        setNextCursor(page.nextCursor);
        setLoading(false);
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        setItems([]);
        setNextCursor(null);
        setError(err);
        setLoading(false);
      },
    );
    return () => ctrl.abort();
  }, [...deps, nonce]);

  const loadMore = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    fetchRef.current(nextCursor, ctrl.signal).then(
      (page) => {
        if (ctrl.signal.aborted) return;
        setItems((prev) => [...prev, ...page.data]);
        setNextCursor(page.nextCursor);
        setLoadingMore(false);
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoadMoreError(err);
        setLoadingMore(false);
      },
    );
  }, [nextCursor, loadingMore]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { items, nextCursor, loading, loadingMore, error, loadMoreError, loadMore, reload };
}

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
