import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { applications, CREDITED_SECONDS, teamMembers, teams, users } from "@/db/schema";
import { resetDb } from "../../test/db";

async function makeUser() {
  const id = randomUUID();
  await db().insert(users).values({ id, hcIdHash: `h-${id}`, piiEnc: "x" });
  return id;
}

const projectApp = (userId: string) => ({
  id: randomUUID(),
  userId,
  kind: "project" as const,
  contentEnc: "x",
  hackatimeSecondsSnapshot: 9000,
  creditedSeconds: CREDITED_SECONDS,
});

/** drizzle wraps driver errors; the Postgres constraint name lives on `cause`. */
async function constraintOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    const err = e as { cause?: { constraint?: string }; constraint?: string };
    return err.cause?.constraint ?? err.constraint;
  }
  return undefined;
}

beforeEach(resetDb);
afterAll(closeDb);

describe("database constraints", () => {
  it("refuses a second live application for the same user", async () => {
    const u = await makeUser();
    await db().insert(applications).values(projectApp(u));
    expect(await constraintOf(db().insert(applications).values(projectApp(u)))).toBe(
      "applications_one_live_per_user",
    );
  });

  it("allows a new live application once the old one is superseded", async () => {
    const u = await makeUser();
    const admin = await makeUser();
    const old = projectApp(u);
    await db().insert(applications).values(old);
    await db()
      .update(applications)
      .set({ status: "rejected_malformed", noteEnc: "n", decidedAt: new Date(), decidedByUserId: admin })
      .where(eq(applications.id, old.id));
    const next = projectApp(u);
    await db().transaction(async (tx) => {
      await tx.update(applications).set({ supersededById: old.id }).where(eq(applications.id, old.id));
      await tx.insert(applications).values(next);
      await tx.update(applications).set({ supersededById: next.id }).where(eq(applications.id, old.id));
    });
    const rows = await db().select().from(applications).where(eq(applications.userId, u));
    expect(rows).toHaveLength(2);
  });

  it("refuses a rejection without a note", async () => {
    const u = await makeUser();
    const admin = await makeUser();
    const a = projectApp(u);
    await db().insert(applications).values(a);
    for (const status of ["rejected_cut", "rejected_malformed"] as const) {
      expect(
        await constraintOf(
          db()
            .update(applications)
            .set({ status, decidedAt: new Date(), decidedByUserId: admin })
            .where(eq(applications.id, a.id)),
        ),
      ).toBe("applications_rejection_needs_note");
    }
  });

  it("refuses project applications under 2 hours and aid applications with hours", async () => {
    const u = await makeUser();
    expect(
      await constraintOf(db().insert(applications).values({ ...projectApp(u), hackatimeSecondsSnapshot: 7199 })),
    ).toBe("applications_hours_match_kind");
    expect(
      await constraintOf(db().insert(applications).values({ ...projectApp(u), kind: "aid" })),
    ).toBe("applications_hours_match_kind");
  });

  it("accepts a fee that is a multiple of 2 hours and covered by the snapshot", async () => {
    // 2h (the old flat fee) and 8h (a team of 4) both pass.
    await db().insert(applications).values(projectApp(await makeUser()));
    await db()
      .insert(applications)
      .values({ ...projectApp(await makeUser()), hackatimeSecondsSnapshot: 8 * 3600, creditedSeconds: 8 * 3600 });
  });

  it("refuses a fee that isn't a multiple of 2 hours or exceeds the snapshot", async () => {
    expect(
      await constraintOf(db().insert(applications).values({ ...projectApp(await makeUser()), creditedSeconds: 3 * 3600 })),
    ).toBe("applications_hours_match_kind");
    expect(
      await constraintOf(
        db()
          .insert(applications)
          .values({ ...projectApp(await makeUser()), hackatimeSecondsSnapshot: 5 * 3600, creditedSeconds: 6 * 3600 }),
      ),
    ).toBe("applications_hours_match_kind");
  });

  it("allows a person to be active on only one team", async () => {
    const founderA = await makeUser();
    const founderB = await makeUser();
    const partner = await makeUser();
    const team = (founder: string) => ({ id: randomUUID(), founderUserId: founder, inviteTokenHash: randomUUID(), inviteTokenEnc: "x" });
    const [a, b] = [team(founderA), team(founderB)];
    await db().insert(teams).values([a, b]);
    await db().insert(teamMembers).values({ teamId: a.id, userId: partner, role: "partner" });
    expect(
      await constraintOf(db().insert(teamMembers).values({ teamId: b.id, userId: partner, role: "partner" })),
    ).toBe("team_members_one_active_team");
    // Once released, the same person can join another team.
    await db().update(teamMembers).set({ releasedAt: new Date() }).where(eq(teamMembers.userId, partner));
    await db().insert(teamMembers).values({ teamId: b.id, userId: partner, role: "partner" });
  });
});
