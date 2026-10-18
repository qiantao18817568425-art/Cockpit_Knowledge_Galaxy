# Cockpit Architecture Galaxy Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the knowledge galaxy around one “智能座舱” root, 17 architecture dimensions and detailed multi-parent L3 clusters while preserving the existing 3D galaxy, evidence reader and download functions.

**Architecture:** Replace the current parallel platform/function/course/raw/TPM branches with a validated architecture taxonomy. Existing semantic entities remain the technical facts; L2/L3 nodes provide the navigation skeleton, while Day lessons, sources, skills, cases and TPM responsibilities become references or metadata on L3/L4 nodes. The browser consumes one compiled `graph.json`, lays out each L2 as the center of an L3 cluster and reveals L4 only after L3 selection.

**Tech Stack:** Node.js ES modules, JSON content packs, native browser JavaScript, Canvas 2D projected 3D scene, HTML/CSS, Node test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-cockpit-architecture-galaxy-restructure-design.md`

## Global Constraints

- L1 is exactly `智能座舱` and the root node id remains `root` for stable URLs and state.
- L2 contains exactly the approved 17 names in the approved order.
- Home renders L1, all L2 labels, every L3 star and L1→L2/L2→L3 structure edges.
- Home hides L3 labels during idle rotation; L3 labels appear only for hover, search hit, selection or the current drill chain.
- L4 does not render on home and becomes visible only after selecting its L3 parent.
- Every L3 has exactly one `primaryParentId` and may have multiple `secondaryParentIds`; one knowledge entity is never duplicated to simulate multi-membership.
- Secondary membership uses a thinner, dimmer hierarchy edge and never changes the deterministic breadcrumb.
- Day/Week, source, skill, log case and TPM data are attached to L3/L4; none becomes an independent home branch.
- All 299 public source records retain usable load/download URLs and evidence status; mapping does not promote an indexed document to a verified technical conclusion.
- Public case content is sanitized and evidence-bounded; the raw `I:\T29-8678\日志` tree is not copied to GitHub.
- MT8668/MT8676 shared behavior, differences and unknown current-vehicle applicability remain separate.
- Preserve search, path filters, platform filters, idle orbit, drag, zoom, hover enlargement, reduced motion, inline reference loading and Markdown export.
- The F-drive optimized T12T family is the authoritative skill source and all 21 skills receive an applicability check for each architecture-analysis turn.
- `I:\座舱知识\Cockpit_Knowledge_Galaxy` is the editable source but is not a Git checkout; publishing must use a clean checkout and an explicit allowlist so the dirty `_publish_repo_20261017_pyramid` deletions are never propagated.

## Review Focus

1. **Multi-parent cycles or duplicate entities:** secondary membership must reference existing L2 parents, must not affect the primary breadcrumb and must never clone an L3 node (Task 1 tests).
2. **L3 label leakage on home:** an idle or merely front-facing L3 must stay unlabeled; hover, search and selected/current-chain states must reveal it (Task 5 tests).
3. **Old standalone branches surviving migration:** `原始资料`, `架构课程` and `TPM 分责与闭环` must not appear as root children after compilation (Task 2 tests).
4. **Broad or misleading evidence mapping:** every public source reference must target an L3/L4 id and carry mapping basis/status; indexed sources cannot be rendered as verified claims (Task 3 tests).
5. **Dense clusters and small screens:** all 17 L2 centers, their L3 stars and cross-membership edges must remain navigable without label floods, clipping or an unreadably narrow reader (Tasks 5–7 tests).

---

### Task 1: Architecture taxonomy schema and multi-parent validation

**Files:**
- Create: `content/architecture-taxonomy.json`
- Modify: `scripts/lib/hierarchy-model.mjs`
- Modify: `tests/hierarchy-model.test.mjs`
- Create: `tests/fixtures/architecture-taxonomy-invalid.json`

**Interfaces:**
- Consumes: existing semantic node ids and the stable root id `root`.
- Produces: `loadArchitectureTaxonomy(filePath)`, `applyArchitectureTaxonomy(nodes, definition)`, `validateSecondaryParents(nodes, {allowedParentLevel: 1})`, and `buildSecondaryHierarchyEdges(nodes)`.
- L3 fields: `primaryParentId: string`, `secondaryParentIds: string[]`, `hierarchyLevel: 2`, `branchType: "architecture-chain"`.
- Secondary edge fields: `type: "secondary_contains"`, `pathClass: "hierarchy-secondary"`, `layer: "hierarchy"`, `navigationOnly: true`.

- [x] **Step 1: Write failing schema tests**

Require exactly 17 unique L2 nodes in the approved order. Add one L3 fixture with one primary and two secondary parents and assert one entity id, one primary edge and two secondary edges. Require validation errors for missing secondary parents, self-membership, duplicate secondary ids, primary repeated as secondary and secondary parents outside L2.

- [x] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/hierarchy-model.test.mjs`
Expected: FAIL because the taxonomy loader and secondary-parent helpers do not exist.

