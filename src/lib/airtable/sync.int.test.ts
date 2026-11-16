import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { applications } from "@/db/schema";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, makeUser, projectInput, signInAsAdmin } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const { decide } = await import("@/lib/admin/service");
const { submitApplication } = await import("@/lib/applications/service");
const { countPendingSync, syncReviewsToAirtable } = await import("./sync");
const teams = await import("@/lib/teams/service");

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

const admin = signInAsAdmin;

async function project(name = "big-project") {
  const u = await makeUser();
  fake.tokens.set(`t-${u.id}`, { sub: u.hcId });
  fake.projects.set(u.hcId, [{ name, total_seconds: 5 * 3600 }]);
  fake.hackatimeIds.set(u.hcId, 8997);
  const r = await submitApplication(u, projectInput, `t-${u.id}`);
  if (!r.ok) throw new Error("setup");
  return r.id;
}

async function aid() {
  const r = await submitApplication(await makeUser(), aidInput, null);
  if (!r.ok) throw new Error("setup");
  return r.id;
}

describe("syncReviewsToAirtable", () => {
  it("syncs approved and cut projects only, once each", async () => {
    await admin();
    const approved = await project();
    const cut = await project();
    const malformed = await project();
    const fraud = await project();
    await project(); // still pending
    const approvedAid = await aid();
    await decide(approved, "approve", "", "great demo");
    await decide(cut, "reject_cut", "not this time", "too thin");
    await decide(malformed, "reject_malformed", "fix the link");
    await decide(fraud, "reject_fraud", "", "faked hours");
    await decide(approvedAid, "approve", "", "good pitch");

    expect(await countPendingSync()).toBe(2);
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 2, failed: 0, errors: [] });
    expect(fake.airtable.map((r) => r.fields["Justification - Additional Justification"]).sort()).toEqual(["great demo", "too thin"]);
    expect(fake.airtable[0].fields).toMatchObject({
      "Justification - Submitter Hackatime ID": "8997",
      "Optional - Override Hours Spent": 2,
    });

    const [row] = await db().select().from(applications).where(eq(applications.id, approved));
    expect(row.airtableRecordId).toMatch(/^rec/);
    expect(row.airtableSyncedAt).toBeInstanceOf(Date);

    // nothing left: a second sync creates nothing
    expect(await countPendingSync()).toBe(0);
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 0, failed: 0, errors: [] });
    expect(fake.airtable).toHaveLength(2);
  });

  it("sends each application's own credited hours", async () => {
    await admin();
    const founder = await makeUser();
    fake.tokens.set(`t-${founder.id}`, { sub: founder.hcId });
    fake.projects.set(founder.hcId, [{ name: "big-project", total_seconds: 9 * 3600 }]);
    const formed = await teams.formTeam(founder);
    if (!formed.ok) throw new Error("setup");
    for (let i = 0; i < 2; i++) {
      if (!(await teams.joinTeam(await makeUser(), formed.team.inviteToken!)).ok) throw new Error("setup");
    }
    const version = (await teams.getMyTeam(founder.id))!.team.version;
    const r = await submitApplication(founder, projectInput, `t-${founder.id}`, version);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    await decide(r.id, "approve", "", "solid team");

    expect(await syncReviewsToAirtable()).toMatchObject({ ok: true, synced: 1 });
    expect(fake.airtable[0].fields).toMatchObject({ "Optional - Override Hours Spent": 6 });
  });

  it("leaves reviews waiting when Airtable refuses them", async () => {
    await admin();
    await decide(await project(), "approve", "", "great demo");
    fake.airtableFailStatus = 422;
    const r = await syncReviewsToAirtable();
    expect(r).toMatchObject({ ok: true, synced: 0, failed: 1, errors: [expect.stringMatching(/422: boom/)] });
    expect(await countPendingSync()).toBe(1);
    expect((await syncReviewsToAirtable()).ok && fake.airtable).toHaveLength(1);
  });
});
