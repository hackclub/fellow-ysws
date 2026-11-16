import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { funnelEvents } from "@/db/schema";
import { jar, requestHeaders } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { makeUser, signInAsAdmin } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const { recordVisit, isBot } = await import("@/lib/funnel");
const { funnelReport, parseRange } = await import("./funnel");
const flows = await import("@/lib/auth/flows");

const BROWSER = "Mozilla/5.0 (Macintosh) Chrome/140";

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
  requestHeaders.set("user-agent", BROWSER);
  requestHeaders.delete("x-ff-anon");
});
afterAll(closeDb);

describe("visit recording", () => {
  it("records one visit per anonymous id per day, with no IP or user agent", async () => {
    jar.set("ff_anon", "anon-a");
    await recordVisit();
    await recordVisit();
    const rows = await db().select().from(funnelEvents);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["anonId", "createdAt", "dedupeKey", "id", "meta", "step", "userId"]);
    expect(JSON.stringify(rows[0])).not.toContain("Mozilla");
  });

  it("uses the id the proxy passed along on a first visit", async () => {
    requestHeaders.set("x-ff-anon", "anon-first");
    await recordVisit();
    expect((await db().select().from(funnelEvents))[0].anonId).toBe("anon-first");
  });

  it("skips bots and link previews", async () => {
    jar.set("ff_anon", "anon-b");
    requestHeaders.set("user-agent", "Slackbot-LinkExpanding 1.0");
    await recordVisit();
    expect(await db().select().from(funnelEvents)).toHaveLength(0);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot(BROWSER)).toBe(false);
  });
});

describe("sign-in linking", () => {
  it("counts a visitor's pre-sign-in visit and later steps as one person", async () => {
    jar.set("ff_anon", "anon-c");
    await recordVisit();
    const url = new URL(await flows.startHackClub("/apply"));
    const code = fake.approve({ sub: "ident!c" });
    await flows.finishHackClub(new URLSearchParams({ code, state: url.searchParams.get("state")! }));
    const ht = new URL(await flows.startHackatime());
    await flows.finishHackatime(new URLSearchParams({ code: fake.approve({ sub: "ident!c" }), state: ht.searchParams.get("state")! }));

    await signInAsAdmin();
    const r = await funnelReport(new Date(Date.now() - 86_400_000), new Date(Date.now() + 86_400_000));
    expect(r.steps.slice(0, 3).map((s) => [s.step, s.people])).toEqual([
      ["visit", 1],
      ["signed_in", 1],
      ["hackatime_connected", 1],
    ]);
    expect(r.steps[1].fromPrevious).toBe(100);
  });
});

describe("funnel report", () => {
  it("counts unique people per step with conversion and splits", async () => {
    const day = new Date("2026-11-05T12:00:00Z");
    const users = await Promise.all([1, 2, 3].map(() => makeUser()));
    const ev = (step: (typeof funnelEvents.$inferInsert)["step"], who: { userId?: string; anonId?: string }, meta?: Record<string, string>, createdAt = day) =>
      ({ step, ...who, meta, createdAt, dedupeKey: randomUUID() });
    await db().insert(funnelEvents).values([
      // 4 visitors (one visits twice), 3 sign in, 2 start the form, 2 submit (1 project, 1 aid), 1 decided
      ev("visit", { anonId: "a1", userId: users[0].id }),
      ev("visit", { anonId: "a1", userId: users[0].id }),
      ev("visit", { anonId: "a2", userId: users[1].id }),
      ev("visit", { anonId: "a3", userId: users[2].id }),
      ev("visit", { anonId: "a4" }),
      ev("signed_in", { userId: users[0].id }),
      ev("signed_in", { userId: users[1].id }),
      ev("signed_in", { userId: users[2].id }),
      ev("hackatime_connected", { userId: users[0].id }),
      ev("form_started", { userId: users[0].id }),
      ev("form_started", { userId: users[1].id }),
      ev("submitted", { userId: users[0].id }, { kind: "project" }),
      ev("submitted", { userId: users[1].id }, { kind: "aid" }),
      ev("decided", { userId: users[0].id }, { decision: "approved" }),
      // outside the range
      ev("visit", { anonId: "late" }, undefined, new Date("2026-12-01T00:00:00Z")),
    ]);
    const { from, to } = parseRange({ from: "2026-11-01", to: "2026-11-05" });
    await signInAsAdmin();
    const r = await funnelReport(from, to);
    expect(r.steps.map((s) => [s.step, s.people, s.fromPrevious])).toEqual([
      ["visit", 4, null],
      ["signed_in", 3, 75],
      ["hackatime_connected", 1, 33.3],
      ["form_started", 2, 200],
      ["submitted", 2, 100],
      ["decided", 1, 50],
    ]);
    expect(r.submittedByKind).toEqual({ project: 1, aid: 1 });
    expect(r.decidedByOutcome).toEqual({ approved: 1 });
  });

  it("defaults to the last 30 days and treats the end date as inclusive", () => {
    const { from, to } = parseRange({}, new Date("2026-11-10T15:00:00Z"));
    expect(from.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-11T00:00:00.000Z");
    expect(parseRange({ from: "garbage", to: "2026-02-31x" }, new Date("2026-11-10T00:00:00Z")).to.toISOString()).toBe(
      "2026-11-11T00:00:00.000Z",
    );
  });
});
