import { funnelReport, parseRange, STEP_LABEL } from "@/lib/admin/funnel";
import { ADMIN_LABEL, type ApplicationStatus } from "@/lib/applications/shared";
import { requireAdmin } from "@/lib/auth/guards";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function FunnelPage({ searchParams }: PageProps<"/admin/funnel">) {
  await requireAdmin("/admin/funnel");
  const { from, to } = parseRange(await searchParams);
  const report = await funnelReport(from, to);
  const max = Math.max(1, ...report.steps.map((s) => s.people));
  const lastDay = new Date(to.getTime() - 86_400_000);

  return (
    <div className="stack" style={{ gap: 28 }}>
      <h1>Funnel.</h1>
      <form method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }} className="small">
        <label className="field">
          <span className="field-label">From</span>
          <input type="date" name="from" defaultValue={iso(from)} className="input" />
        </label>
        <label className="field">
          <span className="field-label">To</span>
          <input type="date" name="to" defaultValue={iso(lastDay)} className="input" />
        </label>
        <button type="submit" className="button quiet">Update</button>
      </form>
      <p className="small muted">unique people per step, {iso(from)} to {iso(lastDay)} (utc). hackatime is only needed on the project path.</p>

      <div className="table-scroll">
        <table className="table" data-testid="funnel">
          <thead>
            <tr>
              <th>Step</th>
              <th style={{ width: "45%" }} aria-hidden="true" />
              <th>People</th>
              <th>From previous</th>
            </tr>
          </thead>
          <tbody>
            {report.steps.map((s) => (
              <tr key={s.step} data-step={s.step}>
                <td>{STEP_LABEL[s.step]}</td>
                <td aria-hidden="true">
                  <div className="bar" style={{ width: `${(s.people / max) * 100}%` }} />
                </td>
                <td>{s.people}</td>
                <td>{s.fromPrevious === null ? "—" : `${s.fromPrevious}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="panel stack-sm" data-testid="submitted-split">
          <span className="field-label">Submitted by type</span>
          <p>project: {report.submittedByKind.project ?? 0}</p>
          <p>aid: {report.submittedByKind.aid ?? 0}</p>
        </div>
        <div className="panel stack-sm" data-testid="decided-split">
          <span className="field-label">Decisions</span>
          {(["approved", "rejected_cut", "rejected_malformed"] as ApplicationStatus[]).map((d) => (
            <p key={d}>
              {ADMIN_LABEL[d].toLowerCase()}: {report.decidedByOutcome[d] ?? 0}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
