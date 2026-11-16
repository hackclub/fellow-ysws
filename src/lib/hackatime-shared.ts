// Pure helpers shared by server code and client components.
export type HackatimeProject = { name: string; totalSeconds: number };

/** The application fee is 2 hours for each person on the team, founder included. */
export const SECONDS_PER_APPLICANT = 2 * 60 * 60;

/** The smallest fee: a solo founder. Projects under this aren't listed at all. */
const MIN_SECONDS = SECONDS_PER_APPLICANT;

/** The fee, in seconds, for a team of `teamSize` people (founder + partners). */
export function feeSeconds(teamSize: number): number {
  return Math.max(1, Math.floor(teamSize)) * SECONDS_PER_APPLICANT;
}

/** Whether a project has enough logged time to pay a team of `teamSize`'s fee. */
export function coversFee(project: HackatimeProject, teamSize: number): boolean {
  return project.totalSeconds >= feeSeconds(teamSize);
}

/** Projects with at least 2 hours logged, most time first. */
export function eligibleProjects(projects: HackatimeProject[]): HackatimeProject[] {
  return projects
    .filter((p) => p.totalSeconds >= MIN_SECONDS && p.name.trim() !== "")
    .sort((a, b) => b.totalSeconds - a.totalSeconds || a.name.localeCompare(b.name));
}

export function formatHours(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
