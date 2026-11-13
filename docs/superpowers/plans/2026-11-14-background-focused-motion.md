# Background, focused nodes, autonomous motion

**Goal:** Address the three observed defects on the published desktop star map: no actual background image, too many unrelated nodes, and imperceptible autonomous 3D motion.

**Design:** Use a project-owned generated bitmap as the full-bleed backdrop. Keep only real architecture dimensions on the overview, and show a local hierarchy and technical neighborhood after selection. Remove the decorative WebGL point mesh that looked like stray graph nodes. Animate the real 3D graph with a visible orbit, depth breathing, and the existing moving route light. Expose motion status and control in the top toolbar.

**Constraints:** Preserve real graph edges, search, reader, filters, Canvas fallback, and the existing saved browser-origin permission boundary. Respect reduced-motion preference by starting still, but allow deliberate user opt-in.

## Work

1. Add the generated image to `docs/assets`, mount it below both canvases, and apply slow layered drift with a paused state.
2. Restrict WebGL overview to architecture dimensions and selected mode to the chosen node's route, direct children, and technical neighbors. Remove scenic WebGL filaments and dust; the bitmap supplies atmosphere.
3. Add a pure autonomous-pose calculation and wire it into the WebGL frame loop. Show a motion toggle in the toolbar; ensure pausing stops future frames and background drift.
4. Update focused tests for visible node counts, semantic edges, motion, and the asset. Run focused and full verification, review, publish, and verify Pages assets by HTTP.
