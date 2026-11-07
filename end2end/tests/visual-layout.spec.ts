import { test, expect } from "@playwright/test";

// Verify layout dimensions at a fixed viewport.
test.use({ viewport: { width: 1600, height: 1000 } });
test("Chrome, margins and rulers remain aligned", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await expect(page.locator(".studio-header")).toHaveCSS("height", "62px");
  await expect(page.locator(".fields-sidebar")).toHaveCSS("width", "310px");
  await expect(page.locator(".properties-sidebar")).toHaveCSS("width", "344px");
  const buttons = await page
    .locator(".header-actions>button")
    .allTextContents();
  expect(buttons.join("|")).toMatch(/Save.*New.*Open/);
  const first = page.locator(".report-element").first();
  const left = await first.evaluate((el) =>
    parseFloat(getComputedStyle(el).left),
  );
  expect(left).toBeGreaterThan(20); // The document margin must be included.
  const tick = page.locator(".ruler-tick").nth(1);
  await expect(tick).toHaveCSS("padding-top", "0px");
  await expect(page.locator(".section-color-dot")).toHaveCount(7);
  const colors = await page
    .locator(".section-color-dot")
    .evaluateAll(
      (nodes) =>
        new Set(nodes.map((n) => getComputedStyle(n).backgroundColor)).size,
    );
  expect(colors).toBeGreaterThan(5);
  await page.screenshot({ path: "test-results/leptos-design-reviewed.png" });
});

test("preview keeps the reference panel proportions and hides editor status", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".pages-sidebar")).toHaveCSS("width", "220px");
  await expect(page.locator(".preview-sidebar")).toHaveCSS("width", "304px");
  await expect(page.locator(".status-bar")).toBeHidden();
  await expect(page.locator(".preview-page canvas").first()).toBeVisible();
});

test("preview fits a whole page independently of designer zoom", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).reportstudioReady);
  await page.getByLabel("Zoom", { exact: true }).selectOption("1.50");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const canvas = page.locator(".preview-page canvas").first();
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () =>
      canvas.evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeGreaterThan(500);
  const bounds = await canvas.boundingBox();
  expect(bounds!.height).toBeLessThan(800);
  await page.getByLabel("Preview fit").selectOption("actual");
  await expect
    .poll(async () =>
      canvas.evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.getByLabel("Zoom", { exact: true })).toHaveValue("1.50");
});
