# Evidence-backed Cockpit Knowledge Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current document-category graph with an evidence-backed cockpit knowledge graph that maps all 299 public sources to version-scoped entities, typed relations, page evidence, and an explorable 3D interface.

**Architecture:** Keep the static GitHub Pages application and dependency-free Node build. Author knowledge in focused domain-pack JSON files, validate them with a shared model library, compile them with the existing chapter/course graph, and reveal source/evidence nodes only on demand. Use an offline Python exporter for the local SQLite evidence library; the committed public JSON contains no local paths or copied source text.

**Tech Stack:** Node.js ES modules, Node test runner, browser Canvas 2D with 3D projection, HTML/CSS, Python 3 standard-library `sqlite3`, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-17-evidence-knowledge-graph-design.md`

## Global Constraints

- The public source register contains exactly 299 deduplicated documents and no `I:\` paths.
- Every default-visible technical relation has at least one reviewed page or section evidence record.
- Preserve MT8668, MT8676, T12T, PVT, reference-platform, and current-vehicle scope separately.
- Render control, data, and power paths with distinct relation classes.
- Preserve idle rotation, hover enlargement, click-to-center, search, zoom, and the existing chapter/course/raw-source links.
- Source and evidence nodes stay hidden until the user asks to expand evidence.
- Unknown GPIO, IRQ, VMID, state-code, error-code, timeout, and threshold values remain version-scoped or unknown.
- Candidate or visually unreviewed knowledge cannot appear as a confirmed current-vehicle fact.

## Review Focus

- A source has readable metadata but no extracted text: retain it as `needs_visual_review` and emit no reviewed claim from it; pinned in Task 2 and Task 9 tests.
- Two manual revisions describe the same component differently: keep both evidence records and mark the affected claim `conflicting`; pinned in Task 3 and Task 9 tests.
- An entity is connected across MT8668 and MT8676 without explicit shared scope: validation must fail; pinned in Task 1 tests.
- Hundreds of source/evidence nodes exist: the default view must exclude them and reveal only the selected node's evidence neighborhood; pinned in Task 5 tests.
- A source link or evidence reference is missing: the build must fail before `docs/graph.json` is written; pinned in Task 1, Task 4, and Task 10 tests.

---

## File Structure

### Core model and source data

- Create `scripts/lib/knowledge-model.mjs`: load, merge, validate, and compile domain packs.
- Create `scripts/export-source-register.py`: export public processing metadata from `raw-library.sqlite` and `docs/raw-sources.json`.
- Create `content/source-register.json`: public status for all 299 sources and readable archive members.
- Create `content/domain-packs/power.json`: first complete evidence-backed domain.
- Create `content/domain-packs/platform-runtime.json`: platform, virtualization, Android, Yocto, MCU, and cross-domain knowledge.
- Create `content/domain-packs/hmi-media.json`: display, touch, Camera/AVM, audio, and HMI knowledge.
- Create `content/domain-packs/connectivity-lifecycle.json`: TBox, wired/wireless networking, USB/storage, boot, security, and lifecycle knowledge.
- Create `content/domain-packs/assurance.json`: stability, performance, logs, DB/KE, diagnosis, and TPM evidence boundaries.

Each domain pack owns four arrays: `entities`, `relations`, `claims`, and `evidence`. IDs are globally unique and source IDs refer to `content/source-register.json`.

### Build and browser

- Modify `scripts/build-graph.mjs`: combine legacy navigation nodes with validated semantic nodes and edges.
- Create `docs/graph-model.js`: pure search, layer visibility, evidence expansion, and detail-view functions usable by browser and Node tests.
- Modify `docs/app.js`: render semantic node kinds, typed edges, filters, and evidence details.
- Modify `docs/index.html`: add platform/path/evidence filters and structured detail sections.
- Modify `docs/style.css`: style typed paths, evidence states, filter controls, and responsive details.
- Regenerate `docs/graph.json`.

### Tests and review artifacts

- Create `tests/fixtures/knowledge-model-valid.json` and `tests/fixtures/knowledge-model-invalid.json`.
- Create `tests/knowledge-model.test.mjs`.
- Create `tests/source-register.test.mjs`.
- Create `tests/power-knowledge.test.mjs`.
- Create `tests/graph-ui-model.test.mjs`.
- Create `tests/domain-coverage.test.mjs`.
- Modify `tests/graph.test.mjs`.
- Create `docs/knowledge-coverage.html`: public coverage and review-status report linked from the graph.

---

### Task 1: Define and validate the semantic knowledge model

**Files:**
- Create: `scripts/lib/knowledge-model.mjs`
- Create: `tests/fixtures/knowledge-model-valid.json`
- Create: `tests/fixtures/knowledge-model-invalid.json`
- Create: `tests/knowledge-model.test.mjs`

**Interfaces:**
- Produces: `loadKnowledgeContent(contentRoot: string) -> Promise<KnowledgeModel>`
- Produces: `validateKnowledgeModel(model: KnowledgeModel) -> string[]`
- Produces: `compileKnowledgeGraph(model: KnowledgeModel) -> {nodes: GraphNode[], edges: GraphEdge[], meta: object}`
- `KnowledgeModel` contains `entities`, `relations`, `claims`, `evidence`, and `sources` arrays.

- [ ] **Step 1: Write failing validation tests**

Add tests asserting that the valid fixture returns no issues and the invalid fixture reports duplicate IDs, missing relation endpoints, missing evidence, invalid source IDs, invalid page ranges, unsupported statuses, and an unscoped MT8668-to-MT8676 relation.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/knowledge-model.test.mjs`

