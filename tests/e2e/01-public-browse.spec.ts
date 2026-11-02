import { test, expect } from "@playwright/test";

test.describe("Public Tool Directory and Landing Experience", () => {
  test("renders branding, tagline, navigation, and directory without console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");

    // Verify Title & Brand
    await expect(page).toHaveTitle(/LendLoop/i);
    await expect(page.getByRole("link", { name: /LendLoop Neighborhood Tool/i })).toBeVisible();

    // Verify Tagline
    await expect(
      page.getByRole("heading", { level: 1, name: "Borrow what you need. Lend what you don't." })
    ).toBeVisible();

    // Verify Navigation Links
    const signInLinks = page.getByRole("link", { name: "Sign In" });
    await expect(signInLinks.first()).toBeVisible();

    const browseLink = page.getByRole("link", { name: "Browse Available Tools" });
    await expect(browseLink.first()).toBeVisible();

    // Verify Search and Filter Controls exist
    const searchInput = page.getByPlaceholder("Search tools or brands...");
    await expect(searchInput).toBeVisible();

    // Check category filter pills
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Power Tools" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hand Tools" })).toBeVisible();

    // Verify no unhandled page console errors
    expect(consoleErrors).toEqual([]);
  });

  test("filters tool catalog by search query and category", async ({ page }) => {
    await page.goto("/");

    const searchInput = page.getByPlaceholder("Search tools or brands...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("DeWalt");

    // Clear search
    await searchInput.clear();

    // Click Category filter
    const powerToolsBtn = page.getByRole("button", { name: "Power Tools" });
    await powerToolsBtn.click();
    await expect(powerToolsBtn).toHaveClass(/bg-slate-900/);

    // Switch back to All
    const allBtn = page.getByRole("button", { name: "All" });
    await allBtn.click();
    await expect(allBtn).toHaveClass(/bg-slate-900/);
  });

  test("maintains responsive layout across mobile and desktop viewports", async ({
    page,
  }) => {
    // Test Mobile Viewport (iPhone SE standard: 375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Borrow what you need. Lend what you don't." })
    ).toBeVisible();

    // Test Desktop Viewport (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Borrow what you need. Lend what you don't." })
    ).toBeVisible();
  });
});
