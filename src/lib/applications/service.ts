import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type Db } from "@/db";
import { aidClaims, applications, CREDITED_SECONDS, programBans, users } from "@/db/schema";
import { decrypt, encrypt, hcIdHash } from "@/lib/crypto";
import { recordFunnelEvent } from "@/lib/funnel";
import { lockUser, type Tx } from "@/lib/locks";
import { isTiedPartner, lockForApplication, onPendingDelete, teamForSubmit } from "@/lib/teams/service";
import {
  eligibleProjects,
  fetchHackatimeId,
  fetchProjects,
  HackatimeUnavailableError,
  userHackatimeIdBinding,
} from "@/lib/hackatime";
import {
  validateApplication,
  type ApplicationContent,
  type ApplicationInput,
  type ApplicationKind,
  type ApplicationStatus,
  type FieldErrors,
} from "./shared";
import { checkYouTubeVideo } from "./youtube";


export const contentBinding = (id: string) => ({ table: "applications", column: "content_enc", rowId: id });
export const noteBinding = (id: string) => ({ table: "applications", column: "note_enc", rowId: id });
export const justificationBinding = (id: string) => ({ table: "applications", column: "justification_enc", rowId: id });
export const hackatimeIdBinding = (id: string) => ({ table: "applications", column: "hackatime_id_enc", rowId: id });

export type Applicant = { id: string; hcId: string };

export type ApplicationView = {
  id: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  content: ApplicationContent;
  note: string | null;
  hackatimeSecondsSnapshot: number | null;
  /** Hackatime account id at submission; null for aid, or if Hackatime didn't return one. */
  hackatimeId: string | null;
  creditedSeconds: number | null;
  createdAt: Date;
  decidedAt: Date | null;
};

type Row = typeof applications.$inferSelect;

export function toView(row: Row): ApplicationView {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    content: decrypt<ApplicationContent>(row.contentEnc, contentBinding(row.id)),
    note: row.noteEnc ? decrypt<string>(row.noteEnc, noteBinding(row.id)) : null,
    hackatimeSecondsSnapshot: row.hackatimeSecondsSnapshot,
    hackatimeId: row.hackatimeIdEnc ? decrypt<string>(row.hackatimeIdEnc, hackatimeIdBinding(row.id)) : null,
    creditedSeconds: row.creditedSeconds,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  };
}

async function liveRow(userId: string, tx: Db | Tx = db()): Promise<Row | undefined> {
  const [row] = await tx
    .select()
    .from(applications)
    .where(and(eq(applications.userId, userId), isNull(applications.supersededById)))
    .limit(1);
  return row;
}

/** A live application can be replaced by a new one after "Needs changes" or "didn't make the cut". */
export const canReplace = (status: ApplicationStatus) => status === "rejected_malformed" || status === "rejected_cut";

function aidAllowed(hasClaim: boolean, live: Pick<Row, "kind" | "status"> | undefined) {
  return !hasClaim || (live?.kind === "aid" && live.status === "rejected_malformed");
}

export type ApplicantState = {
  live: ApplicationView | null;
  /** True when the user may submit now (no live app, or the live app needs changes). */
  canSubmit: boolean;
  /** True when the aid path is open to them. */
  aidAvailable: boolean;
  /** Banned from the program after a fraud rejection. */
  banned: boolean;
};

/** Fraud bans are permanent: no new applications and no joining teams. */
export async function isBanned(conn: Db | Tx, userId: string): Promise<boolean> {
  const [row] = await conn.select({ id: programBans.userId }).from(programBans).where(eq(programBans.userId, userId)).limit(1);
  return !!row;
}

export async function getApplicantState(user: Applicant): Promise<ApplicantState> {
  const [live, claim, banned] = await Promise.all([
    liveRow(user.id),
    db().query.aidClaims.findFirst({ where: eq(aidClaims.hcIdHash, hcIdHash(user.hcId)) }),
    isBanned(db(), user.id),
  ]);
  return {
    live: live ? toView(live) : null,
    canSubmit: !banned && (!live || canReplace(live.status)),
    aidAvailable: !banned && aidAllowed(!!claim, live),
    banned,
  };
}

export type SubmitResult = { ok: true; id: string } | { ok: false; errors: FieldErrors };

/**
 * Validates and stores an application, enforcing: one live application, the 2-hour
 * Hackatime check, the YouTube check, the one-aid-attempt rule, and supersede-on-resubmit.
 */
