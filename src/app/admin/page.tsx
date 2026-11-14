import Link from "next/link";
import { AirtableSync } from "@/components/admin/AirtableSync";
import { listApplications, parseFilter } from "@/lib/admin/service";
import { airtableConfig, countPendingSync } from "@/lib/airtable/sync";
import { ADMIN_LABEL } from "@/lib/applications/shared";

const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminList({ searchParams }: PageProps<"/admin">) {
  const filter = parseFilter(await searchParams);
  const [rows, waiting] = await Promise.all([listApplications(filter), countPendingSync()]);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1>Applications.</h1>
      <AirtableSync waiting={waiting} configured={airtableConfig() !== null} />
      <form method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }} className="small">
        <label className="field">
          <span className="field-label">Type</span>
          <select name="kind" defaultValue={filter.kind ?? ""} className="select">
            <option value="">all</option>
            <option value="project">project</option>
            <option value="aid">aid</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select name="status" defaultValue={filter.status ?? ""} className="select">
            <option value="">all</option>
            {Object.entries(ADMIN_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l.toLowerCase()}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="button quiet">Filter</button>
      </form>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Type</th>
              <th>Status</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/applications/${r.id}`}>{r.applicantName}</Link>
                  {r.replacesEarlier && <span className="muted"> · resubmission</span>}
                </td>
                <td>{r.kind}</td>
                <td><span className="status" data-status={r.status}>{ADMIN_LABEL[r.status]}</span></td>
                <td>{fmt(r.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">nothing here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