- [x] **Step 3: Implement the taxonomy model**

Add the four exported functions with the exact signatures above. Keep `buildHierarchyEdges(nodes)` responsible only for primary edges so existing root reachability and edge-count invariants remain deterministic.

- [x] **Step 4: Add the approved L1/L2 skeleton**

Create `content/architecture-taxonomy.json` with root title `智能座舱` and these exact ordered L2 id/title pairs:

1. `system-concepts` = `系统概念介绍`
2. `mtk-platform` = `MTK平台介绍`
3. `mcu-soc` = `MCU与SOC分工`
4. `android-hmi-display` = `Android、HMI 与显示`
5. `app-framework` = `应用与Framework`
6. `hal-driver-hardware` = `HAL/驱动/硬件抽象`
7. `camera-perception` = `Camera、环视与舱内感知`
8. `audio` = `音频架构`
9. `tbox` = `TBox`
10. `can-ethernet` = `CAN与以太网`
11. `soa` = `SOA架构`
12. `virtual-communication` = `虚拟化通讯`
13. `power` = `电源管理`
14. `upgrade-security` = `升级与信息安全`
15. `time-sync` = `时间同步`
16. `performance-resources` = `性能与资源`
17. `diagnosis-evidence` = `诊断与证据`

- [x] **Step 5: Run Task 1 tests**

Run: `node --test tests/hierarchy-model.test.mjs`
Expected: PASS with 17 ordered L2 nodes and multi-parent validation covered.

---

### Task 2: Build the complete L3 architecture skeleton and remove old root branches

**Files:**
- Modify: `content/architecture-taxonomy.json`
- Replace: `content/hierarchy.json`
- Modify: `scripts/build-graph.mjs`
- Create: `tests/architecture-taxonomy.test.mjs`
- Modify: `tests/graph.test.mjs`
- Modify: `tests/full-pyramid-coverage.test.mjs`

**Interfaces:**
- Consumes: Task 1 taxonomy helpers and existing semantic ids from all domain packs.
- Produces: compiled nodes with L1=`root`, L2=`architecture:<id>`, L3=`chain:<id>` or existing stable chain ids, and L4 semantic entities.
- Build metadata: `meta.architecture = {l2Count, l3Count, multiParentL3Count, l4Count}`.

- [x] **Step 1: Write failing topology tests**

Assert root title `智能座舱`, exactly 17 direct children in the approved order, at least one L3 under every L2, and no root child titled `原始资料`, `架构课程`, `TPM 分责与闭环`, `整机与平台`, `功能域`, `业务流程` or `跨域与生命周期`. Assert representative shared nodes: SOME/IP belongs to CAN/以太网 and SOA; STR 显示恢复 belongs to电源、显示和诊断; TBox 远程唤醒 belongs to TBox、电源和 CAN/以太网.

- [x] **Step 2: Run topology tests and verify RED**

Run: `node --test tests/architecture-taxonomy.test.mjs tests/graph.test.mjs`
Expected: FAIL on the current seven legacy root branches.

