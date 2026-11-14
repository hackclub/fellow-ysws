import { expect, test } from "@playwright/test";
import { resetDb, signIn, signOut, submitAid, submitProject } from "./helpers";

test.beforeEach(resetDb);

test("REVIEW is shown to admins and hidden from everyone else", async ({ page }) => {
  await signIn(page, "ident!e2e-regular");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Review" })).toHaveCount(0);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await signOut(page);

  await signIn(page, "ident!e2e-admin", "/admin");
  await expect(nav.getByRole("link", { name: "Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Applications." })).toBeVisible();
});

test("admin detail view shows full aid and project applications", async ({ page }) => {
  await submitAid(page, "ident!e2e-aid");
  await expect(page).toHaveURL(/\/submissions\?submitted=1/);
  await signOut(page);
  await submitProject(page, "ident!e2e-proj");
  await signOut(page);

  await signIn(page, "ident!e2e-admin", "/admin");
  await page.getByLabel("Type").selectOption("aid");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "Test ident!e2e-aid" }).click();
  await expect(page.getByText("first time building anything, huge idea")).toBeVisible();
  await expect(page.getByRole("link", { name: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })).toBeVisible();
  await expect(page.getByText("a friend")).toBeVisible();
  await expect(page.getByText(/new to hack club ✓ · aid is once only ✓/)).toBeVisible();

  await page.goto("/admin?kind=project");
  await page.getByRole("link", { name: "Test ident!e2e-proj" }).click();
  await expect(page.getByRole("definition").filter({ hasText: "big-project — 5h 10m logged, 2h credited" })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://github.com/orpheus/big-project" })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://big-project.example.com" })).toBeVisible();
});
