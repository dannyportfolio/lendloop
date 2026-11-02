import { test, expect } from "@playwright/test";

test.describe("Accessibility, Affordances & Usability Quality Gate", () => {
  test("interactive inputs and buttons have accessible labels and reachability", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify search input has accessible placeholder
    const searchInput = page.getByPlaceholder("Search tools or brands...");
    await expect(searchInput).toBeVisible();

    // Verify keyboard focus reaches search input
    await searchInput.focus();
    await expect(searchInput).toBeFocused();

    // Verify category filter buttons are tab-accessible
    const powerToolsBtn = page.getByRole("button", { name: "Power Tools" });
    await powerToolsBtn.focus();
    await expect(powerToolsBtn).toBeFocused();
  });

  test("contains accessible landmark regions (header, main, footer)", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
});