Expected: FAIL because `scripts/lib/knowledge-model.mjs` does not exist.

- [ ] **Step 3: Implement the model loader and validator**

Implement the three exported functions. Accept these entity kinds: `platform`, `domain`, `component`, `interface`, `state`, `process`, `observation`, `failure_mode`, `source`, `evidence`. Accept the relation types and evidence statuses defined in the approved spec. Validation returns deterministic, sorted messages and never writes files.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/knowledge-model.test.mjs`

Expected: PASS.

- [ ] **Step 5: Record the task in GitHub**

Commit message: `feat: add evidence knowledge model validation`

### Task 2: Export the complete public source register

**Files:**
- Create: `scripts/export-source-register.py`
- Create: `content/source-register.json`
- Create: `tests/source-register.test.mjs`

**Interfaces:**
- Consumes: `_audit/raw-library.sqlite` via `--db`, `docs/raw-sources.json` via `--catalog`.
- Produces: `content/source-register.json` with `generatedOn`, `documents`, `archiveDocuments`, and `summary`.
- Document fields: `id`, `sha256`, `name`, `format`, `category`, `platform`, `version`, `downloadUrl`, `indexedPages`, `processingState`, `knowledgeIds`, `reviewNote`.

- [ ] **Step 1: Write the failing source-register test**

Assert exactly 299 public documents, unique IDs and SHA-256 values, HTTPS download URLs, no local paths, a processing state for every document, and archive-member status totals matching the SQLite export. Assert zero-byte and system-cache items are absent.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/source-register.test.mjs`

Expected: FAIL because `content/source-register.json` does not exist.

- [ ] **Step 3: Implement the offline exporter**

Add CLI arguments `--db`, `--catalog`, and `--output`. Use read-only SQLite access. Map extracted top-level pages and `archive_documents` into public processing states: `indexed`, `container_indexed`, `needs_visual_review`, `metadata_only`, `superseded_duplicate`. Exclude local paths and page text.

- [ ] **Step 4: Generate the source register**

Run:

```powershell
& 'C:\Users\59413\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/export-source-register.py --db 'I:\座舱知识\_audit\raw-library.sqlite' --catalog docs/raw-sources.json --output content/source-register.json
```

Expected: summary reports 299 public documents and every document has a processing state.

- [ ] **Step 5: Run the focused test**

Run: `node --test tests/source-register.test.mjs`

Expected: PASS.

- [ ] **Step 6: Record the task in GitHub**

Commit message: `feat: add complete source processing register`

### Task 3: Build the evidence-backed power-management domain pack

**Files:**
- Create: `content/domain-packs/power.json`
- Create: `tests/power-knowledge.test.mjs`

**Interfaces:**
- Consumes: source IDs from `content/source-register.json` and the Task 1 model.
- Produces: power entities, relations, claims, and evidence for the common graph compiler.

- [ ] **Step 1: Write the failing power-domain tests**

Assert the pack covers vehicle power inputs, MCU PowerManager, GPIO/SPI/IPCL, Yocto SleepManager, Hypervisor barrier, Android and TBox guests, kernel suspend, ATF, SPM, PMIC/VCORE/DRAM, MT6363 Buck/LDO, wake sources, backup power, and the three event classes `framework_wake`, `suspend_abort`, and `wake_after_suspend`. Require at least one control path, one power path, one state transition, and one observation relation. Require every default-visible relation to resolve through a claim to reviewed evidence.

