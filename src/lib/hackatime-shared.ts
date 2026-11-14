// Pure helpers shared by server code and client components.
export type HackatimeProject = { name: string; totalSeconds: number };

const MIN_SECONDS = 2 * 60 * 60;

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
