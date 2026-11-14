import { expect, test } from "@playwright/test";
import { connectHackatime, resetDb, setProjects, signIn } from "./helpers";

test.beforeEach(resetDb);

test("signed-out visitors are sent to Hack Club sign-in and returned to the form", async ({ page }) => {
  await page.goto("/apply");
  await expect(page).toHaveURL(/\/test-oauth\/hackclub\/oauth\/authorize/);
  await page.getByLabel("Hack Club id").fill("ident!e2e-1");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/apply$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Apply to Fellows Fund™.");
});

test("project path shows numbered steps, disclosures and only 2h+ projects", async ({ page }) => {
  await signIn(page, "ident!e2e-2");
  await expect(page.getByRole("link", { name: "Connect Hackatime" })).toBeVisible();
  await connectHackatime(page, "ident!e2e-2");

  await expect(page.locator("h2.step-title")).toHaveText([
    "1. Pick a project you've built.",
    "2. Show us the project.",
    "3. Bring your team.",
    "4. Pay the application fee: 2 hours™.",
  ]);
  await expect(page.getByRole("radio")).toHaveCount(1);
  await expect(page.getByRole("radio", { name: /big-project/ })).toBeVisible();
  await expect(page.getByText("almost-there")).toHaveCount(0);
  await expect(page.getByText(/doesn't have to be your startup/)).toBeVisible();
  await expect(page.getByText(/only takes 2 hours of credit/)).toBeVisible();
  await expect(page.getByText(/reship to another program/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay 2 hours & submit" })).toBeDisabled();
});

test("aid path shows its own steps and acknowledgements, without Hackatime", async ({ page }) => {
  await signIn(page, "ident!e2e-3");
  await page.getByRole("checkbox", { name: /Request financial aid/ }).check();
  await expect(page.locator("h2.step-title")).toHaveText([
    "1. Record a 1 minute video.",
    "2. Tell us why you need aid.",
    "3. Bring your team.",
    "4. The fine print.",
  ]);
  await expect(page.getByRole("checkbox", { name: /entirely new to hack club/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /only ask for financial aid once/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /team behind the idea/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect Hackatime" })).toHaveCount(0);
});

test("a denied Hackatime authorization is explained on the form", async ({ page }) => {
  await signIn(page, "ident!e2e-4");
  await page.getByRole("link", { name: "Connect Hackatime" }).click();
  await page.getByRole("link", { name: "Deny" }).click();
  await expect(page).toHaveURL(/\/apply\?hackatime=denied/);
  await expect(page.getByText(/project path needs it/)).toBeVisible();
});

test("no eligible projects points to the aid path", async ({ page }) => {
  await signIn(page, "ident!e2e-5");
  await setProjects(page, "ident!e2e-5", [{ name: "tiny", total_seconds: 600 }]);
  await connectHackatime(page, "ident!e2e-5");
  await expect(page.getByText(/none of your hackatime projects have 2 hours/)).toBeVisible();
});