Add conflict coverage: a relation spanning platform variants without explicit shared scope must be marked `conflicting` or split into scoped claims.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/power-knowledge.test.mjs`

Expected: FAIL because the power pack does not exist.

- [ ] **Step 3: Curate power entities and typed paths**

Use the indexed MT6363 design notice; MT8668 Hypervisor Suspend/Resume manual; MT8676 Android, Yocto, Hypervisor V1.1/V1.2/V1.3 and common-flow manuals; and the T12T power architecture references. Summarize evidence rather than copying source paragraphs. Store exact source IDs and verified page ranges.

- [ ] **Step 4: Mark version and evidence boundaries**

Use `documented_reference` for manual-described paths that lack current-vehicle confirmation, `conflicting` for unresolved version differences, and `needs_visual_review` for diagram-only evidence. Never label a reference-platform edge `confirmed_current`.

- [ ] **Step 5: Run model and power tests**

Run: `node --test tests/knowledge-model.test.mjs tests/power-knowledge.test.mjs`

Expected: PASS.

- [ ] **Step 6: Record the task in GitHub**

Commit message: `feat: add evidence-backed power architecture`

### Task 4: Compile semantic knowledge with legacy chapters and courses

**Files:**
- Modify: `scripts/build-graph.mjs`
- Modify: `tests/graph.test.mjs`
- Regenerate: `docs/graph.json`

**Interfaces:**
- Consumes: `loadKnowledgeContent`, `validateKnowledgeModel`, and `compileKnowledgeGraph` from Task 1.
- Produces: one `docs/graph.json` containing legacy navigation plus semantic nodes, typed relations, evidence counts, layer metadata, and source coverage metadata.

- [ ] **Step 1: Extend graph tests before changing the builder**

Assert all semantic edges resolve, all default-visible technical edges have claims and evidence, evidence/source nodes are tagged as hidden-by-default, power nodes are present, and `meta.sourceCoverage.total` equals 299. Preserve all existing chapter, lesson, review, raw-link, and power-index assertions.

- [ ] **Step 2: Run graph tests and verify failure**

Run: `npm test`

Expected: FAIL on missing semantic graph metadata and nodes.

- [ ] **Step 3: Integrate the semantic compiler**

Load the source register and every JSON file in `content/domain-packs`. Validate before writing. Convert claims into graph edge metadata without removing the existing index relations. Abort the build on any validation issue.

- [ ] **Step 4: Rebuild the graph**

Run: `npm run build:data`

Expected: `Graph generated` plus semantic counts and 299-source coverage.

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Record the task in GitHub**

Commit message: `feat: compile semantic and learning graphs`

### Task 5: Add browser graph-layer behavior and evidence exploration

**Files:**
- Create: `docs/graph-model.js`
- Create: `tests/graph-ui-model.test.mjs`
- Modify: `docs/app.js`
- Modify: `docs/index.html`
- Modify: `docs/style.css`

**Interfaces:**
- Produces: `rankSearchResults(nodes, query, filters) -> GraphNode[]`
- Produces: `visibleNodeIds(graph, state) -> Set<string>`
- Produces: `expandEvidenceNeighborhood(graph, nodeId) -> Set<string>`
- Produces: `detailModel(graph, nodeId) -> DetailModel`
- Browser state fields: `selectedId`, `searchQuery`, `platforms`, `pathClasses`, `evidenceVisible`, `candidateVisible`.

- [ ] **Step 1: Write failing pure-model tests**

Test alias search, platform filters, control/data/power filters, hidden source/evidence defaults, one-node evidence expansion, candidate exclusion, and detail output containing scope, evidence status, source name, page range, and URL.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/graph-ui-model.test.mjs`

Expected: FAIL because `docs/graph-model.js` does not exist.

- [ ] **Step 3: Implement pure graph UI functions**

Keep the functions DOM-free so Node tests and the browser share the same visibility and search rules.

- [ ] **Step 4: Update the 3D renderer and controls**

Add semantic colors and labels, typed edge colors, platform chips, path filters, evidence and candidate toggles, and a relation legend. Keep “座舱知识” centered at idle. Clicking centers the chosen node; clicking blank space returns to the root view. Evidence expansion reveals only evidence linked to the selected knowledge neighborhood.

- [ ] **Step 5: Expand the detail panel**

