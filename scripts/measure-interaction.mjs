import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { grantLocation, mockServices } from "../tests/e2e/fixtures.ts";

// Lab-only: desktop Chrome with CPU throttling is NOT an iPhone 5 simulator.
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await grantLocation(context);
  const page = await context.newPage();
  const counts = await mockServices(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(
    `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3102"}/goi-y/solo`,
  );
  await expect(page.locator(".place-card")).toHaveCount(12);
  const input = page.getByRole("textbox", { name: "Tìm quán" });
  const timings = [];
  for (let i = 0; i < 5; i++) {
    const start = await page.evaluate(() => performance.now());
    await input.fill("Quán thử nghiệm 30");
    await expect(page.locator(".place-card")).toHaveCount(1);
    timings.push(
      Math.round((await page.evaluate(() => performance.now())) - start),
    );
    await input.fill("");
    await expect(page.locator(".place-card")).toHaveCount(12);
  }
  const result = {
    browser: browser.version(),
    cpuThrottle: 4,
    fixturePlaces: 30,
    searchToResultMs: timings,
    nearbyRequests: counts.nearby,
    note: "Includes Playwright/IPC overhead; mocked services and desktop CPU, not real-phone FPS or production latency.",
  };
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/interaction.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
