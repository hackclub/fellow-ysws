import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { applicationMembers, applications, users } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { piiBinding } from "@/lib/auth/session";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, makeUser, projectInput, signInAsAdmin, testAddress } from "../../../test/factories";
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
  it("syncs projects invited to interview and cut projects only, once each", async () => {
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
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 2, failed: 0, errors: [], missingAddress: 0 });
    expect(fake.airtable.map((r) => r.fields["Justification - Additional Justification"]).sort()).toEqual(["great demo", "too thin"]);
    expect(fake.airtable[0].fields).toMatchObject({
      "Justification - Submitter Hackatime ID": "8997",
      "Optional - Override Hours Spent": 2,
      "Address (Line 1)": "15 Falls Rd",
      City: "Shelburne",
      "State / Province": "VT",
      "ZIP / Postal Code": "05482",
      Country: "US",
    });

    const [row] = await db().select().from(applications).where(eq(applications.id, approved));
    expect(row.airtableRecordId).toMatch(/^rec/);
    expect(row.airtableSyncedAt).toBeInstanceOf(Date);

    // nothing left: a second sync creates nothing
    expect(await countPendingSync()).toBe(0);
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 0, failed: 0, errors: [], missingAddress: 0 });
    expect(fake.airtable).toHaveLength(2);
  });

  it("takes the project at the interview invite, and the round-two decision creates nothing more", async () => {
    await admin();
    const selected = await project();
    const cutLater = await project();
    await decide(selected, "approve", "", "first pass");
    await decide(cutLater, "approve", "", "first pass");
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 2, failed: 0, errors: [], missingAddress: 0 });
    const before = await db().select().from(applications).where(eq(applications.id, selected));

    await decide(selected, "select", "", "great call");
    await decide(cutLater, "reject_cut", "not this round", "weak call");
    expect(await countPendingSync()).toBe(0);
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 0, failed: 0, errors: [], missingAddress: 0 });
    expect(fake.airtable).toHaveLength(2);
    expect(fake.airtable.map((r) => r.fields["Justification - Additional Justification"])).toEqual(["first pass", "first pass"]);
    const [after] = await db().select().from(applications).where(eq(applications.id, selected));
    expect(after.airtableRecordId).toBe(before[0].airtableRecordId);
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

  it("holds back applicants with no mailing address until they have one", async () => {
    await admin();
    const u = await makeUser(undefined, { address: null });
    fake.tokens.set(`t-${u.id}`, { sub: u.hcId });
    fake.projects.set(u.hcId, [{ name: "big-project", total_seconds: 5 * 3600 }]);
    fake.hackatimeIds.set(u.hcId, 8997);
    const r = await submitApplication(u, projectInput, `t-${u.id}`);
    if (!r.ok) throw new Error("setup");
    await decide(r.id, "approve", "", "great demo");
    await decide(await project(), "approve", "", "has an address");

    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 1, failed: 0, errors: [], missingAddress: 1 });
    expect(fake.airtable).toHaveLength(1);
    expect(await countPendingSync()).toBe(1);

    // they sign in again and Hack Club Auth now sends an address
    await db().update(users).set({ piiEnc: encrypt({ hcId: u.hcId, name: "N", email: "n@x.dev", slackId: null, address: testAddress }, piiBinding(u.id)) }).where(eq(users.id, u.id));
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 1, failed: 0, errors: [], missingAddress: 0 });
    expect(await countPendingSync()).toBe(0);
  });
});