Render definition, runtime domain, platform/version scope, upstream/downstream typed relations, observations, evidence state, source/version/page, and download link. Use visible text for `confirmed_current`, `documented_reference`, `inferred_mapping`, `conflicting`, and `needs_visual_review`.

- [ ] **Step 6: Run UI-model and full tests**

Run: `node --test tests/graph-ui-model.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 7: Record the task in GitHub**

Commit message: `feat: explore typed knowledge and evidence layers`

### Task 6: Add platform and runtime-domain knowledge

**Files:**
- Create: `content/domain-packs/platform-runtime.json`
- Create: `tests/domain-coverage.test.mjs`

**Interfaces:**
- Consumes: Task 1 schema and Task 2 source IDs.
- Produces: platform, virtualization, Android, Yocto, MCU, cross-domain, and interface claims.

- [ ] **Step 1: Add failing platform/runtime coverage assertions**

Require MT8668 and MT8676 platform nodes; Android Guest, Yocto Host, MCU, TBox, and Hypervisor boundaries; Binder, FDBus, SOME/IP, Vsock, virtio, SPI/IPCL, and GPIO interfaces; control/data distinction; version-scoped VM and interface claims; and observation nodes for sequence, freshness, boot/VM generation, and request IDs.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="platform runtime" tests/domain-coverage.test.mjs`

Expected: FAIL on missing domain pack.

- [ ] **Step 3: Curate the platform/runtime pack from indexed evidence**

Review the 48 virtualization/cross-domain, 34 platform/SDK, 17 Android, 20 Yocto, and 11 MCU source groups. Consolidate repeated manuals into shared entities while retaining revision and platform evidence. Link every contributing source to one or more knowledge IDs or an explicit review state.

- [ ] **Step 4: Run the focused and model tests**

Run: `node --test tests/domain-coverage.test.mjs tests/knowledge-model.test.mjs`

Expected: PASS for the platform/runtime section.

- [ ] **Step 5: Record the task in GitHub**

Commit message: `feat: map cockpit platform and runtime domains`

### Task 7: Add HMI and media knowledge

**Files:**
- Create: `content/domain-packs/hmi-media.json`
- Modify: `tests/domain-coverage.test.mjs`

**Interfaces:**
- Produces: display, touch, Camera/AVM, audio, voice, and HMI claims.

- [ ] **Step 1: Add failing HMI/media coverage assertions**

Require Android and Yocto display branches, physical display and backlight boundaries, input-event delivery, Camera control and frame-data paths, four-camera observations, audio playback and capture/AEC paths, first-frame milestones, and version-scoped DSP/SerDes variants.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="HMI media" tests/domain-coverage.test.mjs`

Expected: FAIL on missing nodes and relations.

- [ ] **Step 3: Curate the HMI/media pack**

Review the 26 display/touch, 36 Camera/video, and 16 audio/voice source groups plus relevant archive documents. Keep Camera control paths separate from frame-data paths and playback separate from capture/AEC. Preserve MT8668/MT8676 and internal/external DSP/amp differences.

- [ ] **Step 4: Run coverage and model tests**

Run: `node --test tests/domain-coverage.test.mjs tests/knowledge-model.test.mjs`

Expected: PASS for HMI/media.

- [ ] **Step 5: Record the task in GitHub**

Commit message: `feat: map cockpit HMI camera and audio knowledge`

### Task 8: Add connectivity, lifecycle, storage, and security knowledge

**Files:**
- Create: `content/domain-packs/connectivity-lifecycle.json`
- Modify: `tests/domain-coverage.test.mjs`

**Interfaces:**
- Produces: TBox, Ethernet, wireless, phone-link, boot, USB/storage, TEE, and lifecycle claims.

- [ ] **Step 1: Add failing connectivity/lifecycle assertions**

Require wired PCS/PHY/carrier/L3 layers; Wi-Fi STA and SoftAP separation; phone-link stages; TBox/modem/remote-wake boundaries; cold boot, STR resume, VM recreate, and process restart distinction; USB connector/controller/block/filesystem/volume layers; and TEE transport/service/storage boundaries.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="connectivity lifecycle" tests/domain-coverage.test.mjs`

Expected: FAIL on missing domain pack.

- [ ] **Step 3: Curate the connectivity/lifecycle pack**

Review the 26 TBox/network, 10 boot/upgrade, 14 USB/storage, and 2 security/TEE source groups plus related archive documents. Keep link, session, data freshness, L3 reachability, lifecycle generation, and secure-service results as separate layers.

- [ ] **Step 4: Run coverage and model tests**

