import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { applications } from "@/db/schema";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, makeUser, projectInput } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const { decide } = await import("@/lib/admin/service");
const { loadUser } = await import("@/lib/auth/session");
const { submitApplication } = await import("@/lib/applications/service");
const { countPendingSync, syncReviewsToAirtable } = await import("./sync");

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

const admin = async () => (await loadUser((await makeUser("ident!admin1")).id))!;

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
    const a = await admin();
    const approved = await project();
    const cut = await project();
    const malformed = await project();
    const fraud = await project();
    await project(); // still pending
    const approvedAid = await aid();
    await decide(a, approved, "approve", "", "great demo");
    await decide(a, cut, "reject_cut", "not this time", "too thin");
    await decide(a, malformed, "reject_malformed", "fix the link");
    await decide(a, fraud, "reject_fraud", "", "faked hours");
    await decide(a, approvedAid, "approve", "", "good pitch");

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

  it("leaves reviews waiting when Airtable refuses them", async () => {
    const a = await admin();
    await decide(a, await project(), "approve", "", "great demo");
    fake.airtableFailStatus = 422;
    const r = await syncReviewsToAirtable();
    expect(r).toMatchObject({ ok: true, synced: 0, failed: 1, errors: [expect.stringMatching(/422: boom/)] });
    expect(await countPendingSync()).toBe(1);
    expect((await syncReviewsToAirtable()).ok && fake.airtable).toHaveLength(1);
  });
});
