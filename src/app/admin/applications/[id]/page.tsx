import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionForm } from "@/components/admin/DecisionForm";
import { TelescreenLink } from "@/components/admin/TelescreenLink";
import { ApplicationDetails } from "@/components/submissions/ApplicationDetails";
import { TeamMembers } from "@/components/submissions/TeamMembers";
import { getApplicationDetail } from "@/lib/admin/service";
import { airtableRecordUrl } from "@/lib/airtable/sync";
import { ADMIN_LABEL } from "@/lib/applications/shared";
import { requireAdmin } from "@/lib/auth/guards";

const fmt = (d: Date) => d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminApplication({ params }: PageProps<"/admin/applications/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/applications/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getApplicationDetail(id);
  if (!detail) notFound();
  const { app, applicant, applicantHackatimeId, airtable, banned, decidedBy, history, justification, live, members } = detail;
  const syncs = app.kind === "project" && (app.status === "approved" || app.status === "rejected_cut");
  const recordUrl = airtable ? airtableRecordUrl(airtable.recordId) : null;

  return (
    <div className="stack" style={{ gap: 32, maxWidth: 680 }}>
      <Link href="/admin" className="text-link small">← All applications</Link>
      <div className="stack-sm">
        <h1 style={{ fontSize: "2rem" }}>{applicant.name ?? "(no name)"}</h1>
        <p className="small muted">
          {applicant.email ?? "no email"} · slack {applicant.slackId ?? "—"} · {applicant.hcId}
        </p>
      </div>

      <div className="panel-row">
        <span>Status</span>
        <span className="status" data-status={app.status} data-testid="admin-status">{ADMIN_LABEL[app.status]}</span>
      </div>
      {app.decidedAt && (
        <p className="small" data-testid="decision-audit">
          decided by {decidedBy ?? "unknown"} on {fmt(app.decidedAt)}
        </p>
      )}
      {banned && (
        <p className="notice" role="status" data-testid="banned">
          this applicant is banned from the program (fraud).
        </p>
      )}
      {app.note && (
        <div className="panel stack-sm">
          <span className="field-label">Note to applicant</span>
          <p style={{ whiteSpace: "pre-wrap" }}>{app.note}</p>
        </div>
      )}
      {justification && (
        <div className="panel stack-sm">
          <span className="field-label">Justification (internal)</span>
          <p style={{ whiteSpace: "pre-wrap" }} data-testid="justification">{justification}</p>
        </div>
      )}
      {app.status !== "submitted" && (
        <p className="small muted" data-testid="airtable-status">
          {airtable ? (
            <>
              synced to airtable on {fmt(airtable.syncedAt)}
              {recordUrl && (
                <>
                  {" · "}
                  <a href={recordUrl} rel="noopener noreferrer" target="_blank">open record</a>
                </>
              )}
            </>
          ) : syncs ? (
            "waiting for the next airtable sync."
          ) : (
            "not synced to airtable (only approved and cut project reviews are)."
          )}
        </p>
      )}
      {!live && <p className="notice">this application was replaced by a resubmission.</p>}

      <TeamMembers members={members[app.id] ?? []} title="Team as submitted" />

      <ApplicationDetails app={app} />
      <TelescreenLink app={app} fallbackId={applicantHackatimeId} />

      {app.status === "submitted" && live && <DecisionForm id={app.id} />}

      {history.length > 0 && (
        <section className="stack" aria-labelledby="history">
          <h2 id="history">Earlier versions</h2>
          {history.map((h) => (
            <details key={h.id} className="panel">
              <summary className="caps">
                {ADMIN_LABEL[h.status]} · {fmt(h.createdAt)}
              </summary>
              <div className="stack" style={{ marginTop: 12 }}>
                {h.note && <p className="notice">note: {h.note}</p>}
                <TeamMembers members={members[h.id] ?? []} title="Team as submitted" />
                <ApplicationDetails app={h} />
                <TelescreenLink app={h} fallbackId={applicantHackatimeId} />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
