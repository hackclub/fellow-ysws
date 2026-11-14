// Fake Hack Club Auth + Hackatime, served through a stubbed global fetch.
import { vi } from "vitest";

export type FakeIdentity = { sub: string; name?: string; email?: string; slack_id?: string };

export const fake = {
  identities: new Map<string, FakeIdentity>(), // code -> identity
  tokens: new Map<string, FakeIdentity>(), // access token -> identity
  projects: new Map<string, { name: string; total_seconds: number }[]>(), // sub -> projects
  hackatimeIds: new Map<string, number | null>(), // sub -> Hackatime id (null: /me fails); default 4242
  hackatimeDown: false,
  youtubeDown: false,
  /** Records created in the fake Airtable table, in order. */
  airtable: [] as { id: string; fields: Record<string, unknown> }[],
  /** Set to make the next Airtable create fail with this status. */
  airtableFailStatus: null as number | null,
  reset() {
    this.youtubeDown = false;
    this.identities.clear();
    this.tokens.clear();
    this.projects.clear();
    this.hackatimeIds.clear();
    this.hackatimeDown = false;
    this.airtable = [];
    this.airtableFailStatus = null;
  },
  /** Simulates the user approving at the provider; returns the code the provider would send back. */
  approve(identity: FakeIdentity) {
    const code = `code-${Math.random().toString(36).slice(2)}`;
    this.identities.set(code, identity);
    return code;
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const auth = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";

  if (url.pathname === "/oauth/token") {
    const form = new URLSearchParams(await req.text());
    const who = fake.identities.get(form.get("code") ?? "");
    if (!who || !form.get("code_verifier")) return json({ error: "invalid_grant" }, 400);
    fake.identities.delete(form.get("code")!);
    const token = `tok-${url.host}-${Math.random().toString(36).slice(2)}`;
    fake.tokens.set(token, who);
    return json({ access_token: token, token_type: "Bearer", expires_in: 3600 });
  }
  if (url.pathname === "/oauth/userinfo") {
    const who = fake.tokens.get(auth);
    return who ? json(who) : json({ error: "invalid_token" }, 401);
  }
  if (url.pathname === "/api/v1/authenticated/projects") {
    if (fake.hackatimeDown) return json({ error: "down" }, 503);
    const who = fake.tokens.get(auth);
    if (!who) return json({ error: "Unauthorized" }, 401);
    return json({ projects: fake.projects.get(who.sub) ?? [] });
  }
  if (url.pathname === "/api/v1/authenticated/me") {
    const who = fake.tokens.get(auth);
    if (!who) return json({ error: "Unauthorized" }, 401);
    const id = fake.hackatimeIds.has(who.sub) ? fake.hackatimeIds.get(who.sub) : 4242;
    return id === null ? json({ error: "boom" }, 500) : json({ id, emails: [], slack_id: who.slack_id ?? null });
  }
  if (url.host === "airtable.test" && req.method === "POST" && /^\/v0\/[^/]+\/[^/]+$/.test(url.pathname)) {
    if (auth !== "pat-test") return json({ error: { type: "AUTHENTICATION_REQUIRED" } }, 401);
    if (fake.airtableFailStatus) {
      const status = fake.airtableFailStatus;
      fake.airtableFailStatus = null;
      return json({ error: { type: "INVALID_REQUEST", message: "boom" } }, status);
    }
    const body = (await req.json()) as { records: { fields: Record<string, unknown> }[] };
    const created = body.records.map((r) => ({ id: `rec${String(fake.airtable.length + 1).padStart(14, "0")}`, fields: r.fields }));
    for (const r of created) fake.airtable.push(r);
    return json({ records: created.map((r) => ({ id: r.id, createdTime: new Date().toISOString(), fields: r.fields })) });
  }
  if (url.pathname === "/oembed") {
    if (fake.youtubeDown) throw new TypeError("network down");
    const v = new URL(url.searchParams.get("url") ?? "").searchParams.get("v") ?? "";
    return v.startsWith("private") ? json({}, 401) : json({ title: "pitch" });
  }
  return json({ error: "not found" }, 404);
}

export function installFakeProviders() {
  vi.stubGlobal("fetch", vi.fn(handle));
}
