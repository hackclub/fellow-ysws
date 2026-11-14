import { expect, test, type Browser, type Page } from "@playwright/test";
import { approveAs, connectHackatime, resetDb, signIn } from "./helpers";

test.beforeEach(resetDb);

async function actor(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

/** Founder opens the form, forms a team and returns the invite link. */
async function formTeam(founder: Page, sub: string): Promise<string> {
  await signIn(founder, sub);
  await founder.getByRole("button", { name: "Add partners" }).click();
  const link = founder.getByLabel("Invite link");
  await expect(link).toHaveValue(/\/join\/[\w-]+$/);
  return link.inputValue();
}

/** A signed-out visitor opens the link, signs in with Hack Club and joins. */
async function join(page: Page, link: string, sub: string, founderSub: string) {
  await page.goto(link);
  await approveAs(page, sub);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Join Test ${founderSub}'s team.`);
  await page.getByRole("button", { name: "Join the team" }).click();
  await expect(page).toHaveURL(/\/submissions\?joined=1/);
}

async function fillAid(page: Page) {
  await page.getByRole("checkbox", { name: /Request financial aid/ }).check();
  await page.getByLabel("YouTube link").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByLabel("Why are you asking for financial aid?").fill("first time building anything, huge idea");
  await page.getByLabel("How'd you hear about us?").fill("a friend");
  await page.getByRole("checkbox", { name: /entirely new to hack club/ }).check();
  await page.getByRole("checkbox", { name: /only ask for financial aid once/ }).check();
  await page.getByRole("checkbox", { name: /team behind the idea/ }).check();
}

async function fillProject(page: Page) {
  await page.getByRole("radio", { name: /big-project/ }).check();
  await page.getByLabel("Code URL").fill("https://github.com/orpheus/big-project");
  await page.getByLabel("Playable URL").fill("https://big-project.example.com");
  await page.getByLabel("Description").fill("it plays music from your keyboard");
  await page.getByLabel("How'd you hear about us?").fill("slack");
}

async function decide(admin: Page, applicantName: string, decision: RegExp, note?: string) {
  await admin.goto("/admin?status=submitted");
  await admin.getByRole("link", { name: applicantName }).click();
  await admin.getByRole("radio", { name: decision }).check();
  const why = admin.getByLabel("Justification (required)");
  if (await why.count()) await why.fill("reviewed the project and its hours.");
  if (note) await admin.getByLabel(/^Note to the applicant/).fill(note);
  await admin.getByRole("button", { name: "Record decision" }).click();
  await expect(admin.getByTestId("decision-audit")).toContainText("decided by Test ident!e2e-admin");
}

const members = (page: Page) => page.getByRole("list", { name: "Team members" });

test("a partner joins through the invite link and the founder sees them", async ({ browser }) => {
  const founder = await actor(browser);
  const link = await formTeam(founder, "ident!t-f1");
  await expect(founder.getByTestId("spots-left")).toHaveText("3 of 3 partner spots left.");

  const partner = await actor(browser);
  await join(partner, link, "ident!t-p1", "ident!t-f1");
  await expect(partner.getByTestId("portal-role")).toHaveText("partner on a team");
  await expect(partner.getByTestId("team-members")).toContainText("Test ident!t-f1");
  await expect(partner.getByText(/hasn't applied yet/)).toBeVisible();

  await founder.getByRole("button", { name: "Check who joined" }).click();
  await expect(members(founder)).toContainText("Test ident!t-p1");
  await expect(founder.getByTestId("spots-left")).toHaveText("2 of 3 partner spots left.");

  // Partners can't apply on their own while they're on a team.
  await partner.goto("/apply");
  await expect(partner).toHaveURL(/\/submissions\?partner=1/);
  await expect(partner.getByText(/can't apply on your own/)).toBeVisible();
});

test("dead and replaced links explain themselves", async ({ browser }) => {
  const visitor = await actor(browser);
  await visitor.goto("/join/this-token-does-not-exist-at-all");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("This invite link doesn't work.");

  const founder = await actor(browser);
  const link = await formTeam(founder, "ident!t-f2");
  await founder.getByRole("button", { name: "New link" }).click();
  await expect(founder.getByLabel("Invite link")).not.toHaveValue(link);
  await visitor.goto(link);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("This invite link doesn't work.");

  await founder.goto(await founder.getByLabel("Invite link").inputValue());
  await expect(founder.getByRole("heading", { level: 1 })).toHaveText("This is your own team.");
});

test("submit is refused when the team changed, keeping the founder's answers", async ({ browser }) => {
  const founder = await actor(browser);
  const link = await formTeam(founder, "ident!t-f3");
  const partner = await actor(browser);
  await join(partner, link, "ident!t-p3", "ident!t-f3");

  await founder.reload();
  await expect(members(founder)).toContainText("Test ident!t-p3");
  await fillAid(founder);

  // The partner leaves while the founder is still on the form.
  await partner.getByRole("button", { name: "Leave team" }).click();
  await partner.getByRole("button", { name: "Yes, leave" }).click();
  await expect(partner).toHaveURL(/\/submissions\?left=1/);
  await expect(partner.getByText("you haven't applied yet.")).toBeVisible();

  await founder.getByRole("button", { name: "Submit application" }).click();
  await expect(founder.getByTestId("team-error")).toContainText("your team changed");
  await expect(members(founder)).not.toContainText("Test ident!t-p3");
  await expect(founder.getByLabel("YouTube link")).toHaveValue("https://youtu.be/dQw4w9WgXcQ");

  await founder.getByRole("button", { name: "Submit application" }).click();
  await expect(founder).toHaveURL(/\/submissions\?submitted=1/);
});

test("full team journey: kick, submit, needs changes, re-team, resubmit, accept, release", async ({ browser }) => {
  const founder = await actor(browser);
  const link = await formTeam(founder, "ident!t-f4");
  const [p1, p2] = [await actor(browser), await actor(browser)];
  await join(p1, link, "ident!t-p4a", "ident!t-f4");
  await join(p2, link, "ident!t-p4b", "ident!t-f4");

  await founder.reload();
  await founder.getByRole("button", { name: "Remove Test ident!t-p4a" }).click();
  await expect(members(founder)).not.toContainText("Test ident!t-p4a");
  await expect(founder.getByLabel("Invite link")).not.toHaveValue(link);
  // The kicked partner is free again and the old link is dead.
  await p1.goto("/apply");
  await expect(p1).toHaveURL(/\/apply$/);
  await p1.goto(link);
  await expect(p1.getByRole("heading", { level: 1 })).toHaveText("This invite link doesn't work.");

  await connectHackatime(founder, "ident!t-f4");
  await fillProject(founder);
  await founder.getByRole("button", { name: "Pay 2 hours & submit" }).click();
  await expect(founder).toHaveURL(/\/submissions\?submitted=1/);
  await expect(founder.getByTestId("team-members")).toContainText("Test ident!t-p4b");

  // Locked: the partner sees the application but can't leave.
  await p2.goto("/submissions");
  await expect(p2.getByTestId("status-label")).toHaveText("Under review");
  await expect(p2.getByRole("button", { name: "Leave team" })).toHaveCount(0);
  await expect(p2.getByRole("button", { name: "Delete application" })).toHaveCount(0);

  const admin = await actor(browser);
  await signIn(admin, "ident!e2e-admin", "/admin");
  await decide(admin, "Test ident!t-f4", /^Needs changes/, "add your cofounder to the team");
  await expect(admin.getByTestId("team-members")).toContainText("Test ident!t-p4b");

  // Partner view of "Needs changes": label, note, team, no founder actions.
  await p2.goto("/submissions");
  await expect(p2.getByTestId("status-label")).toHaveText("Needs changes");
  await expect(p2.getByTestId("reviewer-note")).toHaveText("add your cofounder to the team");
  await expect(p2.getByRole("link", { name: /resubmit/i })).toHaveCount(0);

  // The team reopens: the founder invites someone new and resubmits.
  await founder.goto("/apply");
  const newLink = await founder.getByLabel("Invite link").inputValue();
  const p3 = await actor(browser);
  await join(p3, newLink, "ident!t-p4c", "ident!t-f4");
  await founder.reload();
  await expect(members(founder)).toContainText("Test ident!t-p4c");
  // Still connected to Hackatime from the first submission.
  await fillProject(founder);
  await founder.getByRole("button", { name: "Pay 2 hours & submit" }).click();
  await expect(founder).toHaveURL(/\/submissions\?submitted=1/);

  await decide(admin, "Test ident!t-f4", /^Approve/);
  await expect(admin.getByTestId("team-members").first()).toContainText("Test ident!t-p4c");

  // Accepted: partners are released and can apply on their own.
  for (const p of [p2, p3]) {
    await p.goto("/apply");
    await expect(p).toHaveURL(/\/apply$/);
  }
});
