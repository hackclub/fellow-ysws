import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { funnelEvents } from "@/db/schema";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { makeUser } from "../../../test/factories";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const { formStartedAction } = await import("./actions");
const { createSession } = await import("@/lib/auth/session");

beforeEach(async () => {
  await resetDb();
  jar.clear();
});
afterAll(closeDb);

describe("form_started funnel event", () => {
  it("is recorded once per user however often it fires", async () => {
    const u = await makeUser();
    await createSession(u.id);
    await formStartedAction();
    await formStartedAction();
    const events = await db().select().from(funnelEvents);
    expect(events.map((e) => [e.step, e.userId])).toEqual([["form_started", u.id]]);
  });

  it("is ignored for signed-out visitors", async () => {
    await formStartedAction();
    expect(await db().select().from(funnelEvents)).toHaveLength(0);
  });
});