- [x] **Step 3: Author the L3 catalog**

For every L2, add concrete L3 chains that cover the existing 111 semantic entities and the accepted examples in the spec. Give each L3 a role, upstream/downstream summary, primary parent, optional secondary parents, order and stable source ids. Keep the detailed power taxonomy as children of the new power L3 chains instead of a separate branch.

- [x] **Step 4: Migrate primary assignments**

Replace `content/hierarchy.json` assignments so every semantic entity has one L3 primary parent or one L4 parent within an L3 chain. Remove `pyramid:*`, `pyramid:raw`, `pyramid:course`, `chain:tpm-closure` and their old assignments from the compiled hierarchy.

- [x] **Step 5: Integrate taxonomy compilation**

In `scripts/build-graph.mjs`, load the architecture taxonomy before applying the hierarchy; append secondary membership edges after primary hierarchy validation. Keep old topic/chapter/course/source nodes available only as hidden reference/index nodes, never as root hierarchy children.

- [x] **Step 6: Build and verify Task 2**

Run: `npm run build:data`
Run: `node --test tests/architecture-taxonomy.test.mjs tests/graph.test.mjs tests/full-pyramid-coverage.test.mjs`
Expected: PASS; all 17 L2 have L3 children, every published technical entity is root-reachable and no old standalone branch remains on home.

---

### Task 3: Map Day lessons, sources, skills, log cases and TPM responsibility into L3/L4

**Files:**
- Create: `content/learning-mapping.json`
- Create: `content/skill-mapping.json`
- Create: `content/case-register.json`
- Modify: `content/source-register.json`
- Modify: `scripts/build-graph.mjs`
- Create: `scripts/index-log-cases.mjs`
- Create: `tests/reference-mapping.test.mjs`
- Modify: `tests/source-register.test.mjs`
- Modify: `tests/domain-coverage.test.mjs`

**Interfaces:**
- Consumes: L3/L4 ids from Task 2, 44 Day lessons and 25 reviews, 299 source records, the 21 T12T skill ids, and local log case metadata.
- Produces: `dayIds[]`, `sourceClaims[]`, `skillIds[]`, `caseIds[]`, `responsibility`, and `verification` on compiled L3/L4 nodes.
- Source mapping record: `{knowledgeId, basis, status, pages?, versionScope?}` where `status` is `indexed`, `needs_review`, `page_verified` or `case_verified`.
- Case record: `{id, symptom, scope, clocks, bootGeneration, knowledgeIds, skillIds, evidenceState, publicSummary}` with no raw secret-bearing payload.

- [x] **Step 1: Write failing reference-mapping tests**

Require every Day/Week, source and skill record to target at least one existing L3/L4 id. Require all 299 sources to avoid L1/L2-only targets and to carry a mapping basis/status. Require every L3 to expose at least one of lesson/source/skill/case references or an explicit `referenceState: "awaiting_review"`. Require no TPM-only hierarchy node.

- [x] **Step 2: Run mapping tests and verify RED**

Run: `node --test tests/reference-mapping.test.mjs tests/source-register.test.mjs`
Expected: FAIL because mappings currently terminate at broad domain nodes and no skill/case registry exists.

- [x] **Step 3: Add explicit course and skill mappings**

Map Day 1–44 and reviews from their actual titles/content to L3/L4 ids; do not use `classify()` regex as the published mapping authority. Map all 21 skills to their applicable technical chains and keep the three entry skills available across diagnosis cases without creating skill nodes on home.

- [x] **Step 4: Refine all source mappings**

Convert each source register entry from broad domain ids to specific L3/L4 ids and add mapping reason/status. Preserve `indexed` or `container_indexed` when pages have not been verified; only existing page-backed evidence may use `page_verified`.

- [x] **Step 5: Build the sanitized case registry**

Use `scripts/index-log-cases.mjs --source "I:\T29-8678\日志" --output content/case-register.json` to inventory case boundaries and metadata. Publish only sanitized summaries that pass the evidence fields; leave unreviewed cases as local index records or `evidenceState: "indexed"` without a root-cause claim.

