import "server-only";
import { validatePartnerProject, type PartnerProjectErrors, type PartnerProjectInput } from "@/lib/applications/shared";
import { eligibleProjects, fetchHackatimeId, fetchProjects, HackatimeUnavailableError } from "@/lib/hackatime";
import { savePartnerProject } from "./service";

export type PartnerProjectResult = { ok: true } | { ok: false; errors: PartnerProjectErrors };

const REFUSED: Record<"not_partner" | "locked" | "founder_pays", string> = {
  not_partner: "you're not a partner on a team right now",
  locked: "your team's application is already submitted, so your project can't change until it's reviewed",
  founder_pays: "your founder is covering your hours, so you don't need to add a project",
};

/**
 * Saves a partner's own project for "each pays" mode. Runs in the partner's own request, because
 * only their Hackatime token can confirm the project's hours and their Hackatime account.
 */
export async function savePartnerProjectFromForm(
  user: { id: string },
  input: PartnerProjectInput,
  hackatimeToken: string | null,
): Promise<PartnerProjectResult> {
  const checked = validatePartnerProject(input);
  if (!checked.ok) return checked;
  const content = checked.value;
  if (!hackatimeToken) {
    return { ok: false, errors: { hackatimeProject: "reconnect hackatime so we can confirm your hours, then save again" } };
  }
  let seconds: number;
  let hackatimeId: string | null;
  try {
    const [projects, id] = await Promise.all([fetchProjects(hackatimeToken), fetchHackatimeId(hackatimeToken)]);
    const match = eligibleProjects(projects).find((p) => p.name === content.hackatimeProject);
    if (!match) {
      return { ok: false, errors: { hackatimeProject: "that project isn't one of your hackatime projects with 2+ hours" } };
    }
    seconds = match.totalSeconds;
    hackatimeId = id;
  } catch (e) {
    if (e instanceof HackatimeUnavailableError) return { ok: false, errors: { hackatimeProject: e.message.toLowerCase() } };
    throw e;
  }
  // The account id is what keeps each person paying from their own Hackatime, so it's required.
  if (!hackatimeId) {
    return { ok: false, errors: { hackatimeProject: "we couldn't read your hackatime account. reconnect hackatime, then save again" } };
  }
  const r = await savePartnerProject(user, content, { seconds, hackatimeId });
  return r.ok ? r : { ok: false, errors: { form: REFUSED[r.reason] } };
}
