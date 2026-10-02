import { ApiError, apiRequest, errorMessage } from '../api/client';

/** A fetch that never answers on its own, like a connection that dropped mid-request. */
function hangingFetch() {
  return jest.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  );
}

describe('apiRequest timeouts', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
  });

  it('gives up after 30 s instead of waiting forever', async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const request = apiRequest('/health', { auth: false });
    const outcome = request.catch((error: unknown) => error);

    jest.advanceTimersByTime(30_000);
    const error = await outcome;
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('TIMEOUT');
    expect(errorMessage(error)).toBe('The server took too long to answer. Check your connection and try again.');
  });

  it('allows uploads two minutes', async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    let settled = false;
    const outcome = apiRequest('/uploads/images', { auth: false, method: 'POST', form: new FormData() })
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
      });

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(settled).toBe(false);

    jest.advanceTimersByTime(60_000);
    expect(((await outcome) as ApiError).code).toBe('TIMEOUT');
  });

  it('still reports a caller abort as AbortError', async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const controller = new AbortController();
    const outcome = apiRequest('/health', { auth: false, signal: controller.signal }).catch((error: unknown) => error);

    controller.abort();
    expect(((await outcome) as Error).name).toBe('AbortError');
  });
});
