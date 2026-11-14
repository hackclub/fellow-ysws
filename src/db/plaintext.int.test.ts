import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { resetDb } from "../../test/db";
import { aidInput, forceDecision, makeUser, projectInput } from "../../test/factories";
import { fake, installFakeProviders } from "../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../test/cookie-jar")).nextHeadersMock());
const { submitApplication } = await import("@/lib/applications/service");

beforeEach(async () => {
  await resetDb();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

describe("data at rest", () => {
  it("has no readable PII, form content or notes in any table", async () => {
    const applicant = await makeUser("ident!SECRET-HCID");
    const aidUser = await makeUser("ident!SECRET-AID-HCID");
    const admin = await makeUser();
    fake.tokens.set("t", { sub: applicant.hcId });
    fake.projects.set(applicant.hcId, [{ name: "big-project", total_seconds: 9000 }]);
    fake.hackatimeIds.set(applicant.hcId, 987654321);

    const p = await submitApplication(applicant, { ...projectInput, playableUrl: "https://PLAINTEXT-PLAYABLE.example" }, "t");
    const a = await submitApplication(aidUser, aidInput, null);
    if (!p.ok || !a.ok) throw new Error("setup failed");
    await forceDecision(p.id, "rejected_cut", admin.id);

    const tables = ["users", "sessions", "applications", "aid_claims", "funnel_events"];
    const dump = (
      await Promise.all(tables.map((t) => db().execute(sql.raw(`SELECT row_to_json(x)::text AS j FROM ${t} x`))))
    )
      .flatMap((r) => r.rows.map((row) => String((row as { j: string }).j)))
      .join("\n");

    expect(dump.length).toBeGreaterThan(100);
    for (const secret of [
      "SECRET-HCID",
      "SECRET-AID-HCID",
      "Name ident", // names
      "@x.dev", // emails
      "github.com/orpheus",
      "PLAINTEXT-PLAYABLE",
      "PLAINTEXT-DESCRIPTION",
      "big-project",
      "PLAINTEXT-AID-REASON",
      "youtube",
      "PLAINTEXT-NOTE",
      "slack",
      "987654321", // hackatime id
    ]) {
      expect(dump, `found "${secret}" in plaintext`).not.toContain(secret);
    }
  });
});
