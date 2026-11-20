import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { funnelEvents, sessions, users } from "@/db/schema";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());

const { finishHackClub, finishHackatime, startHackClub, startHackatime } = await import("./flows");
const { getCurrentUser } = await import("./session");
const { decrypt } = await import("@/lib/crypto");
const { HACKATIME_COOKIE, userHackatimeIdBinding } = await import("@/lib/hackatime");

/** Runs start → provider approval → callback, like a browser would. */
async function signIn(identity: { sub: string; name?: string; email?: string }, next = "/apply") {
  const authorizeUrl = new URL(await startHackClub(next));
  const code = fake.approve(identity);
  return finishHackClub(new URLSearchParams({ code, state: authorizeUrl.searchParams.get("state")! }));
}

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

describe("Hack Club sign-in", () => {
  it("creates an account on first sign-in and returns to the requested page", async () => {
    const to = await signIn({ sub: "ident!orpheus", name: "Orpheus", email: "o@hackclub.com" }, "/apply");
    expect(to).toBe("/apply");
    const all = await db().select().from(users);
    expect(all).toHaveLength(1);
    expect(all[0].piiEnc).not.toContain("Orpheus");
    const me = await getCurrentUser();
    expect(me).toMatchObject({ hcId: "ident!orpheus", name: "Orpheus", email: "o@hackclub.com", isAdmin: false });
  });

  it("reuses the account on a second sign-in", async () => {
    await signIn({ sub: "ident!orpheus" });
    jar.clear();
    await signIn({ sub: "ident!orpheus", name: "New Name" });
    expect(await db().select().from(users)).toHaveLength(1);
    expect(await db().select().from(sessions)).toHaveLength(2);
    expect((await getCurrentUser())?.name).toBe("New Name");
  });

  it("marks allowlisted users as admins", async () => {
    await signIn({ sub: "ident!admin1" });
    expect((await getCurrentUser())?.isAdmin).toBe(true);
  });

  it("rejects a callback with the wrong state", async () => {
    await startHackClub("/apply");
    const code = fake.approve({ sub: "ident!x" });
    expect(await finishHackClub(new URLSearchParams({ code, state: "forged" }))).toBe("/?signin=failed");
    expect(await db().select().from(users)).toHaveLength(0);
  });

  it("refuses off-site redirect targets", async () => {
    expect(await signIn({ sub: "ident!x" }, "//evil.example")).toBe("/apply");
  });

  it("links earlier anonymous funnel events and records signed_in", async () => {
    jar.set("ff_anon", "anon-1");
    await db().insert(funnelEvents).values({ step: "visit", anonId: "anon-1" });
    await signIn({ sub: "ident!x" });
    const events = await db().select().from(funnelEvents);
    const me = await getCurrentUser();
    expect(events.map((e) => [e.step, e.userId])).toEqual([
      ["visit", me!.id],
      ["signed_in", me!.id],
    ]);
  });
});

describe("Hackatime connection", () => {
  async function connect() {
    const url = new URL(await startHackatime());
    const code = fake.approve({ sub: "ident!orpheus" });
    return finishHackatime(new URLSearchParams({ code, state: url.searchParams.get("state")! }));
  }

  it("keeps the token only in the encrypted cookie, never in the database", async () => {
    await signIn({ sub: "ident!orpheus" });
    expect(await connect()).toBe("/apply");
    const cookie = jar.get(HACKATIME_COOKIE)!.value;
    expect(cookie).not.toMatch(/^tok-/);
    expect(jar.options(HACKATIME_COOKIE)?.maxAge).toBe(30 * 60);
    const dump = JSON.stringify(await db().execute("SELECT * FROM users, sessions, funnel_events"));
    expect(dump).not.toContain("tok-");
    expect((await getCurrentUser())?.hackatimeConnectedAt).toBeInstanceOf(Date);
  });

  it("saves the Hackatime account id, encrypted", async () => {
    await signIn({ sub: "ident!orpheus" });
    fake.hackatimeIds.set("ident!orpheus", 8997);
    await connect();
    const [row] = await db().select().from(users);
    expect(row.hackatimeIdEnc).toBeTruthy();
    expect(row.hackatimeIdEnc).not.toContain("8997");
    expect(decrypt(row.hackatimeIdEnc!, userHackatimeIdBinding(row.id))).toBe("8997");
  });

  it("still connects when Hackatime doesn't return an id", async () => {
    await signIn({ sub: "ident!orpheus" });
    fake.hackatimeIds.set("ident!orpheus", null);
    expect(await connect()).toBe("/apply");
    const [row] = await db().select().from(users);
    expect(row.hackatimeIdEnc).toBeNull();
    expect(row.hackatimeConnectedAt).toBeInstanceOf(Date);
  });

  it("returns to the form with an explanation when authorization is denied", async () => {
    await signIn({ sub: "ident!orpheus" });
    await startHackatime();
    expect(await finishHackatime(new URLSearchParams({ error: "access_denied" }))).toBe("/apply?hackatime=denied");
    expect(jar.get(HACKATIME_COOKIE)).toBeUndefined();
    expect((await getCurrentUser())?.hackatimeConnectedAt).toBeNull();
  });

  it("sends signed-out users to Hack Club sign-in first", async () => {
    expect(await startHackatime()).toMatch(/^\/auth\/hackclub\/start/);
  });

  it("returns a partner to the portal, and ignores any other return path", async () => {
    await signIn({ sub: "ident!orpheus" });
    const url = new URL(await startHackatime("/submissions"));
    const code = fake.approve({ sub: "ident!orpheus" });
    expect(await finishHackatime(new URLSearchParams({ code, state: url.searchParams.get("state")! }))).toBe("/submissions");
    await startHackatime("/submissions");
    expect(await finishHackatime(new URLSearchParams({ error: "access_denied" }))).toBe("/submissions?hackatime=denied");
    await startHackatime("https://evil.example");
    expect(await finishHackatime(new URLSearchParams({ error: "access_denied" }))).toBe("/apply?hackatime=denied");
  });
});
