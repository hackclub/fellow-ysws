import { expect, test } from "@playwright/test";

test("landing page shows every section and leads to apply", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Past fellows" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We back teenage hackers like you.");
  await expect(page.getByRole("heading", { name: "Why Fellows?" })).toBeVisible();

  const steps = page.locator(".cards > li");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("2 hours™");
  await expect(steps.nth(1)).toContainText("Weeks 1–9");
  await expect(steps.nth(2)).toContainText("San Francisco");

  const faq = page.getByRole("button", { name: /Why does it cost 2 hours/ });
  await expect(faq).toHaveAttribute("aria-expanded", "false");
  await faq.click();
  await expect(faq).toHaveAttribute("aria-expanded", "true");

  const cta = page.getByRole("link", { name: "Apply to FELLOWS FUND™" });
  await expect(cta).toHaveAttribute("href", "/apply");
  await cta.click();
  // /apply needs a Hack Club sign-in first
  await expect(page).toHaveURL(/\/test-oauth\/hackclub\/oauth\/authorize/);
});

test("nav shows Apply, Submissions, FAQ and no Review for visitors", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Apply", "Submissions", "FAQ"]);
});
