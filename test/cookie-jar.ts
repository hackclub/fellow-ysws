// In-memory stand-in for next/headers cookies() in integration tests.
type Opts = { maxAge?: number; expires?: Date; path?: string };
const store = new Map<string, { value: string; opts: Opts }>();

export const jar = {
  get: (name: string) => (store.has(name) ? { name, value: store.get(name)!.value } : undefined),
  getAll: () => [...store.entries()].map(([name, v]) => ({ name, value: v.value })),
  has: (name: string) => store.has(name),
  set: (name: string, value: string, opts: Opts = {}) => {
    store.set(name, { value, opts });
  },
  delete: (arg: string | { name: string }) => {
    store.delete(typeof arg === "string" ? arg : arg.name);
  },
  options: (name: string) => store.get(name)?.opts,
  clear: () => store.clear(),
};

/** Request headers seen by code under test; set per test. */
export const requestHeaders = new Headers({ "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140" });

export const nextHeadersMock = () => ({
  cookies: async () => jar,
  headers: async () => requestHeaders,
});
