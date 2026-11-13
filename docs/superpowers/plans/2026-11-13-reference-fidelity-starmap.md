# Reference fidelity desktop starmap implementation plan

> **For agentic workers:** Implement each task in this worktree, checking tests before claiming completion.

**Goal:** Make the desktop knowledge galaxy resemble the supplied dense, cinematic star map while preserving real graph behavior.

**Architecture:** A pure geometry builder creates visual-only clustered filaments. The existing WebGL scene renders them behind real graph nodes and real gold edges. The HTML/CSS shell exposes seven actual architecture shortcuts and folds advanced controls.

**Tech Stack:** Static HTML/CSS, browser ES modules, bundled Three.js, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-13-reference-fidelity-starmap-design.md`

## Global constraints

- Use real graph IDs and relations for every interactive node and highlighted route.
- Keep visual texture noninteractive and deterministic.
- Preserve current reader, filters, fallback, and desktop-only scope.
- Do not use another browser path after the origin permission denial.

## Review focus

- Graph updates add nodes: the scene must derive counts and positions from the current graph.
- Hover and filters may replace the overview route; route segments must remain actual edges.
- Visual geometry must not enter raycasting or reader state.
- Reduced motion and hidden-document behavior must still stop animation.
- Narrow windows and WebGL failure must continue to use the existing fallback.

### Task 1: Geometry and route

**Files:** `docs/starmap-webgl.js`, `docs/space-scene.js`, `tests/starmap-webgl.test.mjs`

- [x] Add failing tests for deterministic ambient mesh density, valid decorative segment endpoints, and the verified overview route.
- [x] Run the tests and confirm their expected failure.
- [x] Implement the pure geometry and route model.
- [x] Run the focused tests to green.

### Task 2: WebGL visual composition

**Files:** `docs/starmap-webgl.js`, `tests/starmap-webgl.test.mjs`

- [x] Add a focused scene contract test for decorative layers staying outside the interactive hit cloud.
- [x] Render clustered cyan/blue filament points and links, depth stars, stronger major nodes, and the actual gold route.
- [x] Keep context loss, pause, and dispose behavior passing.

### Task 3: Compact desktop shell

**Files:** `docs/index.html`, `docs/ui-polish.css`, `docs/app.js`, `docs/app-three.js`, `docs/boot.js`, `tests/three-ui.test.mjs`, `tests/asset-versioning.test.mjs`

- [x] Add failing structure checks for shortcuts, disclosure, and compact scene controls.
- [x] Replace the desktop panel structure and styling; wire shortcuts and toolbar actions.
- [x] Bump one release version across page assets and module imports.
- [x] Run focused tests, syntax checks, and the full suite; explain any unrelated data-source failures.

### Task 4: Delivery

- [ ] Check the diff and current main, commit the isolated branch, and create a PR.
- [ ] Merge under the user's existing publication authorization.
- [ ] Verify GitHub Pages serves the new release and report the visual QA limit.
