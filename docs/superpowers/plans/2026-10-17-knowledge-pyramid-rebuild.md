# Cockpit Knowledge Pyramid Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Rebuild the cockpit knowledge galaxy into an L0-L6 drill-down pyramid with separate technical paths and page-level evidence, beginning with a complete Display/SerDes sample and ending with full-domain migration.

**Architecture:** Add a validated primary-parent hierarchy beside the existing typed technical graph and evidence graph. Compile all three into `docs/graph.json`; the browser derives breadcrumbs, direct children, path-grouped technical relations and citations from that one static artifact. Legacy learning and source indexes remain reachable but are marked as navigation-only so they cannot appear as technical explanation.

**Tech Stack:** Node.js ES modules, JSON content packs, native browser JavaScript, Canvas 2D, HTML/CSS, Node test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-17-knowledge-pyramid-rebuild-design.md`

## Global Constraints

- Keep the site static: no backend, framework, database or runtime dependency.
- Preserve 3D idle rotation, dragging, zoom, hover enlargement, search, source loading and Markdown download.
- Every published node except `root` has exactly one `primaryParentId`; parent levels are consecutive and acyclic.
- Platform and runtime domain remain scope/facet data unless a documented platform-specific implementation requires a variant node.
- Navigation relations never appear as technical explanations.
- A technical relation requires structured `why`, input/handoff/output meaning, verification points and evidence status before default publication.
- Unknown model, VMID, display ID, GPIO, SerDes part, physical wiring, timing and version remain explicit unknowns.
- Existing source URLs, public learning links and all 299 public source records remain usable.
- Page-level evidence retains its current status; this change must not promote `documented_reference` or `inferred_mapping` to current-vehicle fact.
- Use the F-drive T12T optimized family and complete the 21-skill applicability check on every architecture-analysis turn.
- The local folder is not a Git checkout. End each task with a passing verification checkpoint; publish only after final review through one atomic GitHub Git Data commit.

## Review Focus

1. **Parent cycles or hidden orphans:** any explicit or fallback assignment must fail the build when it creates a cycle, skips a level or leaves a node unreachable from `root` (Task 1 tests).
2. **Evidence/source parent loops:** evidence must parent under its source only in the hierarchy while `supported_by` retains its technical evidence direction; traversal must not loop (Tasks 1 and 3 tests).
3. **Shared MT8668/MT8676 nodes:** a shared entity keeps one primary path and platform facets; implementation differences remain variant relations instead of duplicate parents (Tasks 2 and 5 tests).
4. **Missing technical content:** a classified node without structured knowledge shows “资料尚未吸收” and never receives generated role/input/output claims (Tasks 3 and 7 tests).
5. **Large child sets and narrow screens:** raw sources and course nodes remain searchable and drillable without rendering hundreds of labels or overflowing the mobile detail panel (Tasks 4 and 7 tests).

---

### Task 1: Primary hierarchy schema, compiler and validation

**Files:**
- Create: `content/hierarchy.json`
- Create: `scripts/lib/hierarchy-model.mjs`
- Create: `tests/hierarchy-model.test.mjs`
- Create: `tests/fixtures/hierarchy-valid.json`
- Create: `tests/fixtures/hierarchy-invalid.json`
- Modify: `scripts/build-graph.mjs`
- Modify: `tests/graph.test.mjs`

**Interfaces:**
- Consumes: the navigation nodes built in `scripts/build-graph.mjs`, semantic nodes returned by `compileKnowledgeGraph()`, source `category`, and evidence `sourceId`.
- Produces: `loadHierarchy(path)`, `applyHierarchy(nodes, hierarchy)`, `validateHierarchy(nodes, {rootId})`, and `buildHierarchyEdges(nodes)` in `scripts/lib/hierarchy-model.mjs`.
- Output node fields: `primaryParentId`, `hierarchyLevel`, `hierarchyOrder`, `branchType`, `navigationOnly` and optional `knowledge`.
- Output edge type: `primary_contains`, `pathClass: "hierarchy"`, `layer: "hierarchy"`.

- [x] **Step 1: Write failing hierarchy tests**

Add tests that require:

```js
assert.deepEqual(validateHierarchy(validNodes,{rootId:'root'}),[]);
assert.deepEqual(breadcrumbIds(validNodes,'component:physical-display'),[
  'root','pyramid:functional','domain:display','chain:display-output','component:physical-display'
]);
for (const fragment of ['missing parent','cycle','level gap','unreachable','multiple assignment'])
  assert.ok(invalidIssues.some(issue=>issue.includes(fragment)));
