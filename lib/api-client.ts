// One place for "call my own API from the browser". Used by every page's data layer.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Same-origin JSON call (the HR session cookie is sent automatically).
 * Throws ApiError with the server's `error` message; status 0 = network failure,
 * 401 = not signed in. Aborted requests rethrow the original AbortError.
 */
export async function apiJson<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: opts.signal,
    headers,
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('Network error — check your connection', 0);
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return null as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('The server sent an unreadable response', res.status);
  }
}
