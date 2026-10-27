import { test, expect } from "@playwright/test";
import { grantLocation, mockServices, places, viewports } from "./fixtures";

for (const viewport of viewports) {
  test.describe(`${viewport.width}px`, () => {
    test.use({
      viewport,
      reducedMotion: "reduce",
      isMobile: viewport.width === 375,
      hasTouch: viewport.width === 375,
    });
    test("homepage, three modes, map, selection and directions fit viewport", async ({
      page,
      context,
    }) => {
      await grantLocation(context);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const counts = await mockServices(page);
      await page.goto("/");
      await expect(page.locator(".mode-tile")).toHaveCount(3);
      await expect(page.locator(".typing-visible")).not.toBeEmpty();
      await page.screenshot({
        path: `artifacts/after/home-${viewport.width}.png`,
        fullPage: true,
      });
      const link = page.getByRole("link", { name: /Cho hai người/ });
      await link.focus();
      await expect(page.locator(".mode-grid")).toHaveClass(/selected-couple/);
      await link.click();
      await expect(page).toHaveURL(/\/goi-y\/couple/);
      const accents = new Set<string>();
      for (const mode of ["solo", "couple", "friends"]) {
        await page.goto(`/goi-y/${mode}`);
        await expect(page.locator(".place-card")).toHaveCount(12);
        await expect(page.locator(".dateny-marker")).toHaveCount(30);
        await expect(
          page.locator(".leaflet-control-attribution"),
        ).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
        accents.add(
          await page
            .locator("main")
            .evaluate((node) =>
              getComputedStyle(node).getPropertyValue("--accent"),
            ),
        );
        await page.screenshot({
          path: `artifacts/after/${mode}-${viewport.width}.png`,
          fullPage: true,
        });
      }
      expect(accents.size).toBe(3);
      await page.getByRole("button", { name: /Xem thêm quán/ }).click();
      await expect(page.locator(".place-card")).toHaveCount(24);
      await page
        .getByRole("textbox", { name: "Tìm quán" })
        .fill("Quán thử nghiệm 30");
      await expect(page.locator(".place-card")).toHaveCount(1);
      await page.locator(".heart-button").click();
      await expect(page.locator(".heart-button")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.locator(".place-main").click();
      await expect(page.locator(".map-selection")).toContainText(
        "Quán thử nghiệm 30",
      );
      await page.locator(".place-card .detail-button").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator(".place-detail-identity")).toBeVisible();
      await expect(
        page.locator(".place-detail-category-icon"),
      ).toHaveAccessibleName(/Nhà hàng|Cà phê|Ăn nhanh/);
      await expect.poll(() => counts.reviews).toBe(1);
      await page.screenshot({
        path: `artifacts/after/place-details-${viewport.width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.locator(".place-card .direction-link").click();
      await expect(page.locator(".route-preview-open")).toBeEnabled();
      await expect(
        page.locator(
          '.route-preview-card .leaflet-overlay-pane path[stroke="#3478f6"]',
        ),
      ).toBeVisible();
      await expect(
        page.locator(".route-preview-card .leaflet-tile-loaded").first(),
      ).toBeVisible();
      await page.screenshot({
        path: `artifacts/after/directions-${viewport.width}.png`,
      });
      await expect(page.locator(".route-preview-card")).toBeInViewport();
      await page.getByRole("button", { name: "Ô tô", exact: true }).click();
      await expect(page.locator(".route-preview-open")).toBeEnabled();
      await page.getByRole("button", { name: /Bắt đầu dẫn đường/ }).click();
      await expect(page.locator(".navigation-footer")).toBeVisible();
      await page.getByRole("button", { name: "Thoát", exact: true }).click();
      await page.keyboard.press("Escape");
      await page.reload();
      await expect(page.locator(".place-card")).toHaveCount(12);
      await expect(page.locator(".gate-content")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}

test("normal motion: tactile press and picker cancellation remain responsive", async ({
  page,
  context,
}) => {
  await grantLocation(context);
  await mockServices(page);
  await page.goto("/goi-y/couple");
  await expect(page.locator(".place-card")).toHaveCount(12);
  const pick = page.locator(".pick-button--desktop");
  // The intentionally breathing desktop CTA never becomes geometrically stable.
  // Bypass only hover's stability wait, then use real pointer down/up events.
  await pick.hover({ force: true });
  await page.mouse.down();
  expect(await pick.evaluate((node) => node.matches(":active"))).toBe(true);
  await page.screenshot({ path: "artifacts/after/pressed-desktop.png" });
  await page.mouse.up();
  await page.getByRole("button", { name: "Bốc quán", exact: true }).click();
  await expect(page.locator(".surprise-spinning")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(pick).toBeEnabled();
});

test("normal motion: hero slogan waits for the mode headline", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await grantLocation(context);
  await mockServices(page);
  await page.goto("/goi-y/friends");

  const headline = page.locator(".hero-title-typing");
  const headlineTyping = headline.locator(".typing-visible");
  const sloganTyping = page.locator(".hero-slogan-typing .typing-visible");
  await expect(headline).toHaveAttribute("aria-label", /.+/);
  const completeHeadline = await headline.getAttribute("aria-label");

  expect(completeHeadline).toBeTruthy();
  await expect(sloganTyping).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/after/hero-sequence-waiting-1440.png",
  });
  await expect(headlineTyping).toHaveText(completeHeadline!, {
    timeout: 5_000,
  });
  await expect(sloganTyping).toBeVisible();
  await expect(sloganTyping).toHaveText(
    "Khỏi nghĩ lâu.\nĐể Dateny chọn giúp.",
    { timeout: 5_000 },
  );
  await page.screenshot({
    path: "artifacts/after/hero-sequence-complete-1440.png",
  });
});

test("random pick and date plan respect reduced motion; filters do not refetch", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await grantLocation(context);
  const counts = await mockServices(page);
  await page.goto("/goi-y/couple");
  await expect(page.locator(".place-card")).toHaveCount(12);
  await page
    .getByRole("group", { name: "Loại quán", exact: true })
    .getByRole("button", { name: "Cà phê", exact: true })
    .click();
  await expect(page.locator(".place-card")).toHaveCount(10);
  await page.locator(".pick-button--desktop").click();
  await page.getByRole("button", { name: "Bốc quán", exact: true }).click();
  await expect(page.locator(".surprise-revealed")).toBeVisible();
  const first = await page.locator(".surprise-revealed h2").textContent();
  await page.getByRole("button", { name: "Bốc lại", exact: true }).click();
  await expect(page.locator(".surprise-revealed h2")).not.toHaveText(first!);
  await page.keyboard.press("Escape");
  expect(counts.nearby).toBe(1);
  await page.locator(".date-action--desktop").click();
  await expect(page.locator(".date-jackpot-primary").first()).toBeEnabled();
  await page.locator(".date-jackpot-primary").first().click();
  await expect(page.locator(".date-plan-stop")).toHaveCount(3);
  await page.keyboard.press("Escape");
});

test("loading, API error retry and empty results", async ({
  page,
  context,
}) => {
  await grantLocation(context);
  await mockServices(page);
  let attempt = 0;
  await page.route("**/api/places/nearby?**", async (route) => {
    attempt++;
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill(
      attempt % 2 === 1
        ? { status: 502, json: { error: "Nguồn địa điểm đang lỗi." } }
        : {
            json: {
              places: [],
              center: {},
              radiusMeters: 2000,
              category: "all",
              source: "overpass",
            },
          },
    );
  });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/goi-y/solo");
    await expect(
      page.getByRole("heading", { name: "Đang tìm quán…" }),
    ).toBeVisible();
    await expect(page.locator(".gate-mode svg")).toBeVisible();
    await page.screenshot({
      path: `artifacts/after/loading-${viewport.width}.png`,
    });
    await expect(page.locator(".gate-content")).toContainText(
      "Nguồn địa điểm đang lỗi",
    );
    await page.screenshot({
      path: `artifacts/after/error-${viewport.width}.png`,
    });
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.locator(".empty-state")).toBeVisible();
    await page.screenshot({
      path: `artifacts/after/empty-${viewport.width}.png`,
      fullPage: true,
    });
  }
  expect(attempt).toBe(6);
});

test("location timeout retries GPS, permission denial stays actionable", async ({
  page,
}) => {
  await mockServices(page);
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>)
      .HTMLGeolocationElement;
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: () => Promise.resolve({ state: "prompt" }) },
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: unknown, fail: (error: object) => void) =>
          fail({ code: 3 }),
      },
    });
  });
  await page.goto("/goi-y/solo");
  // On native-geolocation builds, call the fallback handler via its actual DOM button.
  await page
    .locator("geolocation button")
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(".gate-content")).toContainText("Hết thời gian");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: unknown, fail: (error: object) => void) =>
          fail({ code: 1 }),
      },
    }),
  );
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.locator("geolocation")).toBeVisible();
});

test("one-time location permission survives a reload in the same tab", async ({
  page,
}) => {
  await mockServices(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: () => Promise.resolve({ state: "prompt" }) },
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (position: object) => void) =>
          ok({
            coords: {
              latitude: 21.0278,
              longitude: 105.8342,
              accuracy: 50,
            },
            timestamp: Date.now(),
          }),
      },
    });
  });

  await page.goto("/goi-y/couple");
  await page
    .locator("geolocation button")
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(".place-card")).toHaveCount(12);

  await page.reload();
  await expect(page.locator(".gate-content")).toHaveCount(0);
  await expect(page.locator(".place-card")).toHaveCount(12);
});

test("lite: iOS 10 redirect, bounded DOM, filters and safe external directions", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_4 like Mac OS X) AppleWebKit/603.3.8 Version/10.0 Mobile/14G61 Safari/602.1",
  });
  await grantLocation(context);
  const page = await context.newPage();
  await mockServices(page);
  await page.goto(`${baseURL}/goi-y/couple`);
  await expect(page).toHaveURL(/\/lite\?mode=couple/);
  await expect(page.locator("#results article")).toHaveCount(12);
  await expect(page.locator("#reset")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  expect(await page.locator('script[src*="_next"]').count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator("#random").click();
  await expect(page.locator("#picked article")).toHaveCount(1);
  await expect(page.locator("#picked a")).toHaveAttribute(
    "href",
    /^https:\/\/www.google.com\/maps\/dir\//,
  );
  await page.locator("#search").fill(places[29].name);
  await expect(page.locator("#results article")).toHaveCount(1);
  await page.screenshot({
    path: "artifacts/after/lite-320.png",
    fullPage: true,
  });
  await context.close();
});
