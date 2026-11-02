import { test, expect } from "@playwright/test";

test.describe("Authentication Gates and Route Protection", () => {
  test("unauthenticated access to /dashboard is intercepted by auth middleware", async ({
    page,
  }) => {
    // Attempt to access protected dashboard route directly
    await page.goto("/dashboard");

    // The auth middleware intercepts protected routes and redirects strictly to /sign-in
    await page.waitForURL((url) => url.pathname.includes("/sign-in"));
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated access to /admin is intercepted by auth middleware", async ({
    page,
  }) => {
    // Attempt to access administrative portal route directly
    await page.goto("/admin");

    // The auth middleware intercepts protected routes and redirects strictly to /sign-in
    await page.waitForURL((url) => url.pathname.includes("/sign-in"));
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
