export type ResponsiveLayoutMode =
  "desktop" | "mobile-portrait" | "mobile-landscape";

export interface ResponsiveViewportInvariant {
  readonly name: string;
  readonly mode: ResponsiveLayoutMode;
  readonly width: number;
  readonly height: number;
  readonly isMobile: boolean;
  readonly hasTouch: boolean;
}

export interface ResponsiveLayoutInvariants {
  readonly rootTestId: string;
  readonly headerSelector: string;
  readonly resultsSelector: string;
  readonly actionSelector: string;
  readonly playerSectionSelector: string;
  readonly scrollContainerSelector: string;
  readonly overflowTolerancePx: number;
  readonly minimumHitTargetPx: number;
}

export const RESPONSIVE_VIEWPORTS: readonly ResponsiveViewportInvariant[] =
  Object.freeze([
    Object.freeze({
      name: "desktop",
      mode: "desktop",
      width: 1440,
      height: 1000,
      isMobile: false,
      hasTouch: false,
    }),
    Object.freeze({
      name: "mobile portrait",
      mode: "mobile-portrait",
      width: 393,
      height: 852,
      isMobile: true,
      hasTouch: true,
    }),
    Object.freeze({
      name: "mobile landscape",
      mode: "mobile-landscape",
      width: 852,
      height: 393,
      isMobile: true,
      hasTouch: true,
    }),
  ]);

export const RESPONSIVE_LAYOUT_INVARIANTS: ResponsiveLayoutInvariants =
  Object.freeze({
    rootTestId: "game-view",
    headerSelector: ".game-hud-top",
    resultsSelector: ".game-showdown",
    actionSelector: ".game-header-actions button",
    playerSectionSelector: "[data-testid='player-card-section']",
    scrollContainerSelector: ".game-showdown",
    overflowTolerancePx: 1,
    minimumHitTargetPx: 44,
  });
