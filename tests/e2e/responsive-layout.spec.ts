import { expect, test, type Browser } from "@playwright/test";
import {
  RESPONSIVE_LAYOUT_INVARIANTS,
  RESPONSIVE_VIEWPORTS,
  type ResponsiveViewportInvariant,
} from "../../packages/client/src/game-view/responsive-layout-invariants";
import { resolveCanvasDpr } from "../../packages/client/src/game-view/rendering";
import { completeHand, createTable } from "./helpers";

const ACTIVE_CARD_VIEWPORTS = RESPONSIVE_VIEWPORTS.filter(
  ({ name }) => name !== "desktop",
);
const HIGH_DENSITY_MOBILE_CASES: readonly {
  readonly viewport: ResponsiveViewportInvariant;
  readonly deviceScaleFactor: 2 | 3;
}[] = [
  {
    viewport: requiredViewport("mobile portrait"),
    deviceScaleFactor: 3,
  },
  {
    viewport: requiredViewport("mobile landscape"),
    deviceScaleFactor: 2,
  },
];

test("keeps the game layout bounded across desktop and mobile viewports", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    const page = await openViewport(browser, test.info().project.use.baseURL, {
      width: viewport.width,
      height: viewport.height,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
    });
    try {
      await createTable(page, `Ada ${viewport.name}`, "local-ai", "4");
      await completeHand([page]);
      await expect(
        page.getByRole("heading", { name: "Showdown" }),
      ).toBeVisible();

      const geometry = await page.evaluate((invariants) => {
        const root = document.querySelector(
          `[data-testid='${invariants.rootTestId}']`,
        );
        const header = document.querySelector(invariants.headerSelector);
        const results = document.querySelector(invariants.resultsSelector);
        const action = document.querySelector(invariants.actionSelector);
        const scrollContainer = document.querySelector(
          invariants.scrollContainerSelector,
        );
        const scrollingElement = document.scrollingElement;

        if (
          root === null ||
          header === null ||
          results === null ||
          action === null ||
          scrollContainer === null ||
          scrollingElement === null
        ) {
          return { foundRequiredElements: false };
        }

        const rootBox = root.getBoundingClientRect();
        const headerBox = header.getBoundingClientRect();
        const resultsBox = results.getBoundingClientRect();
        const actionBox = action.getBoundingClientRect();
        const scrollContainerBox = scrollContainer.getBoundingClientRect();
        const rootStyle = getComputedStyle(root);
        const resultsStyle = getComputedStyle(results);
        const actionCenterX = actionBox.left + actionBox.width / 2;
        const actionCenterY = actionBox.top + actionBox.height / 2;
        const topmostActionElement = document.elementFromPoint(
          actionCenterX,
          actionCenterY,
        );
        const scrollableElements = Array.from(
          root.querySelectorAll<HTMLElement>("*"),
        )
          .filter((element) => element !== scrollContainer)
          .filter((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            const visible = box.width > 0 && box.height > 0;
            const verticalOverflow =
              element.scrollHeight > element.clientHeight + 1;
            const horizontalOverflow =
              element.scrollWidth > element.clientWidth + 1;
            const scrollStyle = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
            const canScroll = /auto|scroll/i.test(scrollStyle);
            return (
              visible && canScroll && (verticalOverflow || horizontalOverflow)
            );
          })
          .map((element) => ({
            tagName: element.tagName.toLowerCase(),
            className: element.className,
            testId: element.dataset.testid,
            ariaLabel: element.getAttribute("aria-label"),
          }));

        return {
          foundRequiredElements: true,
          layoutMode:
            root instanceof HTMLElement ? root.dataset.layoutMode : undefined,
          documentScrollHeight: scrollingElement.scrollHeight,
          documentClientHeight: scrollingElement.clientHeight,
          documentScrollWidth: scrollingElement.scrollWidth,
          documentClientWidth: scrollingElement.clientWidth,
          rootWidth: rootBox.width,
          rootHeight: rootBox.height,
          rootOverflow: rootStyle.overflow,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          headerBottom: headerBox.bottom,
          headerRight: headerBox.right,
          resultsTop: resultsBox.top,
          resultsLeft: resultsBox.left,
          resultsRight: resultsBox.right,
          resultsBottom: resultsBox.bottom,
          resultsOverflowX: resultsStyle.overflowX,
          resultsOverflowY: resultsStyle.overflowY,
          resultsScrollHeight: results.scrollHeight,
          resultsClientHeight: results.clientHeight,
          scrollContainerMatchesResults: scrollContainer === results,
          scrollContainerTop: scrollContainerBox.top,
          scrollContainerBottom: scrollContainerBox.bottom,
          actionLeft: actionBox.left,
          actionTop: actionBox.top,
          actionRight: actionBox.right,
          actionBottom: actionBox.bottom,
          actionWidth: actionBox.width,
          actionHeight: actionBox.height,
          actionIsTopmost:
            topmostActionElement === action ||
            action.contains(topmostActionElement),
          scrollableElements,
        };
      }, RESPONSIVE_LAYOUT_INVARIANTS);

      expect(geometry, viewport.name).toMatchObject({
        foundRequiredElements: true,
        layoutMode: viewport.mode,
      });
      if (!geometry.foundRequiredElements) continue;

      const tolerance = RESPONSIVE_LAYOUT_INVARIANTS.overflowTolerancePx;
      expect(geometry.rootWidth, viewport.name).toBeLessThanOrEqual(
        geometry.viewportWidth + tolerance,
      );
      expect(geometry.rootHeight, viewport.name).toBeLessThanOrEqual(
        geometry.viewportHeight + tolerance,
      );
      expect(geometry.rootOverflow, viewport.name).toBe("hidden");
      expect(geometry.documentScrollWidth, viewport.name).toBeLessThanOrEqual(
        geometry.documentClientWidth + tolerance,
      );
      expect(geometry.documentScrollHeight, viewport.name).toBeLessThanOrEqual(
        geometry.documentClientHeight + tolerance,
      );
      expect(geometry.headerBottom, viewport.name).toBeLessThanOrEqual(
        geometry.resultsTop + tolerance,
      );
      expect(geometry.headerRight, viewport.name).toBeLessThanOrEqual(
        geometry.viewportWidth + tolerance,
      );
      expect(geometry.resultsLeft, viewport.name).toBeGreaterThanOrEqual(
        -tolerance,
      );
      expect(geometry.resultsRight, viewport.name).toBeLessThanOrEqual(
        geometry.viewportWidth + tolerance,
      );
      expect(geometry.resultsBottom, viewport.name).toBeLessThanOrEqual(
        geometry.viewportHeight + tolerance,
      );
      expect(geometry.scrollContainerMatchesResults, viewport.name).toBe(true);
      expect(geometry.scrollContainerTop, viewport.name).toBe(
        geometry.resultsTop,
      );
      expect(geometry.scrollContainerBottom, viewport.name).toBe(
        geometry.resultsBottom,
      );
      expect(geometry.resultsOverflowX, viewport.name).toBe("hidden");
      expect(geometry.resultsOverflowY, viewport.name).toBe("auto");
      expect(
        geometry.resultsScrollHeight,
        viewport.name,
      ).toBeGreaterThanOrEqual(geometry.resultsClientHeight);
      expect(geometry.scrollableElements, viewport.name).toEqual([]);
      expect(geometry.actionLeft, viewport.name).toBeGreaterThanOrEqual(
        -tolerance,
      );
      expect(geometry.actionTop, viewport.name).toBeGreaterThanOrEqual(
        -tolerance,
      );
      expect(geometry.actionRight, viewport.name).toBeLessThanOrEqual(
        geometry.viewportWidth + tolerance,
      );
      expect(geometry.actionBottom, viewport.name).toBeLessThanOrEqual(
        geometry.viewportHeight + tolerance,
      );
      expect(geometry.actionWidth, viewport.name).toBeGreaterThanOrEqual(
        RESPONSIVE_LAYOUT_INVARIANTS.minimumHitTargetPx,
      );
      expect(geometry.actionHeight, viewport.name).toBeGreaterThanOrEqual(
        RESPONSIVE_LAYOUT_INVARIANTS.minimumHitTargetPx,
      );
      expect(geometry.actionIsTopmost, viewport.name).toBe(true);
    } finally {
      await page.context().close();
    }
  }
});

