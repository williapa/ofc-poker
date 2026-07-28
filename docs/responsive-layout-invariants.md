# Responsive layout invariants

Prompt 21 adds mobile browser support without weakening the desktop game view.
These invariants translate the prompt acceptance criteria into checks that can
be shared by component, layout, and Playwright coverage.

## Viewport matrix

The game view must satisfy the same structural rules in these browser shapes:

| Mode             | Viewport    | Browser inputs         |
| ---------------- | ----------- | ---------------------- |
| Desktop          | 1440 x 1000 | Mouse and keyboard     |
| Laptop           | 1440 x 810  | Mouse and keyboard     |
| Mobile portrait  | 393 x 852   | Touch, mobile viewport |
| Mobile landscape | 852 x 393   | Touch, mobile viewport |

The laptop size models the shorter browser content area from a 1440 x 900
MacBook display. The mobile sizes intentionally use common narrow and short
constraints rather than idealized device dimensions. Passing them is the
minimum bar; later visual review can add more screenshots without changing the
contract.

## Invariants

1. The root game view is viewport-contained. Its bounding rectangle must not
   exceed `window.innerWidth` or `window.innerHeight` by more than one pixel, and
   the document itself must not become the vertical scrolling surface.
2. The results container is the only scrollable game-view region during
   showdown. If showdown content is taller than the available space,
   `.game-showdown` scrolls internally while the header, action button, and root
   view remain fixed inside the viewport.
3. The results container never overlaps the top header. The bottom edge of
   `.game-hud-top` must be less than or equal to the top edge of
   `.game-showdown` in every viewport.
4. The primary game action remains reachable. Any visible button inside
   `.game-header-actions` must be fully inside the viewport, meet a 44 x 44 CSS
   pixel minimum hit target, and be the topmost element at its center point.
5. Each player's card section is fully visible and isolated. The rendered card
   section for every seat must be inside the viewport and must not overlap
   another player's card section, player details, or the header.
6. Horizontal overflow is never acceptable. `document.documentElement` and
   `.game-view` must fit within the viewport width, allowing only the one-pixel
   browser rounding tolerance.

## Test contract

The shared constants live in
`packages/client/src/game-view/responsive-layout-invariants.ts`. Browser tests
should import `RESPONSIVE_VIEWPORTS` and run the same geometry assertions for
tall desktop, laptop, mobile portrait, and mobile landscape. Pure scene-layout
tests additionally prove that every two-to-four-player card-section rectangle
is disjoint and that the orthographic camera fits the complete scene to its
actual canvas size. The player-card selector remains
`[data-testid='player-card-section']` for a future DOM geometry hook around the
Three.js-rendered sections.
