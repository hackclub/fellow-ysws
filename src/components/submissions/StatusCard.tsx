import Link from "next/link";
import type { ReactNode } from "react";
import type { ApplicationView } from "@/lib/applications/service";
import { letterOutcome, longDate } from "@/lib/applications/portal";
import { ApplicationDetails, FEE_MODE_LABEL, PartnerProjectDetails } from "./ApplicationDetails";
import { DeleteButton } from "./DeleteButton";
import { TeamMembers } from "./TeamMembers";
import type { Member, MemberProject } from "@/lib/teams/service";

/** Bordered status box: eyebrow, "Plain *italic*." title, body, and an optional action. */
export function StatusBox({
  eyebrow,
  title: [plain, italic],
  fresh = false,
  children,
}: {
  eyebrow?: string;
  title: [string, string];
  fresh?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="status-box">
      {eyebrow && <p className={fresh ? "status-eyebrow fresh" : "status-eyebrow"}>{eyebrow}</p>}
      <h3 className="status-title">
        <span data-testid="status-label">
          {plain} <em>{italic}</em>
        </span>
        .
      </h3>
      {children}
    </div>
  );
}

/**
 * Applicant-facing status and application contents, with the actions allowed for this status.
 * Partners see everything but get no actions: only the founder deletes or resubmits.
 */
export function StatusCard({
  app,
  members = [],
  viewer = "founder",
  decisionSeen = false,
  ownProject = null,
  banned = true,
  bookingUrl = null,
}: {
  app: ApplicationView;
  members?: Member[];
  /** For a partner on an "each pays" application: their own submitted project. */
  ownProject?: MemberProject | null;
  /** Whether the viewer is banned. A fraud rejection that banned a teammate lets the founder start over. */
  banned?: boolean;
  viewer?: "founder" | "partner";
  /** The viewer has opened this decision's letter, so the outcome isn't a surprise any more. */
  decisionSeen?: boolean;
  /** The founder's prefilled interview booking link. Partners don't get one: the founder books. */
  bookingUrl?: string | null;
}) {
  const founder = viewer === "founder";
  const decided = letterOutcome(app);
  const update = app.decidedAt ? `New update · ${longDate(app.decidedAt)}` : undefined;

  return (
    <>
      <section className="stack" aria-labelledby="status-heading">
        <h2 id="status-heading">Application status:</h2>
        {app.status === "rejected_fraud" && banned ? (
          <StatusBox eyebrow={app.decidedAt ? `Decided · ${longDate(app.decidedAt)}` : undefined} title={["Not", "accepted"]}>
            <p className="status-body">this application wasn&apos;t accepted, and you can&apos;t apply to FELLOWS FUND™ again.</p>
          </StatusBox>
        ) : app.status === "rejected_fraud" ? (
          <StatusBox eyebrow={app.decidedAt ? `Decided · ${longDate(app.decidedAt)}` : undefined} title={["Not", "accepted"]}>
            <p className="status-body" data-testid="fraud-not-at-fault">
              this application wasn&apos;t accepted because of a problem with someone else on the team. it isn&apos;t
              held against you: you can start a new application whenever you&apos;re ready.
            </p>
            {founder && (
              <div className="status-actions">
                <Link href="/apply" className="button">
                  Start a new application
                </Link>
              </div>
            )}
          </StatusBox>
        ) : decided === "rejected" && decisionSeen ? (
          <StatusBox eyebrow={app.decidedAt ? `Decided · ${longDate(app.decidedAt)}` : undefined} title={["Apply", "again"]}>
            <p className="status-body">
              this round didn&apos;t work out, but it isn&apos;t the end of your project. you can apply again whenever
              you&apos;re ready, with everything you&apos;ve built since.
              {founder && app.kind === "aid" && " financial aid can only be requested once, so your next application needs a hackatime project."}
            </p>
            <div className="status-actions">
              {founder && (
                <Link href="/apply" className="button">
                  Start a new application
                </Link>
              )}
              <Link href="/submissions/decision" className="text-link small">
                Reread your letter
              </Link>
            </div>
          </StatusBox>
        ) : decided === "interview" && decisionSeen ? (
          <StatusBox eyebrow={app.decidedAt ? `Invited · ${longDate(app.decidedAt)}` : undefined} title={["Second", "round"]}>
            <p className="status-body">
              {founder
                ? "you're invited to a second-round interview. book a time for your whole team. we'll post our final decision here after the call."
                : "you're invited to a second-round interview. your founder will book it for the team, and you'll join them on the call."}
            </p>
            <div className="status-actions">
              {founder && bookingUrl && (
                <a href={bookingUrl} className="button" target="_blank" rel="noopener noreferrer" data-testid="book-interview">
                  Book your interview
                </a>
              )}
              <Link href="/submissions/decision" className="text-link small">
                Reread your letter
              </Link>
            </div>
          </StatusBox>
        ) : decided === "admitted" && decisionSeen ? (
          <StatusBox eyebrow={app.decidedAt ? `Decided · ${longDate(app.decidedAt)}` : undefined} title={["You're", "in"]}>
            <p className="status-body">welcome to FELLOWS FUND™. we&apos;ll be in touch on slack with next steps.</p>
            <div className="status-actions">
              <Link href="/submissions/decision" className="text-link small">
                Reread your letter
              </Link>
            </div>
          </StatusBox>
        ) : decided ? (
          <StatusBox eyebrow={update} title={["Decision", "ready"]} fresh>
            <p className="status-body">an update has been posted to your application. open it when you&apos;re ready.</p>
            <div>
              <Link href="/submissions/decision" className="button">
                View your decision
              </Link>
            </div>
          </StatusBox>
        ) : app.status === "rejected_malformed" ? (
          <StatusBox eyebrow={update} title={["Needs", "changes"]} fresh>
            {app.note && (
              <div className="status-note">
                <span className="field-label">A note from the team</span>
                <p style={{ whiteSpace: "pre-wrap" }} data-testid="reviewer-note">
                  {app.note}
                </p>
              </div>
            )}
            <p className="status-body">
              {founder
                ? "fix what the note asks for and resubmit. your application keeps its place."
                : "the founder will fix and resubmit the application. your team is open again until then."}
            </p>
            {founder && (
              <div>
                <Link href="/apply" className="button">
                  Fix &amp; resubmit
                </Link>
              </div>
            )}
          </StatusBox>
        ) : (
          <StatusBox eyebrow={`Submitted · ${longDate(app.createdAt)}`} title={["Under", "review"]}>
            <p className="status-body">we&apos;ll review it and update this page. there&apos;s nothing else you need to do.</p>
          </StatusBox>
        )}
      </section>

      {members.length > 1 && <TeamMembers members={members} />}
      {members.length > 1 && app.kind === "project" && (
        <p className="small muted" data-testid="fee-mode">
          fee: {FEE_MODE_LABEL[app.feeMode]}.
        </p>
      )}

      <section className="stack" aria-labelledby="application-heading">
        <h2 id="application-heading">Your application:</h2>
        <ApplicationDetails app={app} />
      </section>

      {ownProject && (
        <section className="stack" aria-labelledby="own-project-heading">
          <h2 id="own-project-heading">Your project:</h2>
          <PartnerProjectDetails
            content={ownProject.content}
            snapshotSeconds={ownProject.snapshotSeconds}
            creditedSeconds={ownProject.creditedSeconds}
          />
        </section>
      )}

      {founder && app.status === "submitted" && (
        <div>
          <DeleteButton kind={app.kind} />
        </div>
      )}
    </>
  );
}
