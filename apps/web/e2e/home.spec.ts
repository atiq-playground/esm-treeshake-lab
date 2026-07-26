import { expect, test } from "@playwright/test";

test("home page renders the welcome heading", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /welcome to your app/i }),
  ).toBeVisible();
});
