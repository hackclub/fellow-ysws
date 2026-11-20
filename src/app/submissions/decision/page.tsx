import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkDecisionSeen } from "@/components/portal/MarkDecisionSeen";
import { Seal } from "@/components/portal/Seal";
import { LETTER_CLOSING, SIGNER_NAME, SIGNER_TITLE, interviewBookingUrl, letterBody } from "@/content/portal";
import { requireUser } from "@/lib/auth/guards";
import { firstName, getPortalState, letterOutcome, longDate } from "@/lib/applications/portal";

export const metadata = { title: "Your decision — Hack Club Fellows Fund™" };

export default async function DecisionPage() {
  const user = await requireUser("/submissions/decision");
  const { app, partner } = await getPortalState(user);
  const outcome = letterOutcome(app);
  if (!app || !outcome) redirect("/submissions");

  const name = firstName(user.name);

  return (
    <main className="container page letter-page">
      <div>
        <Link href="/submissions" className="text-link muted small">
          ← Back to your portal
        </Link>
      </div>

      {app.decidedAt && <p className="letter-date">{longDate(app.decidedAt)}</p>}

      <article className="letter" data-testid="decision-letter" data-outcome={outcome} aria-label="Decision letter">
        <header className="letter-head">
          <Seal />
          <p className="letter-org">Hack Club Fellows Fund™</p>
        </header>

        <div className="letter-body">
          <p>Dear {name ?? "applicant"},</p>
          {letterBody(outcome, app.kind).map((para) => (
            <p key={para}>{para}</p>
          ))}
          {app.note && (
            <aside className="letter-note" aria-labelledby="letter-note-title">
              <p id="letter-note-title" className="letter-note-title">
                A note from the team
              </p>
              <p data-testid="reviewer-note">{app.note}</p>
            </aside>
          )}
          <p>{LETTER_CLOSING[outcome]}</p>
        </div>

        <footer className="letter-sign">
          <p className="signature" aria-hidden="true">
            {SIGNER_NAME}
          </p>
          <p>{SIGNER_NAME}</p>
          <p className="muted">{SIGNER_TITLE}, Hack Club Fellows Fund™</p>
        </footer>
      </article>

      {outcome === "interview" && (
        <div className="letter-next stack-sm" data-testid="interview-next">
          {partner ? (
            <p>your founder will book the interview for the team. you&apos;ll join them on the call.</p>
          ) : (
            <>
              <p>pick a time that works for your whole team.</p>
              <div>
                <a
                  href={interviewBookingUrl({ name: user.name, email: user.email, applicationId: app.id })}
                  className="button"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="book-interview"
                >
                  Book your interview
                </a>
              </div>
            </>
          )}
        </div>
      )}
      {outcome === "rejected" && !partner && (
        <div className="letter-next stack-sm">
          <p>you can apply again whenever you&apos;re ready.</p>
          <div>
            <Link href="/apply" className="button">
              Start a new application
            </Link>
          </div>
        </div>
      )}
      <MarkDecisionSeen />
    </main>
  );
}
