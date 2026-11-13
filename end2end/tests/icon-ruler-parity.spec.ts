import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const { paths } = JSON.parse(readFileSync("fixtures/expected-icons.json", "utf8"));
test.use({ viewport: { width: 1600, height: 1000 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).dataExports = [];
    (window as any).__TAURI__ = {
      core: {
        invoke: async (command: string, args: any) => {
          if (command === "save_csv") (window as any).dataExports.push(args);
          return true;
        },
      },
    };
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as any).reportstudioReady);
});
async function checkIcons(page: any) {
  const icons = await page
    .locator("svg[data-icon]")
    .evaluateAll((nodes: Element[]) =>
      nodes
        .filter((n) => n.getBoundingClientRect().width > 0)
        .map((n) => ({
          name: n.getAttribute("data-icon")!,
          path: n.querySelector("path")?.getAttribute("d"),
          stroke: n.getAttribute("stroke-width"),
          viewBox: n.getAttribute("viewBox"),
        })),
    );
  expect(icons.length).toBeGreaterThan(5);
  for (const icon of icons) {
    expect(paths[icon.name], `Expected icon exists: ${icon.name}`).toBeTruthy();
    expect(icon.path, icon.name).toBe(paths[icon.name]);
    expect(icon.stroke).toBe("1.65");
    expect(icon.viewBox).toBe("0 0 24 24");
  }
}
test("rendered SVGs match expected paths and stroke in all main tabs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await checkIcons(page);
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await checkIcons(page);
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await checkIcons(page);
  await page.getByRole("button", { name: "Edit query", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await checkIcons(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await checkIcons(page);
  await expect(
    page.getByRole("button", { name: "Previous page", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("edit disabled states, theme icon, formula glyph and PDF split menu match the reference", async ({
  page,
}) => {
  for (const name of ["Cut", "Copy", "Undo", "Redo"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await expect(
    page
      .getByRole("button", { name: "Add formula", exact: true })
      .locator(".formula-icon"),
  ).toHaveText("ƒx");
  await expect(
    page
      .getByRole("button", { name: "Add formula", exact: true })
      .locator("svg"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Switch to light mode", exact: true })
      .locator("svg"),
  ).toHaveAttribute("data-icon", "sun");
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(page.locator(".language-picker svg")).toHaveAttribute(
    "data-icon",
    "language",
  );
  await page.locator(".studio-export-menu summary").click();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeVisible();
});
test("rulers use millimeters and eighth inches, preserve spacing and stay fixed while scrolling", async ({
  page,
}) => {
  const positions = async (selector: string) =>
    page
      .locator(selector)
      .evaluateAll((nodes) =>
        nodes
          .slice(0, 11)
          .map((n) =>
            parseFloat(
              n.classList.contains("vertical-tick") ? getComputedStyle(n).top : getComputedStyle(n).left,
            ),
          ),
      );
  let horizontal = await positions(".ruler-tick");
  let vertical = await positions(".vertical-tick");
  expect(horizontal[1] - horizontal[0]).toBeCloseTo(
    vertical[1] - vertical[0],
    3,
  );
  await page.getByLabel("Units", { exact: true }).selectOption("in");
  horizontal = await positions(".ruler-tick");
  vertical = await positions(".vertical-tick");
  expect(horizontal[8] - horizontal[0]).toBeCloseTo(
    (horizontal[1] - horizontal[0]) * 8,
    3,
  );
  expect(vertical[8] - vertical[0]).toBeCloseTo(
    horizontal[8] - horizontal[0],
    3,
  );
  await expect(page.locator(".ruler-tick").nth(8)).toHaveClass(/major/);
  await expect(page.locator(".ruler-tick").nth(4)).toHaveClass(/medium/);
  await page.getByLabel("Zoom", { exact: true }).selectOption("1.00");
  horizontal = await positions(".ruler-tick");
  expect(horizontal[8] - horizontal[0]).toBeCloseTo(76, 3);
  await page.getByLabel("Zoom", { exact: true }).selectOption("1.50");
  const before = await page.locator(".horizontal-ruler-mask").boundingBox();
  const vb = await page.locator(".vertical-ruler-mask").boundingBox();
  await page.locator(".canvas-scroll").evaluate((el) => {
    el.scrollTop = 250;
    el.scrollLeft = 30;
  });
  await expect
    .poll(async () =>
      page.locator(".canvas-scroll").evaluate((el) => el.scrollTop),
    )
    .toBeGreaterThan(100);
  const after = await page.locator(".horizontal-ruler-mask").boundingBox();
  const va = await page.locator(".vertical-ruler-mask").boundingBox();
  expect(after!.y).toBe(before!.y);
  expect(va!.x).toBe(vb!.x);
});
test("model and record toolbar buttons operate on zoom, filters and visible columns", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit relationship", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Model zoom").selectOption("50");
  await expect(page.locator(".model-surface")).toHaveCSS(
    "transform",
    "matrix(0.5, 0, 0, 0.5, 0, 0)",
  );
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add filter group", exact: true }),
  ).toBeVisible();
  const menu = page.locator(".records-menu:not(.records-export-menu)");
  await menu.locator("summary").click();
  const columns = page.locator(".records-grid thead th");
  const initialCount = await columns.count();
  expect(initialCount).toBeGreaterThan(1);
  const first = menu.getByRole("checkbox").first();
  await first.uncheck();
  await expect(columns).toHaveCount(initialCount - 1);
  await menu.getByRole("button", { name: "Show all", exact: true }).click();
  await expect(columns).toHaveCount(initialCount);
});

test("record export menu saves CSV and JSON through the native boundary", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await page.getByRole("button", { name: "Export data", exact: true }).click();
  await page
    .getByRole("button", { name: "Download JSON", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).dataExports.length))
    .toBe(1);
  const result = await page.evaluate(() => (window as any).dataExports[0]);
  expect(result.format).toBe("json");
  expect(JSON.parse(result.text)).toHaveLength(3);
});