test("keeps active card sections separate from player details", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  for (const viewport of ACTIVE_CARD_VIEWPORTS) {
    const playerCounts =
      viewport.mode === "desktop"
        ? (["4"] as const)
        : (["2", "3", "4"] as const);
    for (const playerCount of playerCounts) {
      const page = await openViewport(
        browser,
        test.info().project.use.baseURL,
        {
          width: viewport.width,
          height: viewport.height,
          isMobile: viewport.isMobile,
          hasTouch: viewport.hasTouch,
        },
      );
      try {
        await createTable(
          page,
          `Ada ${viewport.name} ${playerCount}`,
          "local-ai",
          playerCount,
        );
        await expect(
          page.getByRole("button", { name: "Confirm initial five" }),
        ).toBeVisible();

        const geometry = await page.evaluate((invariants) => {
          const root = document.querySelector(
            `[data-testid='${invariants.rootTestId}']`,
          );
          const header = document.querySelector(invariants.headerSelector);
          const scoreboard = document.querySelector(".game-scoreboard");
          const canvas = document.querySelector(".game-canvas-region");
          const scrollingElement = document.scrollingElement;

          if (
            root === null ||
            header === null ||
            scoreboard === null ||
            canvas === null ||
            scrollingElement === null
          ) {
            return { foundRequiredElements: false };
          }

          const rootBox = root.getBoundingClientRect();
          const headerBox = header.getBoundingClientRect();
          const scoreboardBox = scoreboard.getBoundingClientRect();
          const canvasBox = canvas.getBoundingClientRect();
          const headerRowItems = [
            header.firstElementChild,
            header.querySelector(".game-status"),
            header.querySelector(".game-header-actions"),
            [...header.querySelectorAll("button")].find((button) =>
              button.textContent?.includes("Leave table"),
            ) ?? null,
          ].filter((element): element is Element => element !== null);
          const headerItemBoxes = headerRowItems.map((element) =>
            element.getBoundingClientRect(),
          );
          const headerItemsShareRow =
            headerItemBoxes.length === 4 &&
            Math.max(...headerItemBoxes.map(({ top }) => top)) <
              Math.min(...headerItemBoxes.map(({ bottom }) => bottom));
          const overlap =
            scoreboardBox.left < canvasBox.right &&
            scoreboardBox.right > canvasBox.left &&
            scoreboardBox.top < canvasBox.bottom &&
            scoreboardBox.bottom > canvasBox.top;

          return {
            foundRequiredElements: true,
            layoutMode:
              root instanceof HTMLElement ? root.dataset.layoutMode : undefined,
            rootWidth: rootBox.width,
            rootHeight: rootBox.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            documentScrollHeight: scrollingElement.scrollHeight,
            documentClientHeight: scrollingElement.clientHeight,
            documentScrollWidth: scrollingElement.scrollWidth,
            documentClientWidth: scrollingElement.clientWidth,
            headerBottom: headerBox.bottom,
            scoreboardLeft: scoreboardBox.left,
            scoreboardTop: scoreboardBox.top,
            scoreboardRight: scoreboardBox.right,
            scoreboardBottom: scoreboardBox.bottom,
            canvasLeft: canvasBox.left,
            canvasTop: canvasBox.top,
            canvasRight: canvasBox.right,
            canvasBottom: canvasBox.bottom,
            headerItemsShareRow,
            scoreboardOverlapsCanvas: overlap,
          };
        }, RESPONSIVE_LAYOUT_INVARIANTS);

        expect(geometry, `${viewport.name} ${playerCount}`).toMatchObject({
          foundRequiredElements: true,
          layoutMode: viewport.mode,
          scoreboardOverlapsCanvas: false,
        });
        if (!geometry.foundRequiredElements) continue;

        const label = `${viewport.name} ${playerCount}`;
        const tolerance = RESPONSIVE_LAYOUT_INVARIANTS.overflowTolerancePx;
        expect(geometry.rootWidth, label).toBeLessThanOrEqual(
          geometry.viewportWidth + tolerance,
        );
        expect(geometry.rootHeight, label).toBeLessThanOrEqual(
          geometry.viewportHeight + tolerance,
        );
        expect(geometry.documentScrollWidth, label).toBeLessThanOrEqual(
          geometry.documentClientWidth + tolerance,
        );
        expect(geometry.documentScrollHeight, label).toBeLessThanOrEqual(
          geometry.documentClientHeight + tolerance,
        );
        expect(geometry.scoreboardLeft, label).toBeGreaterThanOrEqual(
          -tolerance,
        );
        expect(geometry.scoreboardTop, label).toBeGreaterThanOrEqual(
          geometry.headerBottom - tolerance,
        );
        expect(geometry.scoreboardRight, label).toBeLessThanOrEqual(
          geometry.viewportWidth + tolerance,
        );
        expect(geometry.canvasLeft, label).toBeGreaterThanOrEqual(-tolerance);
        expect(geometry.canvasTop, label).toBeGreaterThanOrEqual(
          geometry.headerBottom - tolerance,
        );
        expect(geometry.canvasRight, label).toBeLessThanOrEqual(
          geometry.viewportWidth + tolerance,
        );
        expect(geometry.canvasBottom, label).toBeLessThanOrEqual(
          geometry.viewportHeight + tolerance,
        );
        if (viewport.mode === "mobile-landscape") {
          expect(geometry.canvasTop, label).toBeLessThanOrEqual(
            geometry.headerBottom + tolerance,
          );
          expect(geometry.canvasBottom, label).toBeGreaterThanOrEqual(
            geometry.viewportHeight - tolerance,
          );
          expect(geometry.scoreboardBottom, label).toBeGreaterThanOrEqual(
            geometry.viewportHeight - tolerance,
          );
          expect(geometry.scoreboardRight, label).toBeLessThanOrEqual(
            geometry.canvasLeft + tolerance,
          );
          expect(geometry.headerItemsShareRow, label).toBe(true);
        }
      } finally {
        await page.context().close();
      }
    }
  }
});

