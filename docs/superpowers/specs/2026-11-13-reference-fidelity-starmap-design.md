# Reference fidelity desktop starmap

## Intent

Bring the published desktop page close to the supplied 1672×941 reference: a full-bleed, richly connected blue and cyan star field with a bright central depth layer, a small left navigation panel, sparse node labels, and a restrained gold route. The user asked us to make the design decisions and ship the improvement.

## Approaches

- A static image background could match one frame, but it would drift from the interactive graph and duplicate labels and controls.
- Making the current 181 interactive nodes brighter would leave the field sparse.
- **Chosen:** add a deterministic, noninteractive WebGL filament layer around the real architecture regions, give real nodes stronger depth and color, and show a verified graph route on the overview. Compact the existing controls without removing any knowledge workflows.

## Requirements

- Desktop composition should fill the viewport; the default left panel should be close to the reference's width and height. Search, seven real architecture shortcuts, and source links stay immediately available. All existing filters remain reachable in a disclosure.
- Ambient stars and links are visual texture only. They must never be selectable or represented as graph relations. Their layout is deterministic and disposed with the scene.
- The overview gold path uses only existing edges: `architecture:mcu-soc → architecture:power → architecture:android-hmi-display`. Hover or selection replaces it with the current real node path; reduced motion stops its moving light.
- Preserve WebGL fallback, reader, search, source links, keyboard focus, and the existing fresh narrow-window Canvas choice. No mobile redesign.
- Increase cache versions together so GitHub Pages serves the new CSS and modules.

## Validation limit

The browser's saved origin permission blocks observing the live page and explicitly forbids alternate browser routes. Verify source contracts, data-driven geometry, tests, and deployed HTTP assets; state that screenshot and interaction QA remain unavailable.
