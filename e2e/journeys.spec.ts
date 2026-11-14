import { expect, test, type Browser, type Page } from "@playwright/test";
import { fillAndSubmitAid, query, resetDb, signIn, submitAid, submitProject } from "./helpers";

test.beforeEach(resetDb);

async function actor(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
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

test("project applicant submits and is accepted", async ({ browser }) => {
  const applicant = await actor(browser);
  await applicant.goto("/");
  await submitProject(applicant, "ident!j-project");
  await expect(applicant.getByTestId("status-label")).toHaveText("Under review");
  // a second application isn't possible
  await applicant.goto("/apply");
  await expect(applicant).toHaveURL(/\/submissions$/);

  const admin = await actor(browser);
  await signIn(admin, "ident!e2e-admin", "/admin");
  await decide(admin, "Test ident!j-project", /^Approve/, "your demo was the best we saw this round.");
  await expect(admin.getByTestId("telescreen-link")).toHaveAttribute(
    "href",
    /^https:\/\/telescreen\.hackclub\.com\/workbench\/hackatime\/overview\?p=big-project&u=\d+$/,
  );

  await applicant.goto("/submissions");
  await expect(applicant.getByTestId("status-label")).toHaveText("Decision ready");
  await applicant.getByRole("link", { name: "View your decision" }).click();
  await expect(applicant.getByTestId("decision-letter")).toHaveAttribute("data-outcome", "admitted");
  await expect(applicant.getByTestId("reviewer-note")).toHaveText("your demo was the best we saw this round.");
  await applicant.goto("/submissions");
  await expect(applicant.getByRole("button", { name: "Delete application" })).toHaveCount(0);

  // the funnel saw the applicant all the way through (the admin's sign-in counts too)
  await admin.goto("/admin/funnel");
  const row = (step: string) => admin.locator(`[data-testid=funnel] tr[data-step=${step}] td:nth-child(3)`);
  const expected = { visit: "1", signed_in: "2", hackatime_connected: "1", form_started: "1", submitted: "1", decided: "1" };
  for (const [step, people] of Object.entries(expected)) {
    await expect(row(step), step).toHaveText(people);
  }
  await expect(admin.getByTestId("submitted-split")).toContainText("project: 1");
  await expect(admin.getByTestId("decided-split")).toContainText("approved: 1");
});

test("aid applicant gets 'Needs changes' with a note and resubmits as aid", async ({ browser }) => {
  const applicant = await actor(browser);
  await submitAid(applicant, "ident!j-aid");
  await expect(applicant).toHaveURL(/\/submissions\?submitted=1/);

  const admin = await actor(browser);
  await signIn(admin, "ident!e2e-admin", "/admin");
  await admin.goto("/admin?status=submitted");
  await admin.getByRole("link", { name: "Test ident!j-aid" }).click();
  await admin.getByRole("radio", { name: /^Needs changes/ }).check();
  await expect(admin.getByRole("button", { name: "Record decision" })).toBeDisabled();
  await admin.getByLabel("Note to the applicant (required)").fill("your video link is private — set it to unlisted.");
  await admin.getByRole("button", { name: "Record decision" }).click();
  await expect(admin.getByTestId("admin-status")).toHaveText("Rejected — malformed");

  await applicant.goto("/submissions");
  await expect(applicant.getByTestId("status-label")).toHaveText("Needs changes");
  await expect(applicant.getByTestId("reviewer-note")).toHaveText("your video link is private — set it to unlisted.");
  await applicant.getByRole("link", { name: /resubmit/i }).click();
  await expect(applicant.getByText(/your last application needs changes/)).toBeVisible();
  await expect(applicant.getByRole("checkbox", { name: /Request financial aid/ })).toBeEnabled();
  await fillAndSubmitAid(applicant);
  await expect(applicant.getByTestId("status-label")).toHaveText("Under review");

  await admin.goto("/admin?kind=aid&status=submitted");
  await admin.getByRole("link", { name: "Test ident!j-aid" }).click();
  await expect(admin.getByRole("heading", { name: "Earlier versions" })).toBeVisible();
});

test("an aid applicant who deletes can only reapply with a project", async ({ browser }) => {
  const applicant = await actor(browser);
  await submitAid(applicant, "ident!j-delete");
  await applicant.getByRole("button", { name: "Delete application" }).click();
  await expect(applicant.getByText(/your one financial aid request stays used/)).toBeVisible();
  await applicant.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(applicant).toHaveURL(/deleted=1/);
  await expect(applicant.getByText("you haven't applied yet.")).toBeVisible();
  expect(await query("SELECT id FROM applications")).toHaveLength(0);

  await applicant.goto("/apply");
  await expect(applicant.getByRole("checkbox", { name: /Request financial aid/ })).toBeDisabled();
  await expect(applicant.getByText(/already used your one financial aid request/)).toBeVisible();
  await expect(applicant.getByRole("link", { name: "Connect Hackatime" })).toBeVisible();
});

test("a cut applicant reads the note in their letter, then is prompted to reapply", async ({ browser }) => {
  const applicant = await actor(browser);
  await applicant.goto("/");
  await submitAid(applicant, "ident!j-cut");

  const admin = await actor(browser);
  await signIn(admin, "ident!e2e-admin", "/admin");
  await decide(admin, "Test ident!j-cut", /^Reject — didn't make the cut/, "loved the idea — show us a demo next time.");

  await applicant.goto("/submissions");
  await expect(applicant.getByTestId("reviewer-note")).toHaveCount(0);
  await applicant.getByRole("link", { name: "View your decision" }).click();
  await expect(applicant.getByTestId("decision-letter")).toHaveAttribute("data-outcome", "rejected");
  await expect(applicant.getByTestId("reviewer-note")).toHaveText("loved the idea — show us a demo next time.");

  // Back on the dashboard, the letter has been read: they're prompted to apply again.
  await applicant.goto("/submissions");
  await expect(applicant.getByTestId("status-label")).toHaveText("Apply again");
  await expect(applicant.getByText(/needs a hackatime project/)).toBeVisible();
  await applicant.getByRole("link", { name: "Start a new application" }).click();
  await expect(applicant).toHaveURL(/\/apply$/);
  await expect(applicant.getByText(/^welcome back\./)).toBeVisible();
});

test("admin syncs reviews to airtable; fraud bans the applicant and isn't synced", async ({ browser }) => {
  const good = await actor(browser);
  await good.goto("/");
  await submitProject(good, "ident!j-good");
  const cheat = await actor(browser);
  await cheat.goto("/");
  await submitProject(cheat, "ident!j-cheat");

  const admin = await actor(browser);
  await signIn(admin, "ident!e2e-admin", "/admin");
  await decide(admin, "Test ident!j-good", /^Approve/);
  await decide(admin, "Test ident!j-cheat", /^Reject — fraud/);
  await expect(admin.getByTestId("banned")).toBeVisible();
  await expect(admin.getByTestId("airtable-status")).toContainText("not synced to airtable");

  await admin.goto("/admin");
  await expect(admin.getByTestId("airtable-waiting")).toHaveText("· 1 review waiting");
  await admin.getByRole("button", { name: "Sync to Airtable" }).click();
  await expect(admin.getByTestId("airtable-result")).toHaveText("synced 1 review to airtable.");
  await admin.reload();
  await expect(admin.getByTestId("airtable-waiting")).toHaveText("· up to date");
  await admin.getByRole("link", { name: "Test ident!j-good" }).click();
  await expect(admin.getByTestId("airtable-status")).toContainText("synced to airtable on");

  await cheat.goto("/submissions");
  await expect(cheat.getByTestId("status-label")).toHaveText("Not accepted");
  await cheat.goto("/apply");
  await expect(cheat).toHaveURL(/\/submissions$/);
});