test("renders mobile cards at the high-density display resolution", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  for (const { viewport, deviceScaleFactor } of HIGH_DENSITY_MOBILE_CASES) {
    const page = await openViewport(browser, test.info().project.use.baseURL, {
      width: viewport.width,
      height: viewport.height,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      deviceScaleFactor,
    });
    try {
      await createTable(
        page,
        `Ada ${viewport.name} DPR ${deviceScaleFactor}`,
        "local-ai",
        "4",
      );
      const canvas = page.locator(".game-canvas-region canvas");
      await expect(canvas).toBeVisible();

      const expectedDpr = resolveCanvasDpr(viewport.mode, deviceScaleFactor);
      const label = `${viewport.name} DPR ${deviceScaleFactor}`;
      await expect
        .poll(
          () =>
            canvas.evaluate((element) => {
              if (!(element instanceof HTMLCanvasElement)) {
                throw new TypeError("Expected the Three.js canvas");
              }
              return element.width / element.getBoundingClientRect().width;
            }),
          { message: `${label} canvas backing resolution` },
        )
        .toBeCloseTo(expectedDpr, 2);

      const resolution = await canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
          throw new TypeError("Expected the Three.js canvas");
        }
        const bounds = element.getBoundingClientRect();
        return {
          cssWidth: bounds.width,
          cssHeight: bounds.height,
          backingWidth: element.width,
          backingHeight: element.height,
          devicePixelRatio: window.devicePixelRatio,
        };
      });

      expect(resolution.devicePixelRatio, label).toBe(deviceScaleFactor);
      expect(resolution.backingWidth / resolution.cssWidth, label).toBeCloseTo(
        expectedDpr,
        2,
      );
      expect(
        resolution.backingHeight / resolution.cssHeight,
        label,
      ).toBeCloseTo(expectedDpr, 2);
    } finally {
      await page.context().close();
    }
  }
});

function requiredViewport(name: string): ResponsiveViewportInvariant {
  const viewport = RESPONSIVE_VIEWPORTS.find(
    (candidate) => candidate.name === name,
  );
  if (viewport === undefined) {
    throw new RangeError(`Missing responsive viewport: ${name}`);
  }
  return viewport;
}

async function openViewport(
  browser: Browser,
  baseURL: unknown,
  options: {
    readonly width: number;
    readonly height: number;
    readonly isMobile: boolean;
    readonly hasTouch: boolean;
    readonly deviceScaleFactor?: number;
  },
) {
  const context = await browser.newContext({
    baseURL: typeof baseURL === "string" ? baseURL : undefined,
    viewport: { width: options.width, height: options.height },
    isMobile: options.isMobile,
    hasTouch: options.hasTouch,
    deviceScaleFactor: options.deviceScaleFactor,
  });
  return context.newPage();
}
