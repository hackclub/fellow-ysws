// Mock Hack Club Auth + Hackatime for end-to-end tests. 404s unless isTestMode().
import { randomBytes } from "node:crypto";
import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { isTestMode } from "@/lib/test-mode";

type Identity = { sub: string; name: string; email: string; slack_id: string };
type Project = { name: string; total_seconds: number };

const g = globalThis as unknown as {
  __mockOAuth?: {
    codes: Map<string, Identity>;
    tokens: Map<string, Identity>;
    projects: Map<string, Project[]>;
    down: boolean;
  };
};
const state = (g.__mockOAuth ??= { codes: new Map(), tokens: new Map(), projects: new Map(), down: false });

const DEFAULT_PROJECTS: Project[] = [
  { name: "big-project", total_seconds: 5 * 3600 + 10 * 60 },
  { name: "almost-there", total_seconds: 2 * 3600 - 60 },
];

/** A stable fake Hackatime id per Hack Club id. */
const mockHackatimeId = (sub: string) => 1000 + ([...sub].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 90000, 7));

const html = (body: string) =>
  new NextResponse(`<!doctype html><meta charset="utf-8"><title>Mock provider</title>${body}`, {
    headers: { "content-type": "text/html" },
  });

type Ctx = { params: Promise<{ provider: string; path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isTestMode()) notFound();
  const { provider, path } = await ctx.params;
  const route = path.join("/");
  const q = req.nextUrl.searchParams;

  if (route === "oauth/authorize") {
    const back = new URL(q.get("redirect_uri")!);
    const deny = new URL(back);
    deny.searchParams.set("error", "access_denied");
    deny.searchParams.set("state", q.get("state") ?? "");
    return html(`<h1>Mock ${provider}</h1>
      <form method="post" action="/test-oauth/${provider}/oauth/approve">
        <input type="hidden" name="redirect_uri" value="${back}">
        <input type="hidden" name="state" value="${q.get("state") ?? ""}">
        <label>Hack Club id <input name="sub" value="ident!e2e-user"></label>
        <button>Approve</button>
      </form>
      <a href="${deny}">Deny</a>`);
  }
  if (route === "oembed") {
    // Mock YouTube oEmbed: video ids starting with "private" are not found.
    const v = new URL(q.get("url") ?? "http://x").searchParams.get("v") ?? "";
    return v.startsWith("private") ? NextResponse.json({}, { status: 401 }) : NextResponse.json({ title: "pitch" });
  }
  const who = state.tokens.get(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  if (route === "oauth/userinfo") {
    return who ? NextResponse.json(who) : NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  if (route === "api/v1/authenticated/me") {
    if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ id: mockHackatimeId(who.sub), emails: [who.email], slack_id: who.slack_id });
  }
  if (route === "api/v1/authenticated/projects") {
    if (state.down) return NextResponse.json({ error: "down" }, { status: 503 });
    if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ projects: state.projects.get(who.sub) ?? DEFAULT_PROJECTS });
  }
  notFound();
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isTestMode()) notFound();
  const { provider, path } = await ctx.params;
  const route = path.join("/");

  // Mock Airtable: create records in the YSWS table.
  if (provider === "airtable" && path[0] === "v0" && path.length === 3) {
    const body = (await req.json()) as { records: { fields: Record<string, unknown> }[] };
    const records = body.records.map((r) => ({
      id: `rec${randomBytes(7).toString("hex")}`,
      createdTime: new Date().toISOString(),
      fields: r.fields,
    }));
    return NextResponse.json({ records });
  }
  const form = new URLSearchParams(await req.text());

  if (route === "oauth/approve") {
    const sub = form.get("sub") || "ident!e2e-user";
    const code = randomBytes(8).toString("hex");
    state.codes.set(code, { sub, name: `Test ${sub}`, email: `${sub.replace(/\W/g, "")}@example.com`, slack_id: "U000" });
    const back = new URL(form.get("redirect_uri")!);
    back.searchParams.set("code", code);
    back.searchParams.set("state", form.get("state") ?? "");
    return NextResponse.redirect(back, 303);
  }
  if (route === "oauth/token") {
    const who = state.codes.get(form.get("code") ?? "");
    if (!who) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    state.codes.delete(form.get("code")!);
    const token = randomBytes(16).toString("hex");
    state.tokens.set(token, who);
    return NextResponse.json({ access_token: token, token_type: "Bearer", expires_in: 3600 });
  }
  // Test controls: set a user's projects, or take Hackatime down.
  if (route === "control") {
    const body = JSON.parse(form.get("json") ?? "{}") as {
      sub?: string;
      projects?: Project[];
      down?: boolean;
    };
    if (body.sub && body.projects) state.projects.set(body.sub, body.projects);
    if (typeof body.down === "boolean") state.down = body.down;
    return NextResponse.json({ ok: true });
  }
  notFound();
}
