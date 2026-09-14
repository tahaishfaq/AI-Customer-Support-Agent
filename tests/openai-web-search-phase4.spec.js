const { test, expect } = require("@playwright/test");

test("public web chat uses SSE when streaming is enabled", async ({ page }) => {
  const target = process.env.WEB_SEARCH_BROWSER_URL;
  test.skip(!target, "Set WEB_SEARCH_BROWSER_URL for the authenticated/staging public-chat smoke test");

  await page.goto(target);
  const input = page.locator("textarea[placeholder*='Type a message']").first();
  await expect(input).toBeVisible();

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/public/agents/") &&
    response.url().endsWith("/chat")
  );
  await input.fill(process.env.WEB_SEARCH_BROWSER_QUERY || "Search online for the OpenAI API documentation homepage.");
  await input.press("Enter");
  const response = await responsePromise;
  expect(response.headers()["content-type"] || "").toContain("text/event-stream");
});
