import { test, expect } from "@playwright/test";

test.describe("Public Navigation and User Journey Flows", () => {
  test("header CTA 'Sign In' navigates user to sign-in page", async ({ page }) => {
    await page.goto("/");

    const signInButton = page.getByRole("link", { name: "Sign In" }).first();
    await signInButton.click();

    await page.waitForURL("**/sign-in**");
    expect(page.url()).toContain("/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome to LendLoop" })
    ).toBeVisible();
  });

  test("CTA 'Browse Available Tools' scrolls to directory section", async ({ page }) => {
    await page.goto("/");

    const browseBtn = page.getByRole("link", { name: "Browse Available Tools" }).first();
    await browseBtn.click();

    await expect(page.locator("#tools")).toBeVisible();
  });

  test("footer renders mission statement, copyright, and platform links", async ({
    page,
  }) => {
    await page.goto("/");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(
      footer.getByText("Borrow what you need. Lend what you don't.")
    ).toBeVisible();
    await expect(
      footer.getByText(/Built for Fluence International, Inc\./i)
    ).toBeVisible();
  });
});