- [x] **Step 6: Embed TPM roles in chain stages**

Attach trigger, first-round lead, direct failure owner, repair owner, interface/recovery owner, verifier and closure criteria to the applicable L4 stage. Move existing `process:tpm-*` meaning into this metadata and remove those nodes from visible hierarchy output.

- [x] **Step 7: Compile and verify Task 3**

Run: `npm run build:data`
Run: `node --test tests/reference-mapping.test.mjs tests/source-register.test.mjs tests/domain-coverage.test.mjs`
Expected: PASS with all Day/Week, 299 sources and 21 skills mapped to concrete L3/L4 ids and no unreviewed source promoted to technical proof.

---

### Task 4: Reader model for cross-membership and embedded references

**Files:**
- Modify: `docs/graph-model.js`
- Modify: `tests/graph-ui-model.test.mjs`
- Modify: `tests/reader-actions.test.mjs`

**Interfaces:**
- Consumes: primary/secondary hierarchy edges and the reference fields from Task 3.
- Produces: `buildMembershipModel(graph, nodeId)`, expanded `buildReaderModel()` fields `memberships`, `courses`, `skills`, `cases`, `responsibility`, `verification`, and matching Markdown sections.
- Membership result: `{primary, secondary, breadcrumb}` where secondary parents never alter `breadcrumb`.

- [x] **Step 1: Write failing reader-model tests**

Require SOME/IP to show one primary and one secondary architecture membership with a single entity id. Require the reader and Markdown to include course entry, source mapping reason/status, applicable skill, sanitized case, TPM roles and verification criteria. Require indexed/unverified material to display its boundary instead of a confirmed conclusion.

- [x] **Step 2: Run reader tests and verify RED**

Run: `node --test tests/graph-ui-model.test.mjs tests/reader-actions.test.mjs`
Expected: FAIL on missing membership/reference fields.

- [x] **Step 3: Implement membership and reference selectors**

Add `buildMembershipModel()` and extend `buildReaderModel()` without changing the existing technical relation and citation semantics. Deduplicate one source or lesson referenced through multiple memberships.

- [x] **Step 4: Extend Markdown parity**

Add the same memberships, courses, skills, cases, responsibility roles and verification criteria to `readerMarkdown()` while retaining safe UTF-8 filenames and existing URLs.

- [x] **Step 5: Verify Task 4**

Run: `node --test tests/graph-ui-model.test.mjs tests/reader-actions.test.mjs`
Expected: PASS; primary breadcrumbs are stable and cross-memberships are explicit.

---

### Task 5: Home visibility and L3 label rules

**Files:**
- Modify: `docs/space-scene.js`
- Modify: `docs/app.js`
- Modify: `tests/space-scene.test.mjs`

**Interfaces:**
- Consumes: hierarchy levels, current selection, hover id, search result ids and current-chain ids.
- Produces: `homeVisibleNodeIds(graph)`, `drillVisibleNodeIds(...)`, and `visibleLabelIds(candidates, {mode, hoveredId, selectedId, matchingIds, currentChainIds})`.

- [x] **Step 1: Write failing visibility tests**

Assert home node visibility includes root, all 17 L2 and every L3 but excludes L4, sources, lessons, skills, cases and evidence. Assert home label visibility includes only root/L2 while idle; a merely front-facing L3 remains unlabeled; hover/search/selection/current chain reveals the intended L3; mouse leave removes the hover label.

- [x] **Step 2: Run scene tests and verify RED**

Run: `node --test tests/space-scene.test.mjs`
Expected: FAIL because the current root view only shows root children and front-facing nodes may receive labels.

- [x] **Step 3: Implement hierarchy-aware home visibility**

Add `homeVisibleNodeIds()` and update `drillVisibleNodeIds()` so L3 stars and their confirmed L3 relations remain visible on home while L4 waits for L3 selection.

- [x] **Step 4: Implement exact label policy**