```

Add graph-level assertions that every published node has one primary parent except root and every node is reachable through only `primary_contains` edges.

- [x] **Step 2: Run the new tests and verify RED**

Run: `node --test tests/hierarchy-model.test.mjs tests/graph.test.mjs`  
Expected: FAIL because hierarchy helpers, hierarchy data and `primary_contains` do not exist.

- [x] **Step 3: Implement the hierarchy model**

Create `content/hierarchy.json` with:

- L1 branch nodes: `pyramid:platform`, `pyramid:functional`, `pyramid:process`, `pyramid:lifecycle`, `pyramid:diagnosis`, `pyramid:raw`, `pyramid:course`.
- L2 course index nodes: `pyramid:course:chapters`, `pyramid:course:lessons`, `pyramid:course:reviews`.
- Explicit assignments for semantic/navigation knowledge nodes.
- Deterministic rules for course chapters, lessons/reviews, raw sources and evidence.

Implement:

```js
loadHierarchy(filePath) -> Promise<HierarchyDefinition>
applyHierarchy(nodes, hierarchy) -> Node[]
validateHierarchy(nodes, {rootId='root'}) -> string[]
buildHierarchyEdges(nodes) -> Edge[]
breadcrumbIds(nodes, nodeId) -> string[]
```

Fallback rules are exact: chapter → `pyramid:course:chapters`; lesson → `pyramid:course:lessons`; review → `pyramid:course:reviews`; source → matching `subtopic:raw:<category>`; evidence → `sourceId`. A fallback may not overwrite an explicit assignment.

- [x] **Step 4: Integrate hierarchy compilation**

In `scripts/build-graph.mjs`, load and apply hierarchy after all navigation, semantic, source and evidence nodes exist; append `primary_contains` edges; fail before writing when `validateHierarchy()` returns issues. Add `meta.hierarchy` counts and declare hierarchy separately from navigation/knowledge/evidence layers.

- [x] **Step 5: Run Task 1 tests and full suite**

Run: `npm run build:data`  
Expected: graph generation succeeds with hierarchy counts.

Run: `npm test`  
Expected: all tests pass with no orphan, cycle, level-gap or link regression.

- [x] **Step 6: Record Task 1 checkpoint**

Record changed files and the fresh test totals in the implementation log section of this plan. Do not publish yet.

---

### Task 2: Display and SerDes evidence-backed pyramid sample

**Files:**
- Modify: `content/hierarchy.json`
- Modify: `content/domain-packs/hmi-media.json`
- Create: `tests/display-pyramid.test.mjs`
- Modify: `tests/domain-coverage.test.mjs`

**Interfaces:**
- Consumes: hierarchy validation from Task 1 and current HMI claims `claim:hmi:001` through `claim:hmi:005`.
- Produces: the exact drill path `root → pyramid:functional → domain:display → chain:display-output → component:physical-display` and enriched `knowledge` objects for the display sample.
- Technical relation fields: `why`, `input`, `handoff`, `output`, `verification`.

- [x] **Step 1: Write failing Display/SerDes tests**

Require:

```js
assert.deepEqual(pathTitles('component:physical-display'),[
  '座舱知识','功能域','显示与触控','显示输出链','物理屏 / SerDes'
]);
assert.equal(displayToHost.pathClass,'data');
assert.match(displayToHost.why,/合成|提交|显示数据/);
assert.deepEqual(displayToHost.claims[0].evidenceIds,['ev:hmi:001']);
assert.deepEqual(hostToPanel.claims[0].evidenceIds,['ev:hmi:002']);
assert.ok(backlight.pathClass==='control'||backlight.pathClass==='power');
```

Assert that physical display knowledge contains a non-title role, upstream input, downstream result, observation list and a limit that mentions unknown part/wiring/version details.

- [x] **Step 2: Run the sample tests and verify RED**

Run: `node --test tests/display-pyramid.test.mjs`  
Expected: FAIL because display hierarchy branches and structured explanations are absent.

- [x] **Step 3: Add display hierarchy branches and knowledge fields**

Add `chain:display-output` at L3 and assign Android HWC/SurfaceFlinger, Yocto DRM/Weston, physical display/SerDes and backlight directly beneath it at L4. Put their interfaces, mechanisms, states, observations and failure modes at L5. Enrich the four components and first-frame observation with evidence-bounded role/input/mechanism/output/observations/limits.

- [x] **Step 4: Enrich display technical relations**

Add structured relation explanations to `rel:hmi:001` through `rel:hmi:005`. Keep page 16 evidence as `documented_reference`; do not name a SerDes part, displayId, GPIO, physical connector or exact scanout protocol not present in the evidence.

- [x] **Step 5: Run Task 2 tests and full suite**

Run: `npm run build:data`  
Run: `node --test tests/display-pyramid.test.mjs tests/domain-coverage.test.mjs tests/graph.test.mjs`  
Run: `npm test`  
Expected: all pass; the sample has separate data, control/power and diagnostic relations.

- [x] **Step 6: Record Task 2 checkpoint**

Record sample path, evidence IDs and test totals. Do not publish yet.

---

### Task 3: Pyramid reader model and non-generic explanations

**Files:**
- Modify: `docs/graph-model.js`
- Modify: `tests/graph-ui-model.test.mjs`
- Modify: `tests/reader-actions.test.mjs`

**Interfaces:**
- Consumes: `primaryParentId`, `hierarchyLevel`, `primary_contains`, structured node `knowledge`, structured technical relations and existing claims/evidence.
- Produces: `buildHierarchyIndex(graph)`, `buildBreadcrumb(graph,nodeId)`, `directChildren(graph,nodeId)`, `groupTechnicalRelations(graph,nodeId)`, and an expanded `buildReaderModel()` result.
- Reader result fields: `breadcrumb`, `responsibility`, `children`, `technicalPaths`, `observations`, `citations`, `navigation`, `contentState`.

- [x] **Step 1: Write failing reader-model tests**

Require the physical display reader to return the exact breadcrumb, responsibility fields and direct children. Require technical path groups for `data`, `control`, `power`, `state`, and `diagnostic`; empty groups remain absent.

Add regression tests that:

- `belongs_to`, `主题归类`, `内容索引` and `课程顺序` appear only in `navigation`.
- A node with no structured knowledge has `contentState: 'awaiting_absorption'` and no generated technical rationale.
- Evidence under a source does not create traversal loops.
- Markdown uses the same breadcrumb, responsibility and path explanations as the UI model.

- [x] **Step 2: Run reader-model tests and verify RED**

Run: `node --test tests/graph-ui-model.test.mjs tests/reader-actions.test.mjs`  
Expected: FAIL because pyramid fields and grouped paths do not exist.

- [x] **Step 3: Implement hierarchy and technical-path selectors**

Implement the exported functions above. `groupTechnicalRelations()` must include only typed technical edges and must use relation `why` as the primary explanation. Existing generic rationale is allowed only as a clearly labeled fallback for old, non-default content during migration; it must never be returned for `awaiting_absorption` nodes.

- [x] **Step 4: Rebuild the reader model and Markdown output**

Order the model as: breadcrumb → responsibility → children → technical paths → observations → citations → folded navigation. Preserve direct/adjacent citation status, page numbers, evidence boundaries, load/open/download actions and safe filenames.

- [x] **Step 5: Run Task 3 tests and full suite**

Run: `node --test tests/graph-ui-model.test.mjs tests/reader-actions.test.mjs`  
Run: `npm test`  
Expected: all pass; classification cannot populate technical explanation.

- [x] **Step 6: Record Task 3 checkpoint**

Record exported interface names and test totals. Do not publish yet.

---

### Task 4: 3D drill visibility, breadcrumbs and detail-panel information architecture

**Files:**
- Modify: `docs/app.js`
- Modify: `docs/index.html`
- Modify: `docs/style.css`
- Modify: `docs/space-scene.js`
- Modify: `tests/reader-ui.test.mjs`
- Modify: `tests/space-scene.test.mjs`

**Interfaces:**
- Consumes: reader fields from Task 3 and current scene projection/label helpers.
- Produces: `drillVisibleNodeIds(graph,{selectedId,expandedDepth,evidenceVisible})`, breadcrumb controls, child drill cards, grouped path cards and folded navigation UI.
- Interaction contract: selecting a child recenters it; breadcrumb buttons select ancestors; home selects `root`; blank click returns to root overview.

- [x] **Step 1: Write failing UI and scene tests**

Require static structure for: `reader-breadcrumb`, `reader-responsibility`, `reader-children`, `reader-paths`, `reader-observations`, `reader-citations`, and `reader-navigation`.

Add scene tests that root view shows L1 nodes, selected view shows ancestors + selected + direct children + capped technical neighbors, and a source category with hundreds of children respects the existing front-label cap.

Add mobile CSS assertions for horizontal breadcrumb scrolling, full-width drill cards and no detail-panel overflow at narrow widths.

- [x] **Step 2: Run UI tests and verify RED**

Run: `node --test tests/reader-ui.test.mjs tests/space-scene.test.mjs`  
Expected: FAIL because drill sections and hierarchy-aware visibility are absent.

- [x] **Step 3: Implement hierarchy-aware visibility and focus**

Add `drillVisibleNodeIds()` in `docs/space-scene.js` and integrate it into `refreshVisible()`. Keep evidence hidden until requested. Preserve search matches and selected/hovered labels as forced priorities while keeping their cap.

- [x] **Step 4: Rebuild the detail panel**

Render sections in the spec order. Use buttons for breadcrumb and children. Put navigation-only relations in a collapsed `<details>` block. Show “资料尚未吸收” when `contentState` requires it; do not render empty technical cards.

- [x] **Step 5: Style the pyramid without replacing the galaxy design**

Add hierarchy depth cues, path colors and compact cards while retaining the current background, node colors, hover scaling and 3D orbit. Ensure reduced-motion behavior remains unchanged.

- [x] **Step 6: Run Task 4 tests and full suite**

Run: `node --check docs/app.js`  
Run: `node --check docs/graph-model.js`  
Run: `node --check docs/space-scene.js`  
Run: `node --test tests/reader-ui.test.mjs tests/space-scene.test.mjs`  
Run: `npm test`  
Expected: syntax and all tests pass.

- [x] **Step 7: Record Task 4 checkpoint**

Record the desktop/mobile behavior covered and test totals. Do not publish yet.

---

### Task 5: Platform, runtime, virtualization and cross-domain migration

**Files:**
- Modify: `content/hierarchy.json`
- Modify: `content/domain-packs/platform-runtime.json`
- Modify: `tests/domain-coverage.test.mjs`
- Create: `tests/platform-pyramid.test.mjs`

**Interfaces:**
- Consumes: hierarchy and relation schemas from Tasks 1–3.
- Produces: drill branches and structured knowledge for MT8668, MT8676, Hypervisor, Android Guest, Yocto Host, MCU, TBox, Binder, FDBus, SOME/IP, Vsock, virtio and SPI/IPCL.

- [x] **Step 1: Write failing platform pyramid tests**

Assert unique primary paths, one shared MT8668/MT8676 family relation, visible runtime boundaries, and structured relation explanations for cross-domain handoffs. Assert Binder remains Android-internal unless a specific cross-domain relation says otherwise.

- [x] **Step 2: Run tests and verify RED**

Run: `node --test tests/platform-pyramid.test.mjs`  
Expected: FAIL on missing branches/knowledge/relation explanations.

- [x] **Step 3: Migrate platform-runtime content**

Create hierarchy branches for platform scope, runtime domains and cross-domain transport. Add role/input/mechanism/output/observations/limits to each entity and structured explanations to every default technical relation. Preserve unknown VMID, protocol usage and current-vehicle applicability.

- [x] **Step 4: Verify Task 5**

Run: `npm run build:data`  
Run: `node --test tests/platform-pyramid.test.mjs tests/domain-coverage.test.mjs tests/graph.test.mjs`  
Expected: all pass.

- [x] **Step 5: Record Task 5 checkpoint**

Record migrated entity/relation counts and unresolved version fields.

---

### Task 6: Power, lifecycle and MCU migration

**Files:**
- Modify: `content/hierarchy.json`
- Modify: `content/domain-packs/power.json`
- Modify: `content/power-taxonomy.json`
- Modify: `tests/power-knowledge.test.mjs`
- Create: `tests/power-pyramid.test.mjs`

**Interfaces:**
- Consumes: existing detailed power taxonomy, evidence claims and hierarchy compiler.
- Produces: pyramid branches from vehicle inputs through MCU/SoC handshake, Host/Guest barriers, suspend residency, wake and resume; separate control, state, power and diagnostic paths.

- [x] **Step 1: Write failing power pyramid tests**

Require root-to-leaf paths for ACC/state policy, MCU–SoC handshake, primary/backup supply, Host/Guest suspend barrier, device suspend, low-power residency, wake source and business resume. Assert software state and physical power result remain distinct.

- [x] **Step 2: Run tests and verify RED**

Run: `node --test tests/power-pyramid.test.mjs tests/power-knowledge.test.mjs`  
Expected: FAIL on new hierarchy and structured explanations.

- [x] **Step 3: Migrate power content**

Reuse the current two-level taxonomy as L3/L4 branches, attach semantic states/components/observations at L4/L5, and enrich all published power relations. Preserve current evidence status and avoid fixed MCU code/GPIO/tick interpretations without a current dictionary.

- [x] **Step 4: Verify Task 6**

Run: `npm run build:data`  
Run: `node --test tests/power-pyramid.test.mjs tests/power-knowledge.test.mjs tests/graph.test.mjs`  
Expected: all pass.

- [x] **Step 5: Record Task 6 checkpoint**

Record branch counts, technical relation counts and evidence gaps.

---

### Task 7: HMI/media, connectivity/lifecycle and assurance full-domain migration

**Files:**
- Modify: `content/hierarchy.json`
- Modify: `content/domain-packs/hmi-media.json`
- Modify: `content/domain-packs/connectivity-lifecycle.json`
- Modify: `content/domain-packs/assurance.json`
- Modify: `tests/domain-coverage.test.mjs`
- Create: `tests/full-pyramid-coverage.test.mjs`

**Interfaces:**
- Consumes: validated sample pattern and all domain-specific T12T boundaries.
- Produces: structured hierarchy and explanations for display/touch, Camera/AVM, audio, Ethernet/Wi-Fi/phone link, TBox, boot, USB/storage, TEE, stability, performance, DB/KE, log storm and TPM closure.

- [x] **Step 1: Write failing full-domain coverage tests**

For every semantic entity assert a root-reachable primary path and one of:

- structured knowledge with role plus at least two of input/mechanism/output; or
- explicit `contentState: 'awaiting_absorption'` with no generated technical claims.

For every default technical relation assert structured `why`, path class, evidence status and at least one verification point. Add domain-specific assertions that Camera control/frame paths, audio playback/capture, Ethernet physical/L3, USB connector/controller/block/filesystem, TEE transport/service/storage, stability direct-failure/recovery and performance observation chains remain separate.

- [x] **Step 2: Run coverage tests and verify RED**

Run: `node --test tests/full-pyramid-coverage.test.mjs`  
Expected: FAIL listing each unmigrated entity/relation.

- [x] **Step 3: Migrate remaining HMI/media knowledge**

Complete touch, Camera/AVM and audio branches with domain-specific knowledge and relation explanations. Keep control requests separate from frame/PCM data and observation paths.

- [x] **Step 4: Migrate connectivity/lifecycle knowledge**

Add Ethernet, wireless, phone-link, TBox, boot, USB/storage and TEE branches. Keep physical link, L3 connectivity, service availability and business success as separate stages.

- [x] **Step 5: Migrate assurance knowledge**

Add stability, performance, DB/KE, log retention/storm and TPM branches. Preserve cause/aggravator/consequence and direct failure/recovery/cleanup distinctions.

- [x] **Step 6: Verify Task 7**

Run: `npm run build:data`  
Run: `node --test tests/full-pyramid-coverage.test.mjs tests/domain-coverage.test.mjs tests/graph.test.mjs`  
Run: `npm test`  
Expected: all pass; no semantic entity is silently filled with generic content.

- [x] **Step 7: Record Task 7 checkpoint**

Record migrated, awaiting-absorption and evidence-status counts per domain.

---

### Task 8: Local browser acceptance and regression repair

**Files:**
- Modify as required by observed failures only: `docs/app.js`, `docs/graph-model.js`, `docs/space-scene.js`, `docs/index.html`, `docs/style.css`, relevant tests
- Update: `README.md`

**Interfaces:**
- Consumes: complete built site from Tasks 1–7.
- Produces: browser-verified desktop/mobile behavior and user-facing documentation.

- [x] **Step 1: Start the local site and test the approved scenario**

Run: `node scripts/serve.mjs`  
In a browser, verify the exact path to physical display/SerDes, breadcrumb return, child drill, separate data/control/power/diagnostic sections, page-16 citation, load/download and “awaiting absorption” behavior.

- [x] **Step 2: Test global interactions**

Verify root idle rotation, drag, zoom, hover enlargement, search, filters, evidence toggle, blank-click reset, source category with many children, narrow mobile layout and reduced-motion behavior.

- [x] **Step 3: Repair each observed defect with TDD**

For every defect, first add a focused failing test in the owning test file, verify RED, implement the smallest correction, then rerun that file.

- [x] **Step 4: Update README**

Document the L0–L6 pyramid, horizontal technical paths, evidence status, drill controls and the difference between migrated knowledge and awaiting-absorption nodes.

- [x] **Step 5: Run the complete local verification gate**

Run: `npm run build:data`  
Run: `node --check docs/app.js`  
Run: `node --check docs/graph-model.js`  
Run: `node --check docs/space-scene.js`  
Run: `npm test`  
Expected: every command exits 0 with no failed test.

- [x] **Step 6: Record Task 8 checkpoint**

Record the fresh full-suite total and browser scenarios checked.

---

### Task 9: Independent review, atomic GitHub publish and live verification

**Files:**
- Review all changed files from Tasks 1–8
- Publish the changed repository paths to `qiantao18817568425-art/Cockpit_Knowledge_Galaxy`

**Interfaces:**
- Consumes: verified local artifacts and current GitHub `main` head.
- Produces: one reviewed commit and a successful GitHub Pages deployment.

- [x] **Step 1: Run an independent whole-change review**

Review for Critical/Important findings with focus on hierarchy correctness, technical direction, evidence boundaries, platform variants, drill visibility, accessibility and Markdown parity. Fix findings with a failing test first.

- [x] **Step 2: Re-run the final verification gate**

Run all Task 8 Step 5 commands again after review fixes. Record exact pass counts and generated node/edge/hierarchy statistics.

- [x] **Step 3: Verify the GitHub lease**

Read the current `main` head immediately before publishing. If it differs from the expected parent, inspect the new commit and rebuild the tree on the new head; do not overwrite concurrent changes.

- [x] **Step 4: Publish one atomic commit**

Create blobs for every changed file, a tree based on the verified head, a commit named `feat: rebuild cockpit knowledge as drill-down pyramid`, and update `main` with `expected_sha` lease protection.

- [ ] **Step 5: Wait for Pages and verify live assets**

Require the Pages workflow to complete successfully. Fetch cache-busted `index.html`, `app.js`, `graph-model.js`, `space-scene.js` and `graph.json`; require HTTP 200 and the new hierarchy fields/section IDs.

- [ ] **Step 6: Perform live scenario verification**

Open the public site and repeat the physical display/SerDes drill. Verify the deployed UI matches local behavior and that citations load/download successfully.

- [ ] **Step 7: Report delivery and evidence limits**

Provide the live URL, commit link, test totals, hierarchy coverage counts, migrated/awaiting-absorption counts, 21-skill source/coverage statement, deeply used specialties and remaining raw-document evidence gaps.

## Implementation Log

Fill this section during native execution. Each checkpoint records timestamp, task, changed files, commands, pass/fail totals and unresolved evidence gaps. Do not mark a task complete from code inspection alone.

- 2026-10-17 Task 1 — Added `content/hierarchy.json`, hierarchy compiler/validator, fixtures and reachability tests; build produced 632 nodes before the display sample and the suite passed 51/51. Evidence gap: hierarchy placement does not imply current-vehicle applicability.
- 2026-10-17 Task 2 — Added the Display/SerDes L0–L5 sample, structured responsibilities and relation explanations for `rel:hmi:001`–`005`; build produced 637 nodes/2013 edges and the suite passed 54/54. Evidence remains `documented_reference`; SerDes part, wiring, displayId, GPIO and exact timing remain unknown.
- 2026-10-17 Task 3 — Added hierarchy selectors, breadcrumbs, direct children, grouped technical paths, scoped citations and Markdown parity. Citation traversal is limited to the selected node plus one technical hop; unrelated sibling sources are excluded.
- 2026-10-17 Task 4 — Added hierarchy-aware 3D visibility, child and breadcrumb drill controls, five path filters, folded navigation, mobile full-screen reader and internal-only preview scrolling. Browser QA passed at desktop and 390×844.
- 2026-10-17 Task 5 — Migrated platform/runtime knowledge: MT8668 and MT8676 share one family path with explicit variant evidence; Android Guest, Yocto Host, Hypervisor, MCU, TBox and transport boundaries are structured. Binder remains Android-internal.
- 2026-10-17 Task 6 — Migrated the power pyramid into 10 L3 categories and 20 L4 paths; control, state, physical power and diagnostic paths remain separate. Fixed codes, GPIO/IRQ, tick units and current-vehicle wiring remain evidence gaps.
- 2026-10-17 Task 7 — Migrated HMI/media, connectivity/lifecycle and assurance domains. The published semantic set contains 111 entities and 72 technical relations; 106 entities are absorbed and 5 display L5 nodes are explicitly awaiting absorption.
- 2026-10-17 Task 8 — Browser-verified physical display/SerDes, platform, power, virtualization, evidence loading/download and mobile layout. Fixed unrelated citation expansion, evidence sibling expansion, empty citation counting, duplicate legacy topic search results and mobile preview viewport shift. Independent review then fixed per-platform evidence scope, Markdown source downloads, relation verification display, platform-filtered citations and platform-exclusive technical-edge leakage. Final local build produced 666 nodes/2083 edges and 79/79 tests passed; all JavaScript syntax checks passed.