Run: `node --test tests/domain-coverage.test.mjs tests/knowledge-model.test.mjs`

Expected: PASS for connectivity/lifecycle.

- [ ] **Step 5: Record the task in GitHub**

Commit message: `feat: map connectivity lifecycle and security knowledge`

### Task 9: Add assurance knowledge and close all-source mapping

**Files:**
- Create: `content/domain-packs/assurance.json`
- Modify: `tests/domain-coverage.test.mjs`
- Modify: `content/source-register.json`
- Create: `docs/knowledge-coverage.html`

**Interfaces:**
- Produces: stability, performance, log retention, DB/KE, diagnosis, evidence-boundary, and TPM claims.
- Produces: source-to-knowledge coverage status for every public document.

- [ ] **Step 1: Add failing assurance and all-source assertions**

Require restart-level distinctions, boot/VM/process continuity, fixed-order DB/KE evidence gates, CPU/IO/memory/frame-chain observations, log producer/caller/retention distinctions, and TPM trigger/direct-failure/recovery/verification roles.

For every source, require at least one `knowledgeId` or one explicit terminal state: `superseded_duplicate`, `container_indexed`, `needs_visual_review`, `metadata_only`, or `out_of_scope_support_file`. Assert no `indexed` source remains unmapped.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="assurance|all sources" tests/domain-coverage.test.mjs`

Expected: FAIL on missing assurance nodes and unmapped sources.

- [ ] **Step 3: Curate the assurance pack**

Review the 9 stability/performance and 20 diagnosis/log source groups plus relevant archive documents. Model failure level, first trustworthy fatal evidence, resource bottlenecks, log-cause amplification, and evidence limitations without turning case examples into universal constants.

- [ ] **Step 4: Complete source-to-knowledge mapping**

Update all 299 source records. Use `needs_visual_review` for image-only material and `container_indexed` for archive containers whose readable members are separately represented. Do not create filler technical claims solely to make a source appear mapped.

- [ ] **Step 5: Build the public coverage report**

Render counts by category, processing state, platform, evidence state, mapped knowledge, archive extraction, and visual-review queue. Link back to the graph and source directory.

- [ ] **Step 6: Run coverage, source, and model tests**

Run: `node --test tests/domain-coverage.test.mjs tests/source-register.test.mjs tests/knowledge-model.test.mjs`

Expected: PASS with zero unexplained indexed sources.

- [ ] **Step 7: Record the task in GitHub**

Commit message: `feat: complete evidence and source coverage mapping`

### Task 10: Integrate, verify, and publish GitHub Pages

**Files:**
- Modify: `README.md`
- Modify: `docs/index.html`
- Regenerate: `docs/graph.json`
- Verify: all files from Tasks 1-9

**Interfaces:**
- Consumes: all domain packs, source register, builder, and browser UI.
- Produces: the public GitHub Pages release.

- [ ] **Step 1: Add final integration assertions**

Extend `tests/graph.test.mjs` to assert source coverage totals, semantic counts, legal relation types, evidence URLs, hidden-by-default evidence layers, and no local paths. Add a maximum default-visible node count so the initial view remains readable.

- [ ] **Step 2: Run the complete suite before final integration**

Run: `npm test`

Expected: FAIL only on integration assertions not yet wired to the final graph.

- [ ] **Step 3: Regenerate all public artifacts and update README**

Run: `npm run build:data`

Document the evidence-backed graph, filters, source coverage report, and evidence-state meanings. Link `docs/knowledge-coverage.html` from `docs/index.html` and `README.md`.

- [ ] **Step 4: Run the complete automated verification**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Run the local browser smoke test**

Run: `node scripts/serve.mjs`

Verify root-centered idle rotation, drag/zoom, hover text growth and shrink, click centering, blank-space reset, alias search, platform filters, path filters, evidence expansion, details, source links, coverage report, mobile layout, and reduced-motion behavior.

- [ ] **Step 6: Publish one reviewed GitHub commit**

Create a GitHub commit containing every verified local change with message: `feat: publish evidence-backed cockpit knowledge galaxy`.

- [ ] **Step 7: Verify the public deployment**

Check the GitHub Pages workflow or deployment status, then fetch `index.html`, `graph.json`, `knowledge-coverage.html`, and representative raw/evidence links from the public site. Confirm the deployed graph metadata matches the local build.

- [ ] **Step 8: Record final evidence**

Save the final commit SHA, deployment URL, graph counts, 299-source coverage summary, automated test result, and any remaining visual-review items in the delivery report.