describe("syncReviewsToAirtable — everyone pays for themselves", () => {
  let nextId = 5000;
  async function person(project: string, hours: number) {
    const u = await makeUser();
    const token = `t-${u.id}`;
    fake.tokens.set(token, { sub: u.hcId });
    fake.projects.set(u.hcId, [{ name: project, total_seconds: hours * 3600 }]);
    fake.hackatimeIds.set(u.hcId, nextId++);
    return { ...u, token };
  }

  /** A founder plus `partners` partners; in each-pays mode every partner saves their own project. */
  async function teamApp(partners: number, mode: "each_pays" | "founder_pays") {
    const { savePartnerProjectFromForm } = await import("@/lib/teams/partner-project");
    const founder = await person("big-project", 14);
    const formed = await teams.formTeam(founder);
    if (!formed.ok) throw new Error("setup");
    const ps = [];
    for (let i = 0; i < partners; i++) {
      const p = await person(`partner-${i}`, 3);
      await teams.joinTeam(p, formed.team.inviteToken!);
      ps.push(p);
    }
    await teams.setFeeMode(founder, mode);
    if (mode === "each_pays") {
      for (const [i, p] of ps.entries()) {
        const r = await savePartnerProjectFromForm(
          p,
          {
            hackatimeProject: `partner-${i}`,
            codeUrl: `https://github.com/p${i}/partner-${i}`,
            playableUrl: "https://p.example.com",
            description: `partner ${i}'s project`,
            heardFrom: "a friend",
          },
          p.token,
        );
        if (!r.ok) throw new Error(JSON.stringify(r.errors));
      }
    }
    const v = (await teams.getMyTeam(founder.id))!.team.version;
    const r = await submitApplication(founder, projectInput, founder.token, v);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return { id: r.id, founder, partners: ps };
  }

  it("creates one record per member, each with their own details and 2h credited", async () => {
    await admin();
    const { id, partners } = await teamApp(2, "each_pays");
    await decide(id, "approve", "", "solid team");
    expect(await countPendingSync()).toBe(3);
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 3, failed: 0, errors: [], missingAddress: 0 });
    expect(fake.airtable).toHaveLength(3);
    expect(fake.airtable.map((r) => r.fields["Optional - Override Hours Spent"])).toEqual([2, 2, 2]);
    expect(fake.airtable.map((r) => r.fields["Code URL"]).sort()).toEqual(
      [projectInput.codeUrl, "https://github.com/p0/partner-0", "https://github.com/p1/partner-1"].sort(),
    );
    for (const p of partners) {
      const rec = fake.airtable.find((r) => r.fields["Justification - Submitter Hackatime ID"] === String(fake.hackatimeIds.get(p.hcId)));
      expect(rec?.fields).toMatchObject({ "Justification - Additional Justification": "solid team" });
    }
    const members = await db().select().from(applicationMembers).where(eq(applicationMembers.applicationId, id));
    expect(members.filter((m) => m.role === "partner").every((m) => m.airtableRecordId?.startsWith("rec"))).toBe(true);
    expect(await countPendingSync()).toBe(0);
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 0, failed: 0, errors: [], missingAddress: 0 });
  });

  it("creates one record with the whole fee for a founder-pays team", async () => {
    await admin();
    const { id } = await teamApp(2, "founder_pays");
    await decide(id, "approve", "", "ok");
    expect(await countPendingSync()).toBe(1);
    await syncReviewsToAirtable();
    expect(fake.airtable).toHaveLength(1);
    expect(fake.airtable[0].fields["Optional - Override Hours Spent"]).toBe(6);
  });

  it("only creates the records that are still missing after a partial sync", async () => {
    await admin();
    const { id } = await teamApp(2, "each_pays");
    await decide(id, "approve", "", "ok");
    // The founder's record made it last time; the partners' didn't.
    await db().update(applications).set({ airtableRecordId: "recEXISTING000000", airtableSyncedAt: new Date() }).where(eq(applications.id, id));
    expect(await countPendingSync()).toBe(2);
    fake.airtableFailStatus = 503;
    expect(await syncReviewsToAirtable()).toMatchObject({ ok: true, synced: 0, failed: 2 });
    expect(await syncReviewsToAirtable()).toEqual({ ok: true, synced: 2, failed: 0, errors: [], missingAddress: 0 });
    expect(fake.airtable).toHaveLength(2);
    expect(fake.airtable.every((r) => r.fields["Code URL"] !== projectInput.codeUrl)).toBe(true);
  });
});