Add `visibleLabelIds()` and replace the generic front-label selection on home. Preserve label caps in focused/drill views and preserve hover enlargement, screen-edge clamping and reduced-motion behavior.

- [x] **Step 5: Verify Task 5**

Run: `node --check docs/app.js`
Run: `node --check docs/space-scene.js`
Run: `node --test tests/space-scene.test.mjs`
Expected: PASS with no L3 idle-label leakage.

---

### Task 6: Multi-center 3D cluster layout and drill transitions

**Files:**
- Modify: `docs/space-scene.js`
- Modify: `docs/app.js`
- Modify: `docs/style.css`
- Modify: `tests/space-scene.test.mjs`

**Interfaces:**
- Consumes: 17 ordered L2 nodes, L3 primary membership, L3 secondary membership and hierarchy depth.
- Produces: `buildArchitectureLayout(graph, {rootRadius, l2Radius, l3Radius, l4Spacing})` returning deterministic `{x,y,z}` per node and `edgeVisualStyle(edge)` for primary/secondary hierarchy edges.

- [x] **Step 1: Write failing layout tests**

Require the root at the origin, 17 unique L2 positions on a deterministic 3D shell, each L3 closer to its primary L2 than the root, and cross-membership not to duplicate or relocate the L3. Require `hierarchy-secondary` edges to be thinner and more transparent than primary hierarchy edges.

- [x] **Step 2: Run layout tests and verify RED**

Run: `node --test tests/space-scene.test.mjs`
Expected: FAIL because cluster-centered layout and secondary-edge styling do not exist.

- [x] **Step 3: Implement deterministic cluster layout**

Place root at the total center, distribute L2 centers with the existing Fibonacci-sphere method, place L3 around its primary L2 and reserve local L4 positions for drill mode. Keep stable positions across reloads by deriving order from taxonomy rather than random values.

- [x] **Step 4: Integrate focus transitions**

Clicking L2 recenters its cluster and dims other clusters; clicking L3 recenters it and expands ordered L4; blank click/home returns to the full architecture view. Highlight all primary and secondary memberships on L3 hover without changing the selected breadcrumb.

- [x] **Step 5: Verify Task 6**

Run: `node --check docs/app.js`
Run: `node --check docs/space-scene.js`
Run: `node --test tests/space-scene.test.mjs`
Expected: PASS with deterministic positions and one rendered star per shared L3.

---

