import { test, expect } from "@playwright/test";

test.describe("Authentication Gates and Route Protection", () => {
  test("unauthenticated access to /dashboard is intercepted by auth middleware", async ({
    page,
  }) => {
    // Attempt to access protected dashboard route directly
    await page.goto("/dashboard");

    // The Clerk middleware intercepts protected routes and redirects to /sign-in,
    // or renders the sign-in requirement screen
    await page.waitForURL((url) => url.pathname.includes("/sign-in") || url.pathname.includes("/dashboard"));

    const currentUrl = page.url();
    const isSignInRedirected = currentUrl.includes("/sign-in");
    const isSignInVisible = await page
      .getByText(/Sign in|Welcome to LendLoop/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(isSignInRedirected || isSignInVisible).toBeTruthy();
  });

  test("unauthenticated access to /admin is intercepted by auth middleware", async ({
    page,
  }) => {
    // Attempt to access administrative portal route directly
    await page.goto("/admin");

    await page.waitForURL((url) => url.pathname.includes("/sign-in") || url.pathname.includes("/admin"));

    const currentUrl = page.url();
    const isSignInRedirected = currentUrl.includes("/sign-in");
    const isSignInVisible = await page
      .getByText(/Sign in|Welcome to LendLoop/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(isSignInRedirected || isSignInVisible).toBeTruthy();
  });
});
