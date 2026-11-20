import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/db";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { makeUser, projectInput, signInAsAdmin } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const { decide } = await import("@/lib/admin/service");
const { getApplicationView, submitApplication } = await import("./service");
const { decisionSeen, letterOutcome } = await import("./portal");
const { markDecisionSeenAction } = await import("@/app/submissions/actions");
const { createSession } = await import("@/lib/auth/session");

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

describe("decision letters across the interview", () => {
  it("reveals the round-two decision even after the interview letter was read", async () => {
    const admin = await signInAsAdmin();
    const u = await makeUser();
    fake.tokens.set(`t-${u.id}`, { sub: u.hcId });
    fake.projects.set(u.hcId, [{ name: "big-project", total_seconds: 9000 }]);
    const r = await submitApplication(u, projectInput, `t-${u.id}`);
    if (!r.ok) throw new Error("setup");
    await decide(r.id, "approve", "", "first pass");

    let app = await getApplicationView(r.id);
    expect(letterOutcome(app)).toBe("interview");
    expect(await decisionSeen(app)).toBe(false);
    await createSession(u.id);
    await markDecisionSeenAction();
    expect(await decisionSeen(app)).toBe(true);

    await createSession(admin.id);
    await decide(r.id, "select", "", "great call");
    app = await getApplicationView(r.id);
    expect(letterOutcome(app)).toBe("admitted");
    expect(await decisionSeen(app)).toBe(false);
  });
});
