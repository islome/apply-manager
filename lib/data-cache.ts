// Tiny in-memory cache that survives client-side page changes (module state lives until a full
// reload, which logout does). Hooks show the cached copy instantly and refresh it in the background.

const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
}
