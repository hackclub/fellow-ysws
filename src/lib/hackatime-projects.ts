import "server-only";
import type { ProjectsState } from "@/components/apply/ProjectPicker";
import { eligibleProjects, fetchProjects, HackatimeUnavailableError, readHackatimeToken } from "@/lib/hackatime";

/** The signed-in user's eligible Hackatime projects, for a project picker. `flag` is the connect result. */
export async function projectsStateFor(userId: string, flag: string | undefined): Promise<ProjectsState> {
  const token = await readHackatimeToken(userId);
  if (!token) return { status: "not_connected", denied: flag === "denied", failed: flag === "failed" };
  try {
    return { status: "ok", projects: eligibleProjects(await fetchProjects(token)) };
  } catch (e) {
    if (!(e instanceof HackatimeUnavailableError)) throw e;
    return { status: "error", message: e.message, reconnect: /reconnect/i.test(e.message) };
  }
}
