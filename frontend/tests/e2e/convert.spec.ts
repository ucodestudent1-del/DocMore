import { test, expect } from "@playwright/test";

test.describe("Universal Converter", () => {
  test.beforeEach(async ({ page }: any) => {
    // Mock the backend API so E2E runs without a live server.
    await page.route("**/api/formats", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          formats: [
            { name: "PDF", extensions: ["pdf"], status: "done" },
            { name: "PNG", extensions: ["png"], status: "done" },
          ],
        }),
      });
    });
    await page.route("**/api/convert", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ job_id: "job_123", status: "queued" }),
      });
    });
    await page.route("**/api/jobs/job_123", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", result: "out_456", error: null }),
      });
    });
    await page.route("**/api/download/out_456", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4 fake", "utf8"),
      });
    });
    await page.route("**/api/conversions/**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ source: "png", targets: ["jpg", "webp", "pdf"] }),
      });
    });
  });

  test("loads and shows supported formats", async ({ page }: any) => {
    await page.goto("/convert");
    await expect(page.locator("h1")).toContainText("Universal Converter");
    await expect(page.locator("text=PDF")).toBeVisible();
    await expect(page.locator("text=PNG")).toBeVisible();
  });

  test("converts a file and offers a download", async ({ page }: any) => {
    await page.goto("/convert");
    // Upload a file
    await page.setInputFiles('input[type="file"]', {
      name: "image.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png"),
    });
    await expect(page.locator("text=image.png")).toBeVisible();
    // Select a target format
    await page.locator("text=Choose format").click();
    await page.locator("text=JPG").click();
    await page.getByRole("button", { name: /Convert/ }).click();
    // Download link appears
    await expect(page.locator("text=Ready to download")).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();
  });
});
