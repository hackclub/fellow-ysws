import { expect, test } from "@playwright/test";

for (const width of [375, 1280]) {
  test(`styleguide renders without horizontal scroll at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/styleguide");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Styleguide™.");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: info.outputPath(`styleguide-${width}.png`), fullPage: true });
  });
}