export async function submitApplication(
  user: Applicant,
  input: ApplicationInput,
  hackatimeToken: string | null,
  /** The team version the form showed, or null if it showed no team. */
  teamVersion: number | null = null,
): Promise<SubmitResult> {
  const checked = validateApplication(input);
  if (!checked.ok) return checked;
  const { kind, content } = checked.value;

  let snapshot: number | null = null;
  let hackatimeId: string | null = null;
  if (kind === "project") {
    if (!hackatimeToken) {
      return { ok: false, errors: { hackatimeProject: "reconnect hackatime so we can confirm your hours, then submit again" } };
    }
    try {
      const [projects, id] = await Promise.all([fetchProjects(hackatimeToken), fetchHackatimeId(hackatimeToken)]);
      hackatimeId = id;
      const match = eligibleProjects(projects).find(
        (p) => p.name === content.hackatimeProject,
      );
      if (!match) {
        return { ok: false, errors: { hackatimeProject: "that project isn't one of your hackatime projects with 2+ hours" } };
      }
      snapshot = match.totalSeconds;
    } catch (e) {
      if (e instanceof HackatimeUnavailableError) return { ok: false, errors: { hackatimeProject: e.message.toLowerCase() } };
      throw e;
    }
  } else {
    const yt = await checkYouTubeVideo(content.videoUrl);
    if (yt === "not_found") {
      return { ok: false, errors: { videoUrl: "we couldn't find that video. make sure it's unlisted, not private" } };
    }
    if (yt === "unreachable") {
      return { ok: false, errors: { videoUrl: "we couldn't reach youtube to check your video. try again in a minute" } };
    }
  }

  const id = randomUUID();
  const hash = hcIdHash(user.hcId);
  return db().transaction(async (tx) => {
    await lockUser(tx, user.id);
    if (await isBanned(tx, user.id)) {
      return { ok: false, errors: { form: "you can't apply to FELLOWS FUND™" } } as SubmitResult;
    }
    if (await isTiedPartner(tx, user.id)) {
      return {
        ok: false,
        errors: { form: "you're a partner on someone else's team, so you can't apply on your own right now" },
      } as SubmitResult;
    }
    const live = await liveRow(user.id, tx);
    if (live && !canReplace(live.status)) {
      return { ok: false, errors: { form: "you've already applied. check your submission for its status" } } as SubmitResult;
    }
    if (kind === "aid") {
      const [claim] = await tx.select().from(aidClaims).where(eq(aidClaims.hcIdHash, hash)).limit(1);
      if (!aidAllowed(!!claim, live)) {
        return { ok: false, errors: { form: "financial aid can only be requested once" } } as SubmitResult;
      }
    }
    // Checked before anything is written: returning from the transaction commits.
    const team = await teamForSubmit(tx, user.id, teamVersion);
    if (team === "stale") {
      return {
        ok: false,
        errors: { team: "your team changed since you opened this page. check who's on it, then submit again" },
      } as SubmitResult;
    }
    if (kind === "aid") await tx.insert(aidClaims).values({ hcIdHash: hash }).onConflictDoNothing();
    // The live-application index isn't deferrable: retire the old row (pointing at itself)
    // before inserting, then point it at its replacement.
    if (live) await tx.update(applications).set({ supersededById: live.id }).where(eq(applications.id, live.id));
    await tx.insert(applications).values({
      id,
      userId: user.id,
      kind,
      contentEnc: encrypt(content, contentBinding(id)),
      hackatimeSecondsSnapshot: snapshot,
      hackatimeIdEnc: hackatimeId ? encrypt(hackatimeId, hackatimeIdBinding(id)) : null,
      creditedSeconds: kind === "project" ? CREDITED_SECONDS : null,
      teamId: team.teamId,
    });
    await lockForApplication(tx, id, team);
    if (hackatimeId) {
      await tx
        .update(users)
        .set({ hackatimeIdEnc: encrypt(hackatimeId, userHackatimeIdBinding(user.id)) })
        .where(eq(users.id, user.id));
    }
    if (live) await tx.update(applications).set({ supersededById: id }).where(eq(applications.id, live.id));
    await recordFunnelEvent("submitted", { userId: user.id, meta: { kind }, dedupeKey: `submitted:${id}` }, tx);
    return { ok: true, id } as SubmitResult;
  });
}

export type DeleteResult = { ok: true } | { ok: false; reason: "not_found" | "decided" };

/** Deletes the user's live application only while it's pending. The aid claim, if any, stays. Partners are released. */
export async function deleteApplication(user: Applicant): Promise<DeleteResult> {
  return db().transaction(async (tx) => {
    await lockUser(tx, user.id);
    const live = await liveRow(user.id, tx);
    if (!live) return { ok: false, reason: "not_found" } as const;
    if (live.status !== "submitted") return { ok: false, reason: "decided" } as const;
    // A deleted resubmission hands "live" back to the application it replaced. Point that
    // predecessor at itself (FK-safe, still not live), delete, then make it live again.
    const [prev] = await tx
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(eq(applications.supersededById, live.id))
      .limit(1);
    if (prev) await tx.update(applications).set({ supersededById: prev.id }).where(eq(applications.id, prev.id));
    await tx.delete(applications).where(and(eq(applications.id, live.id), eq(applications.status, "submitted")));
    if (prev) await tx.update(applications).set({ supersededById: null }).where(eq(applications.id, prev.id));
    // Back to "Needs changes": the team reopens. Otherwise (no predecessor, or a reapplication
    // after a cut, whose old team was already released) the new team is dissolved.
    await onPendingDelete(tx, live.teamId, prev?.status === "rejected_malformed");
    return { ok: true } as const;
  });
}

export async function getApplicationView(id: string): Promise<ApplicationView | null> {
  const [row] = await db().select().from(applications).where(eq(applications.id, id)).limit(1);
  return row ? toView(row) : null;
}

/** Earlier applications this one replaced (newest first), for history views. */
export async function predecessorsOf(applicationId: string): Promise<ApplicationView[]> {
  const out: ApplicationView[] = [];
  let current = applicationId;
  for (let i = 0; i < 50; i++) {
    const [prev] = await db()
      .select()
      .from(applications)
      .where(eq(applications.supersededById, current))
      .orderBy(desc(applications.createdAt))
      .limit(1);
    if (!prev || prev.id === current) break;
    out.push(toView(prev));
    current = prev.id;
  }
  return out;
}
