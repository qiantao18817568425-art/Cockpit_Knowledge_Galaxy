# Planetary constellation refinement

**Goal:** Make the new background less dominant and give the desktop overview enough real knowledge points to read as a star system.

**Design:** Scale the generated galaxy plate down inside a fading vignette. Show each of the 17 architecture dimensions, its directly owned 45 architecture chains, and 83 directly owned technical entities (146 real nodes total including the root). Draw their true local hierarchy links plus the existing verified gold route; omit root-to-dimension spokes in the overview to avoid a radial web around the navigation hub. Give every architecture dimension a shaded 3D sphere and faint orbital ring so the larger points visibly read as planets; retain the current point cloud for picking and smaller child stars. When a technical path filter is active, show its actual edge endpoints and only its matching edges.

**Constraints:** No fabricated knowledge nodes or relations. Keep search, filters, reader, WebGL fallback, motion pause, and reduced-motion behavior. The browser origin remains inaccessible; validate data/model and code, then verify deployed assets over HTTP.

## Steps

1. Add failing model/scene tests for bounded real parent-child clusters and planet meshes using the current graph.
2. Adjust the backdrop size and fade, then implement the semantic clusters and real-link rendering.
3. Add safe built-in-material spheres/rings at true dimension coordinates; verify motion and scene disposal.
4. Run focused/full checks, review, merge under existing authorization, and confirm Pages serves the new release.
