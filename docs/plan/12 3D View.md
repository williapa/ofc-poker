# Prompt 12 - Establish the minimal 3D game-view design system

## Goal

Create a minimal, readable tabletop presentation using React Three Fiber. Define camera, lighting, card geometry/materials, board layout for two through four seats, animation principles, color/typography tokens, responsive behavior, and a DOM overlay for controls and text that should remain accessible. Keep rendering behind the game-view boundary.

## Acceptance criteria

- The scene clearly distinguishes front, middle, and back rows and their `3 / 5 / 5` capacities for every seat count.
- Cards have legible rank/suit faces, consistent backs, visible selected/valid-target states, and stable orientation for the local player.
- Camera and layout remain usable at representative mobile and desktop viewport sizes without clipping essential controls.
- Motion is restrained, respects reduced-motion preferences, and does not block input correctness.
- Status, scores, buttons, error messages, and essential card information have an accessible DOM representation; gameplay does not depend on color alone.
- The WebGL canvas has a graceful unsupported/error fallback.
- View components consume typed view-model data and emit view actions; they do not import the engine reducer or provider SDK.
- Rendering/component tests cover seat layouts, row labels/capacities, accessibility semantics, and fallback behavior.

## Usage
20 percent