### Task 7: Rebuild the right reader and increase readable type sizes

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/app.js`
- Modify: `docs/style.css`
- Modify: `tests/reader-ui.test.mjs`

**Interfaces:**
- Consumes: Task 4 reader model.
- Produces: sections for breadcrumb, architecture role, memberships, current chain, input/mechanism/output, normal completion, abnormal exits, observations/cases, courses, citations, TPM/verification and reference actions.

- [x] **Step 1: Write failing reader UI tests**

Require all approved sections and action buttons. Assert desktop width `clamp(580px, 42vw, 700px)`, topic title `24px`, section titles at least `16px`, main text/cards at least `14px`, metadata at least `12px`, and mobile main text at least `15px` with a full-screen single-column panel.

- [x] **Step 2: Run reader UI tests and verify RED**

Run: `node --test tests/reader-ui.test.mjs`
Expected: FAIL on the current 8.5–12px rules and missing membership/reference sections.

- [x] **Step 3: Render the new reader order**

Update `docs/index.html` and `docs/app.js` to render the model in the spec order. Preserve inline preview, open-source and download buttons, and keep navigation-only relations folded.

- [x] **Step 4: Apply readable desktop/mobile styling**

Replace the small main-content sizes with the exact minima above. Keep auxiliary badges compact only when they still meet the 12px minimum.

- [x] **Step 5: Verify Task 7**

Run: `node --check docs/app.js`
Run: `node --test tests/reader-ui.test.mjs tests/reader-actions.test.mjs`
Expected: PASS with complete reader sections and accessible type sizes.

---

### Task 8: Full local build, browser acceptance and documentation

**Files:**
- Modify as required by observed failures: files owned by Tasks 1–7 and their tests
- Modify: `README.md`

**Interfaces:**
- Consumes: complete static site and generated `docs/graph.json`.
- Produces: locally verified desktop/mobile behavior and updated repository documentation.

- [ ] **Step 1: Run the complete automated gate**

Run: `npm run build:data`
Run: `node --check docs/app.js`
Run: `node --check docs/graph-model.js`
Run: `node --check docs/space-scene.js`
Run: `npm test`
Expected: every command exits 0; graph metadata reports 17 L2, nonzero L3 and at least one multi-parent L3.

- [ ] **Step 2: Start the local site and verify desktop scenarios**

Run: `node scripts/serve.mjs`. Verify home visibility/labels, idle orbit, drag/zoom, L2 cluster focus, L3→L4 expansion, SOME/IP cross-membership, STR display recovery cross-membership, source load/download, Markdown export and blank-click reset.

- [ ] **Step 3: Verify mobile and accessibility scenarios**

At 390×844 verify no label flood, no clipped reader, full-screen single-column content, keyboard focus on controls and reduced-motion behavior.

- [ ] **Step 4: Repair observed defects with focused tests**

For each defect, add a failing assertion to the owning test, verify RED, implement the smallest correction and rerun that test before the full gate.

- [ ] **Step 5: Update README**

Document the 17-dimension architecture, L3 hover behavior, cross-membership lines, L4 drill, embedded Day/source/skill/case/TPM information, evidence states and local build commands.

- [ ] **Step 6: Re-run the full automated gate**

Run all Task 8 Step 1 commands again and record exact test/node/edge/reference coverage totals in the implementation log.

---

### Task 9: Clean publication and live GitHub Pages verification

**Files:**
- Publish only the explicitly changed paths from Tasks 1–8 to `qiantao18817568425-art/Cockpit_Knowledge_Galaxy`

**Interfaces:**
- Consumes: verified source tree and current GitHub `main` head.
- Produces: one reviewed commit, successful Pages deployment and cache-busted live verification.

- [ ] **Step 1: Create or refresh a clean publication checkout**

Use a new clean checkout under `I:\座舱知识\_publish_repo_20261018_architecture`; verify `origin/main` and confirm `git status --short` is empty before copying files. Do not use the dirty `_publish_repo_20261017_pyramid` checkout.

- [ ] **Step 2: Copy an explicit allowlist and review the diff**

Copy only changed content, scripts, tests, docs assets, README and the approved spec/plan. Require `git diff --stat` and `git status --short` to contain no deletion of raw files, source registers or workflow files unless that deletion is an explicit Task 1–8 change.

- [ ] **Step 3: Run verification in the clean checkout**

Run the complete Task 8 automated gate in the clean checkout. Expected: identical generated counts and all tests pass.

- [ ] **Step 4: Review and commit**

Inspect the full diff for hierarchy correctness, evidence boundaries, accidental secrets and unrelated deletions. Commit as `feat: organize galaxy by cockpit architecture` only after the review is clean.

- [ ] **Step 5: Push with remote-head protection**

Fetch `origin/main`, confirm the planned parent has not moved, rebase/rebuild and retest if it has, then push the reviewed commit.

- [ ] **Step 6: Wait for Pages and verify live assets**

Require the Pages workflow to succeed. Fetch cache-busted `index.html`, `app.js`, `graph-model.js`, `space-scene.js`, `style.css` and `graph.json`; require HTTP 200 and the new 17-L2 metadata.

- [ ] **Step 7: Perform the live acceptance path**

Open the public page and repeat the home→L2→L3→L4 path, cross-membership highlighting, reader references and download actions. Report the live URL, commit, test totals, mapping coverage, 21-skill source/coverage and remaining evidence gaps.

## Implementation Log

Fill this section during native execution. Each checkpoint records timestamp, task, changed files, commands, pass/fail totals, generated L2/L3/L4 counts, mapping coverage and unresolved evidence gaps. A task is complete only after its specified verification passes.
