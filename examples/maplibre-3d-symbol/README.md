# MapLibre 3D SIDC symbol example

Runnable demo that loads a **GLB** from the ATAK SIDC Server API and renders it
on a tilted MapLibre GL JS map using a **Three.js custom 3D layer**.

## Option A — Next.js demo (same origin, no CORS)

With the dev server running:

```bash
yarn dev
```

Open:

http://localhost:8080/preview/maplibre

Optional query parameters:

| Param | Default | Description |
|-------|---------|-------------|
| `sidc` | `10133000001207000000` | 20-digit SIDC |
| `standard` | `APP6` | `APP6` or `2525` |
| `depth` | `5` | Extrusion depth |
| `targetSize` | `80` | Model max dimension before map scale |
| `scale` | `25` | Mercator scale multiplier on the map |

Example:

http://localhost:8080/preview/maplibre?sidc=10133000001207000000&depth=8&scale=30

The page loads GLB from `{origin}/api/{standard}/{sidc}.glb` automatically.

## Option B — Standalone HTML

Open `index.html` in a browser **or** serve it locally:

```bash
npx serve examples/maplibre-3d-symbol
```

By default it uses `window.location.origin` as the API base. Point at a remote
SIDC server with:

```
index.html?apiBase=http://localhost:8080&depth=5&targetSize=80&scale=25
```

The API must allow cross-origin GLB fetches (this repo sets CORS on `/api/*`).

## Shared library (for ORBAT / other apps)

```typescript
import {
  SidcSymbol3DLayer,
  buildSymbolGlbUrl,
} from "@/lib/maplibre/SidcSymbol3DLayer";

const layer = new SidcSymbol3DLayer({
  id: "sidc-symbol-3d",
  modelUrl: buildSymbolGlbUrl("http://localhost:8080", "APP6", sidc, {
    depth: 5,
    targetSize: 80,
  }),
  origin: [12.5, 55.7],
  scaleMultiplier: 25,
});

map.on("style.load", () => map.addLayer(layer));
```

## Sizing notes

- **`targetSize`** — set on the API; controls exported model units (default 100).
- **`scale`** — apparent size at the initial zoom level; the layer compensates for
  zoom so the symbol stays readable when zooming out (screen-space scaling).
- **`depth`** — visual weight of the extruded form.
- Pass `screenSpaceScaling: false` on `SidcSymbol3DLayer` for true meter-sized
  symbols that shrink with the map.

For track-attached symbols, create one `SidcSymbol3DLayer` per track (or update
`origin` and `modelTransform` each frame).

## ORBAT integration (E05.4 / E11)

- Use the same GLB URL from the symbol cache keyed by `sidc|depth|targetSize`.
- deck.gl alternative: `ScenegraphLayer` with the same `modelUrl`.
- Mesh JSON (`/.mesh`) for custom WebGL without Three.js — see
  `.settings/epics/features/feature-symbol3d-engine.md`.

## Visual quality

The MapLibre layer applies **flat unlit materials** (`MeshBasicMaterial`) so
APP-6 affiliation colors match the 2D SVG (no PBR darkening). Icons are extruded
higher than frames server-side for contrast on the map.

Default demo params: `depth=8`, `targetSize=100`, `scale=6`.

| Issue | Fix |
|-------|-----|
| Blank map | Check network tab for GLB 200; verify SIDC server is running |
| Symbol tiny/huge | Adjust `scale` and `targetSize` query params |
| CORS error on standalone HTML | Use Next.js demo or set `apiBase` to a server with CORS headers |

Bead: `atak-sidc-server-6t0` (F01.3)
