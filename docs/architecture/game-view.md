# Minimal 3D game view

## Boundary

`GameTableView` is a presentation adapter for the read-only `GameViewModel`.
It emits only typed `OfcHandAction` values already enumerated by the runner. It
does not import an engine reducer, a data-provider implementation, Playroom, or
any provider SDK. The R3F scene is contained under `packages/client/src/game-view`.

## Table and camera

Every table is rotated so the viewer is the bottom seat. Two seats oppose one
another, three seats use the bottom and upper sides, and four seats use every
side. Each seat renders three separate slot groups with fixed capacities:
front `3`, middle `5`, and back `5`.

The orthographic camera uses a slightly higher, wider framing below 700 CSS
pixels and reduces its zoom whenever the actual canvas is too short or narrow
for the complete scene. Desktop player details reserve a left rail beside the
canvas instead of covering it. The status and card-control regions reserve
their own top and bottom space. Small screens use dedicated score, board, and
card-control regions so essential controls are not clipped. Mobile canvases
render at the device pixel ratio up to `3`; desktop retains a `1.5` upper bound
for its substantially larger drawing surface.

## Lighting, cards, and states

The table uses one warm directional key light, soft ambient light, restrained
shadows, a dark green felt racetrack table, and high-contrast ivory cards. Card faces
use generated canvas textures with rank and suit glyphs and bounded anisotropic
filtering for the angled camera view. Fantasyland cards that must remain hidden
use one blue-and-brass back. Selected cards lift and gain a gold outline; legal
row slots use a green highlight. Equivalent DOM labels say `Selected`, `Place
in …`, or `… unavailable`, so state never depends on color.

## Motion and accessibility

Motion is limited to a 160 ms selected-card transition and is never used to
delay action submission. `prefers-reduced-motion: reduce` changes that duration
to zero. Status, scores, errors, controls, row counts, public card names, hidden
card counts, connection state, and Fantasyland state all have semantic DOM
representations. Pointer and keyboard interaction enter the same typed action
path.

WebGL support is checked before rendering. Canvas initialization errors are
caught by a component error boundary. In either case, the accessible DOM board
and controls remain usable and the user receives a plain-language fallback.
