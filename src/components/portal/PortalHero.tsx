import { COHORT_NAME, HERO_PHOTO, PROGRAM_SUMMARY } from "@/content/portal";

/** Full-bleed welcome banner over the Golden Gate photo. */
export function PortalHero({
  name,
  kind,
  role,
}: {
  name: string | null;
  kind: "project" | "aid" | null;
  role: "founder" | "partner";
}) {
  return (
    <section className="portal-hero" style={{ backgroundImage: `url(${HERO_PHOTO.src})` }}>
      <div className="container portal-hero-inner">
        <p className="portal-eyebrow">FELLOWS FUND™ Applicant portal</p>
        <h1 className="portal-welcome">
          Welcome{name ? "," : "!"}
          {name && (
            <>
              <br />
              <em>{name}</em>!
            </>
          )}
        </h1>
        <dl className="portal-meta">
          <dt>Applying for</dt>
          <dd>FELLOWS FUND™</dd>
          {kind && (
            <>
              <dt>Application type</dt>
              <dd>{kind === "aid" ? "financial aid" : "project"}</dd>
            </>
          )}
          {role === "partner" && (
            <>
              <dt>Applying as</dt>
              <dd data-testid="portal-role">partner on a team</dd>
            </>
          )}
          {/* <dt>Program</dt>
          <dd>{PROGRAM_SUMMARY}</dd> */}
        </dl>
      </div>
    
    </section>
  );
}
