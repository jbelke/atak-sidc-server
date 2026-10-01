<div align="center">

<img src=".github/assets/logo.svg" alt="ATAK SIDC Server" width="104" height="104">

# ATAK SIDC Server

**NATO military symbology as a service.** Send a SIDC, get back vector, raster, or 3D glTF.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](docker-compose.yml)
[![milsymbol](https://img.shields.io/badge/milsymbol-3.0-1f6feb?style=flat-square)](https://github.com/spatialillusions/milsymbol)
[![Symbology](https://img.shields.io/badge/APP--6%20B%E2%80%93E%20%7C%202525%20C%E2%80%93E-4B5563?style=flat-square)](#standards--compatibility)

[Quick start](#quick-start) · [Compatibility](#standards--compatibility) · [API](#api-reference) · [3D / WebGL](#3d--webgl-export) · [Deployment](#deployment)

</div>

---

A self-hosted HTTP service that turns a **SIDC** (Symbol Identification Code) into a rendered
military symbol: a vector, a raster image, or a 3D model. Symbols are drawn with
[milsymbol 3](https://github.com/spatialillusions/milsymbol), rasterised with
[sharp](https://sharp.pixelplumbing.com/), and extruded with [three.js](https://threejs.org/) for
export as glTF, GLB, OBJ, or raw WebGL buffers.

```bash
# A 512px PNG of an Unmanned Surface Vehicle, NATO APP-6
curl -o usv.png "http://localhost:8080/api/APP6/10133000001207000000.png?size=512"

# The same symbol as a self-contained GLB for MapLibre, Three.js, Cesium, or ATAK
curl -o usv.glb "http://localhost:8080/api/APP6/10133000001207000000.glb?frameOnly=1&bakeIcon=1&depth=5"
```

## Who this is for

Any system that has to draw a military symbol and would rather not embed a symbology engine in every
client. The server renders; your client fetches a URL.

| Audience | What it gives you |
|---|---|
| **C2, C3, C4ISR** | One symbol service behind web, desktop, and mobile clients, so a track renders identically in every seat |
| **ATAK, WinTAK, iTAK** | GLB models and PNG icons over plain HTTP for plugins, TAK server integrations, and data packages |
| **Mapping and GIS** | Symbols for MapLibre, Leaflet, OpenLayers, and Cesium, flat on the map or standing up in 3D |
| **UAS and drone GCS** | Track symbology for operator displays, with heading, tilt, and spin baked into the model |
| **Wargaming and simulation** | Bulk symbol generation for scenario editors, constructive sims, and after-action review |
| **3D and game engines** | glTF, GLB, OBJ, and raw WebGL buffers for Three.js, Unity, Unreal, and custom renderers |
| **Briefings and staff products** | Vector SVG and high-resolution PNG for documents, slides, and printed overlays |
| **Training and analysis** | Exercise and simulation contexts are part of the SIDC, so training data never renders as live |

## Contents

- [Features](#features)
- [Standards & compatibility](#standards--compatibility)
- [Quick start](#quick-start)
- [API reference](#api-reference)
- [3D / WebGL export](#3d--webgl-export)
- [Web UI](#web-ui)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [License](#license)

## Features

| | |
|---|---|
| **2D output** | SVG, PNG, JPEG, GIF, WebP, AVIF at any size, on a transparent background |
| **3D output** | GLB, glTF, OBJ, and indexed mesh JSON ready for `gl.bufferData` |
| **SIDC dialects** | Legacy 15-character, modern 20-digit, and APP-6(E) / 2525E 30-digit codes, detected automatically |
| **Catalog API** | Searchable symbol catalog filtered by set, affiliation, context, and echelon |
| **Browser UI** | Symbol library plus a live MapLibre GL JS 3D preview |
| **Production ready** | Docker Compose, dual-process PM2, health probe, env-driven config |

## Standards & compatibility

### The two SIDC dialects

Military symbology split into two incompatible code formats in 2014. This server accepts **both** and
works out which one you sent from the code itself, so there is no mode to configure.

**Modern numeric** (`10133000001207000000`), used by APP-6(D)/(E) and MIL-STD-2525D/E.
D codes are 20 digits. E codes are those same 20 digits plus an optional 10-digit tail, 30 digits
in all. The first 20 digits mean the same thing in both editions.

```
 10  1  3  30  0  0  00  001207  00  00
 │   │  │  │   │  │  │   │       │   └── digits 19-20  Sector modifier 2
 │   │  │  │   │  │  │   │       └────── digits 17-18  Sector modifier 1
 │   │  │  │   │  │  │   └────────────── digits 11-16  Entity / type / subtype
 │   │  │  │   │  │  └────────────────── digits 9-10   Amplifier / echelon
 │   │  │  │   │  └───────────────────── digit 8       HQ / task force / dummy
 │   │  │  │   └──────────────────────── digit 7       Status (present / planned)
 │   │  │  └──────────────────────────── digits 5-6    Symbol set (30 = sea surface)
 │   │  └─────────────────────────────── digit 4       Standard identity (3 = friend)
 │   └────────────────────────────────── digit 3       Context (1 = exercise)
 └────────────────────────────────────── digits 1-2    Version
```

#### Digits 21-30, APP-6(E) and MIL-STD-2525E only

A 20-digit code is still valid: it is the same symbol with the normal frame and no country. The
tail is how E records a frame-shape override and a country. Both `/api/APP6` and `/api/2525` honor it.

```
 00  2  0000  840
 │   │  │     └── digits 28-30  Country. ISO 3166-1 numeric. 840 United States, 826 United Kingdom. 000 none.
 │   │  └──────── digits 24-27  Reserved. Not used.
 │   └─────────── digit 23      Frame shape. 0 keeps the frame the symbol set already uses.
 └─────────────── digits 21-22  Modifier extensions. 00 changes nothing.
```

Digits 21 and 22 are an extra leading digit for the sector 1 and sector 2 modifiers
(digits 17-18 and 19-20). E uses them to make modifier codes three digits long. milsymbol reads
them, so a non-zero value here changes the picture. Digits 24-27 are ignored.

| Digit 23 | Frame drawn |
|---|---|
| `0` | The symbol set's normal frame |
| `1` | Space |
| `2` | Air |
| `3` | Land unit |
| `4` | Land equipment and sea surface |
| `5` | Land installation |
| `6` | Dismounted individual |
| `7` | Sea subsurface |
| `8` | Activity or event |
| `9` | Cyberspace |
| `A` | No frame |

The country is drawn as the ISO 3166-1 alpha-3 code: `840` becomes `USA`, `826` becomes `GBR`.
A numeric code that is not an assigned country is drawn as those three digits. `000` draws no country.

```bash
# Friend infantry, drawn in an air frame, country United States
curl -o infantry.png "http://localhost:8080/api/APP6/130310000012110000000020000840.png?size=256"
```

**Legacy: 15-character alphanumeric** (`SFGPUCI-----USG`), used by APP-6(A)/(B)/(C) and
MIL-STD-2525B/C. Pass it exactly as-is, since the hyphens are valid in a URL path.

```bash
curl -o legacy.png "http://localhost:8080/api/2525/SFGPUCI-----USG.png?size=256"
```

### Compatibility matrix

| Standard | Edition | Published | SIDC format | Support |
|---|---|---|---|---|
| MIL-STD-2525 | A / B | Dec 1996 / Jan 1999 | 15-character | ⚠️ Parses, drawn per 2525C |
| MIL-STD-2525 | **C** | Nov 2008 | 15-character | ✅ Implemented |
| MIL-STD-2525 | **D** | Jun 2014 | 20-digit | ✅ Implemented |
| MIL-STD-2525 | **E** | Dec 2022 | 20- or 30-digit | ✅ Implemented, rendering target |
| STANAG 2019 / APP-6 | A | Dec 1999 | 15-character | ⚠️ Parses, drawn per APP-6(B) |
| STANAG 2019 / APP-6 | **B** | Jun 2008 | 15-character | ✅ Implemented |
| STANAG 2019 / APP-6 | C | May 2011 | 15-character | ⚠️ Parses, drawn per APP-6(B) |
| STANAG 2019 / APP-6 | **D** | Oct 2017 | 20-digit | ✅ Implemented |
| STANAG 2019 / APP-6 | **E** | 2023 | 20- or 30-digit | ✅ Implemented, rendering target |

✅ means the edition's symbol set is implemented. ⚠️ means codes in that edition share their
dialect's structure, so they parse and render, but icon coverage follows the implemented edition of
that dialect. FM 1-02.2 (US Army *Military Symbols*) is also implemented and shares the 20-digit
dialect.

See [digits 21-30](#digits-21-30-app-6e-and-mil-std-2525e-only) for the E frame-shape and country
fields. Support is inherited from milsymbol 3.0. See its
[symbology notes](https://github.com/spatialillusions/milsymbol) for per-symbol detail.

> [!IMPORTANT]
> **Rendering is uniform across editions by design.** Since milsymbol 3.0, every symbol is drawn as
> closely as possible to MIL-STD-2525E, APP-6(E), and FM 1-02.2 no matter which edition the SIDC came
> from. A 2525C code and its APP-6(E) equivalent produce the same picture, which keeps systems on
> different editions visually interoperable. If you need a symbol drawn exactly as printed in an
> older standard document, use a renderer that targets that edition.

### Choosing NATO or US framing

The first path segment picks the frame family: `2525` for US, anything else (conventionally `APP6`)
for NATO.

```
/api/APP6/10133000001207000000.png    → NATO framing
/api/2525/10133000001207000000.png    → US framing
```

In practice the two agree for most symbols. Sampling 125 valid symbols across 25 symbol sets, only
about **3%** rendered differently. Expect the toggle to matter for a minority of icons (some sea
surface, land unit, and installation entities) rather than as a wholesale restyling.

### Client compatibility

| Consumer | Format to request | Notes |
|---|---|---|
| MapLibre GL JS | `.glb` | Custom 3D layer bundled in [`src/lib/maplibre/`](src/lib/maplibre) with a [live demo](#maplibre-gl-js) |
| Three.js | `.glb` / `.gltf` | Load with `GLTFLoader` |
| ATAK / WinTAK, Cesium | `.glb?frameOnly=1&bakeIcon=1` | Use `bakeIcon` so the model carries its own texture |
| Raw WebGL / OpenGL | `.mesh` | Indexed vertices, normals, and UVs as JSON |
| Legacy 3D tooling | `.obj` | Geometry only, no materials |
| Web, GIS, documents | `.svg` `.png` `.webp` `.avif` `.jpg` `.gif` | `.svg` scales losslessly, `.jpg` is flattened onto white |

## Quick start

**Prerequisites:** Docker and Docker Compose, or Node.js 20+ for local development.

```bash
git clone https://github.com/jbelke/atak-sidc-server.git
cd atak-sidc-server
cp .env.sample .env
./start-stop.sh
```

The service comes up on two ports, both serving the full API:

| URL | Purpose |
|-----|---------|
| http://localhost:8080 | Primary instance |
| http://localhost:8081 | Secondary PM2 instance |

Verify it is healthy:

```bash
curl http://localhost:8080/api/health
# {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Local development

```bash
yarn install
yarn dev      # http://localhost:8080
```

Other scripts: `yarn build`, `yarn start`, `yarn lint`, and `yarn prod` (build, then launch PM2).

## API reference

### Generate a symbol

```http
GET /api/{standard}/{sidc}.{format}
```

| Segment | Values | Description |
|---------|--------|-------------|
| `standard` | `APP6` \| `2525` | Frame family, see [choosing NATO or US framing](#choosing-nato-or-us-framing) |
| `sidc` | `10133000001207000000` \| `SFGPUCI-----USG` | 20- or 30-digit code, legacy 15-character code, or an [XSIDC](#compact-track-codes-xsidc) |
| `format` | `svg` `png` `jpg` `jpeg` `gif` `webp` `avif` `glb` `gltf` `obj` `mesh` | Output format, given as a file extension |

**Query parameters (2D)**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `size` | `100` | Symbol size, and the default output width and height |
| `width` | `size` | Output width in pixels (raster formats) |
| `height` | `width` | Output height in pixels (raster formats) |

**Text amplifiers (2D)**

All 21 MIL-STD-2525D / APP-6 text amplifiers are query parameters, passed to milsymbol as-is. Values
are cut at 64 characters. milsymbol escapes the text it writes into the SVG.

| Group | Parameters |
|---|---|
| Identity | `uniqueDesignation`, `higherFormation`, `commonIdentifier`, `type`, `platformType`, `specialHeadquarters` |
| Strength and status | `quantity`, `reinforcedReduced`, `combatEffectiveness`, `evaluationRating`, `signatureEquipment`, `equipmentTeardownTime` |
| Kinematics | `direction`, `speed`, `altitudeDepth`, `location`, plus `speedLeader` (see below) |
| Reporting | `dtg`, `staffComments`, `additionalInformation`, `iffSif`, `hostile` |

`direction` alone draws the movement arrow. Adding `speedLeader` draws a speed leader line
from the symbol centre instead; it sits under the frame, so values below about 60 stay hidden.

Not every symbol set draws every amplifier. Measured against milsymbol 3.0, a land unit draws all 21
and land equipment 20, but air and sea surface symbols draw 10 each; air joins speed and altitude
into one label. Amplifiers a symbol does not draw are ignored, never an error. When you set a
field that the [country label](#the-two-sidc-dialects) would otherwise use (`uniqueDesignation` on
air and sea, `staffComments` on land units), your text wins. 3D formats ignore amplifiers for now.

Amplifiers grow the drawn extent, and raster output fits the whole extent into `width` × `height`,
so the frame gets smaller as text is added.

Raster output is fitted to `width` × `height` on a transparent background. JPEG is flattened onto
white because it has no alpha channel. 3D formats take their own parameters, covered in
[3D / WebGL export](#3d--webgl-export).

An unrecognised extension returns `500 Unsupported format`. An unparseable SIDC does **not** error,
because milsymbol renders a placeholder symbol instead. Validate codes upstream if you need strict
rejection.

**Examples**

```bash
curl -o symbol.svg  "http://localhost:8080/api/APP6/10133000001207000000.svg?size=500"
curl -o symbol.png  "http://localhost:8080/api/2525/10133000001207000000.png?size=500"
curl -o symbol.webp "http://localhost:8080/api/APP6/10133000001207000000.webp?width=256&height=256"
curl -o legacy.png  "http://localhost:8080/api/2525/SFGPUCI-----USG.png?size=256"
# 30-digit E code: friend infantry, air frame (digit 23 = 2), United States (840)
curl -o infantry.png "http://localhost:8080/api/APP6/130310000012110000000020000840.png?size=256"
# Text amplifiers: designation, higher formation, strength
curl -o coy.png "http://localhost:8080/api/APP6/10031000151211000000.png?size=256&uniqueDesignation=A&higherFormation=1-64&reinforcedReduced=(%2B)"
```

### Compact track codes (XSIDC)

A SIDC says *what* a track is. An XSIDC adds *where it is and how it moves*, plus the text
amplifiers, as digits only, so a whole track fits a low-bandwidth radio link (about 228 bytes per
LoRa/Meshtastic message). The format is the CTC v3.1 record from
[`josh-ctc_calculator.v003.xls.xlsx`](.settings/sidc-2525-APP6/), ported to
[`src/lib/ctc/`](src/lib/ctc/) and checked against the workbook's own self-check bytes.

```
130335000011010000000000000724 _ 0001006534659068695152280 _ 09724200000210001220002
└── SIDC, 30 digits ──────────┘   └── EXT, 25 digits ───┘     └── AMP, optional ───┘
```

| Part | On the wire | Carries |
|---|---|---|
| SIDC | 10 digits (identity, symbol set, status, entity) | Version, context, HQ/TF, echelon and modifiers are mission defaults, restored by the receiver |
| EXT | 25 digits | Instance ID, track phase, confidence, position, elevation band, course, speed band, accuracy, observation tick |
| AMP | Only when the amplifiers change | Text amplifiers and country, see below |

SIDC + EXT pack into one fixed **15-byte record**. AMP travels as a separate amplifier record
(1 length byte + packed digits), so repeat reports cost 15 bytes.

**How AMP covers the 21 text amplifiers**

| Kind | Amplifiers | Cost |
|---|---|---|
| Read from EXT | `direction`, `speed`, `altitudeDepth`, `dtg`, `location` | 0 digits |
| Coded values | `01` quantity (4), `02` reinforcedReduced (1), `03` combatEffectiveness (1), `04` evaluationRating (2), `05` signatureEquipment (0), `06` hostile (0), `07` iffSif (5), `08` equipmentTeardownTime (3), `09` country (3) | tag + digits shown |
| String table | `20` uniqueDesignation, `21` higherFormation, `22` type, `23` platformType, `24` commonIdentifier, `25` specialHeadquarters, `26` staffComments, `27` additionalInformation | tag + 4-digit index |

Each AMP entry is a 2-digit tag and a fixed-width value, tags in ascending order. Free text is an
index into a string table both ends hold for one `table_version`; a sender must announce a new
string before it uses its index.

**Rendering an XSIDC.** Pass it where the SIDC goes. The server draws the kinematic amplifiers and
the coded AMP values. It does not hold your mission string table, so it skips text tags; send that
text as query parameters. `dtg` and `location` need the mission clock and AO origin, so the server
does not draw them from an XSIDC.

```bash
curl -o ssk.png "http://localhost:8080/api/APP6/130335000011010000000000000724_0001006534659068695152280_09724200000210001220002.png?size=256&uniqueDesignation=SSK-0002"
```

**Compressing messages.** [`src/lib/ctc/adapters/stanag4817.ts`](src/lib/ctc/adapters/stanag4817.ts)
turns STANAG 4817 `NODE_STATUS` and `DYNAMIC_UPDATE` contact messages into tracks.
`encodeTrack()` returns the XSIDC, the record, and a `dropped` list of SIDC fields the wire cannot
carry. It refuses a track outside every AO origin. Try it on the bundled samples:

```bash
node --experimental-strip-types examples/ctc-compress/compress-4817.ts \
  examples/ctc-compress/mission.json src/lib/ctc/adapters/fixtures/*.json
```

The two samples go from about 1,500 bytes of JSON to 25 and 28 bytes on first report, then 15 bytes
per update. CoT, SAPIENT and OTH-Gold adapters are planned (see [Roadmap](#roadmap)).

### Browse the symbol catalog

```http
GET /api/catalog
```

Returns the symbol set index and matching entries, each with a ready-to-render default SIDC.
Responses are cached for one hour.

| Parameter | Values | Description |
|-----------|--------|-------------|
| `q` | free text | Search entity, type, subtype, and remarks |
| `set` | symbol set id | Restrict to one symbol set |
| `affiliation` | `pending` `unknown` `assumed_friend` `friend` `neutral` `suspect` `hostile` | Affiliation of the generated SIDCs |
| `context` | `reality` `exercise` `simulation` | Symbol context |
| `echelon` | `team` `squad` `section` `platoon` `company` `battalion` `regiment` `brigade` `division` `corps` `army` | Echelon amplifier |
| `standard` | `APP6` \| `2525` | Frame family |

```bash
curl "http://localhost:8080/api/catalog?q=infantry&affiliation=hostile&echelon=platoon"
```

### Health

```http
GET /api/health
```

Returns `{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}`. Used by the Docker Compose
healthcheck on both ports.

## 3D / WebGL export

The server extrudes milsymbol SVG paths into 3D meshes suitable for OpenGL, WebGL, Three.js, and
MapLibre GL JS custom layers.

| Extension | MIME type | Use case |
|-----------|-----------|----------|
| `glb` | `model/gltf-binary` | MapLibre custom 3D models, Three.js `GLTFLoader`, ATAK, Cesium |
| `gltf` | `model/gltf+json` | glTF JSON scene |
| `obj` | `model/obj` | Legacy 3D tools |
| `mesh` | `application/json` | Direct WebGL buffers (vertices, normals, indices) |

**Query parameters (3D)**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `depth` | `4` | Extrusion depth |
| `bevel` | `true` | Enable bevelled edges |
| `bevelThickness` | `0.35` | Bevel depth into the face |
| `bevelSize` | `0.35` | Bevel distance from the outline |
| `bevelSegments` | `2` | Bevel curve resolution |
| `targetSize` | `100` | Scale the model so its largest dimension equals this value |
| `flipY` | `true` | Flip SVG Y-down to Y-up for WebGL |
| `frameOnly` | `false` | Extrude only the affiliation frame (a coloured "puck") and skip inner icon geometry |
| `bakeIcon` | `false` | Bake the crisp 2D icon onto the puck faces as a PNG texture (`glb` and `gltf` only) |
| `heading` | `0` | Baked in-plane icon orientation, degrees |
| `tilt` | `0` | Baked lean toward the default viewer, degrees |
| `spin` | `0` | Baked continuous spin animation, degrees per second |
| `form` | none | Presentation hint recorded in the model: `puck` or `billboard` |

Booleans accept `true` or `1`.

> [!TIP]
> **Reach for `frameOnly=1&bakeIcon=1` first.** milsymbol icons are stroke-based, so they do not
> survive fill extrusion and read as solid blobs in 3D. That pair produces a self-contained GLB: an
> extruded affiliation puck with the exact 2D icon textured onto its faces, which external glTF
> clients such as ATAK and Cesium render with true 2D parity. Clients that texture the faces
> themselves, like the bundled MapLibre preview, can leave it off.

```bash
# Self-contained GLB for an external glTF client
curl -o symbol.glb "http://localhost:8080/api/APP6/10133000001207000000.glb?frameOnly=1&bakeIcon=1&depth=5&targetSize=100"

# Raw WebGL buffers
curl "http://localhost:8080/api/APP6/10133000001207000000.mesh?depth=3"
```

### MapLibre GL JS

A ready-made custom layer ships in [`src/lib/maplibre/`](src/lib/maplibre):

```ts
import { SidcSymbol3DLayer, buildSymbolGlbUrl } from "@/lib/maplibre/SidcSymbol3DLayer";

map.addLayer(
  new SidcSymbol3DLayer({
    id: "usv",
    modelUrl: buildSymbolGlbUrl("http://localhost:8080", "APP6", "10133000001207000000", {
      depth: 5,
      targetSize: 80,
    }),
    origin: [-122.4194, 37.7749],
    altitudeMeters: 0,
    scaleMultiplier: 25,
    screenSpaceScaling: true, // keep constant on-screen size while zooming
  })
);
```

Use `SidcSymbolFieldLayer` to render many tracks in a single layer, in `puck` or `billboard` form.

- **Live preview:** http://localhost:8080/preview/maplibre
- **Standalone HTML demo:** [`examples/maplibre-3d-symbol/`](examples/maplibre-3d-symbol)

### Mesh JSON

The `mesh` format returns indexed geometry per SVG layer:

```json
{
  "version": 1,
  "sidc": "10133000001207000000",
  "standard": "APP6",
  "bounds": { "min": [0, 0, 0], "max": [100, 100, 4] },
  "meshes": [
    {
      "name": "path-0-0",
      "vertices": [0, 0, 0],
      "normals": [0, 0, 1],
      "indices": [0, 1, 2],
      "uvs": [0, 0],
      "color": "#36befc",
      "opacity": 1
    }
  ],
  "pose": { "headingDeg": 0, "tiltDeg": 0 },
  "spin": { "degPerSec": 0 },
  "form": "puck"
}
```

Upload `vertices` and `indices` straight to `gl.bufferData` for custom shaders.

## Web UI

| Route | Description |
|-------|-------------|
| `/` | Landing page with worked examples and quick links for every format |
| `/library` | Browse and filter the symbol catalog, then copy the API URL |
| `/preview/maplibre` | Live 3D symbol on a tilted MapLibre map, driven by URL parameters |

## Configuration

All configuration is environment based. Copy `.env.sample` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Primary HTTP port |
| `PM2_PORT` | `8081` | Secondary PM2 instance port |
| `NODE_ENV` | `production` | Node environment |
| `DOCKER_IMAGE_NAME` | `atak-sidc-server` | Built image name |
| `DOCKER_CONTAINER_NAME` | `atak-sidc-server` | Container name |
| `DOCKER_NETWORK` | `atak-network` | Docker network |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |
| `NODE_VERSION` | `20` | Base image Node version |
| `ALPINE_VERSION` | `3.19` | Base image Alpine version |
| `MEMORY_LIMIT` | `2G` | Container memory limit |
| `MEMORY_RESERVATION` | `1G` | Container memory reservation |
| `LOG_PATH` | `./logs` | Host path mounted at `/app/logs` |

## Deployment

### Docker Compose (recommended)

```bash
docker compose up -d      # start in the background
docker compose logs -f    # follow logs
docker compose down       # stop
```

`./start-stop.sh` wraps this: it loads `.env`, rebuilds the image, waits for the container, runs the
production build inside it, and reloads PM2.

### PM2

[`ecosystem.config.js`](ecosystem.config.js) runs two forked Next.js processes, one on `8080` and one
on `8081`, each with `autorestart` and a 1 GB memory ceiling, logging to `./logs`.

```bash
yarn prod        # build, then start both processes
./pm2-status.sh  # pass any pm2 command through to the container
./pm2-reload.sh  # reload both processes with a refreshed environment
```

### Kubernetes (Helm)

[`helm/atak-sidc-server`](helm/atak-sidc-server) packages the server for Kubernetes: three replicas by
default for redundancy, an ingress-nginx `Ingress`, a PodDisruptionBudget, and `/api/health` wired to
all three probes.

```bash
helm upgrade --install atak-sidc ./helm/atak-sidc-server \
  --namespace atak --create-namespace \
  -f ./helm/atak-sidc-server/values.override.yaml

helm test atak-sidc -n atak
```

`values.yaml` is the committed baseline; put per-cluster changes (image tag, hostname, TLS) in
`values.override.yaml`. See the [chart README](helm/atak-sidc-server/README.md) for the full value
reference and the two footguns worth knowing: immutable image tags, and PM2's hardcoded ports.

## Project structure

```
src/
├── app/
│   ├── api/[standard]/[sidc]/route.ts  # symbol rendering endpoint
│   ├── api/catalog/route.ts            # searchable symbol catalog
│   ├── api/health/route.ts             # health probe
│   ├── library/                        # symbol browser UI
│   └── preview/maplibre/               # live MapLibre 3D preview
└── lib/
    ├── symbol3d/                       # SVG to three.js to glTF / GLB / OBJ / mesh
    ├── maplibre/                       # MapLibre custom 3D layers
    ├── ctc/                            # XSIDC / CTC track codec, AMP, message adapters
    └── symbol-catalog/                 # SIDC catalog and filters
examples/maplibre-3d-symbol/            # standalone HTML demo
examples/ctc-compress/                  # compress 4817 JSON to CTC records
public/                                 # static assets
```

## Roadmap

### Text amplifiers

- [x] All 21 amplifiers as query parameters on 2D formats
- [x] XSIDC amplifier block (AMP) with coded values and a string table
- [ ] Sizing: define `size`, `width` and `height` against the amplified extent, not the bare frame
- [ ] 3D policy: bake amplifier text into the puck texture, extrude it, or drop it

### Message compression

- [x] STANAG 4817 JSON to XSIDC
- [ ] CoT (Cursor on Target) event XML
- [ ] SAPIENT detection and status reports
- [ ] OTH-Gold contact and position reports
- [ ] Announcement frames for new instance IDs, strings and amplifier records

### Kinematics

- [x] Direction-of-movement leader via `direction`, with `speedLeader` controlling leader length
- [x] Speed and altitude/depth amplifiers on the symbol
- [ ] Drive the existing 3D `heading` parameter from `direction`, so an extruded symbol faces the way
      its track is moving

### Also planned

- [ ] SIDC-aware 3D profiles (frame depth by symbol category)
- [ ] Tactical graphic 3D forms (area and line symbols)

## Contributing

Issues and pull requests are welcome. Please run `yarn lint` and `yarn build` before opening a PR,
and keep changes focused. A short description of the problem and the fix is enough.

## Disclaimer

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. The authors and
contributors make no warranties about the software and disclaim liability for all uses of the
software, to the fullest extent permitted by applicable law.

By using this software, you acknowledge that you use it at your own risk, that the authors and
contributors are not responsible for any damage or issues arising from its use, and that no support
or maintenance is guaranteed. It is not accredited for operational use and carries no certification
against any edition of MIL-STD-2525 or APP-6.

## License

[MIT](LICENSE) © ATAK-SIDC-Server Contributors

---

<div align="center">

If this project is useful to you, consider supporting its development.

<a href="https://www.buymeacoffee.com/jbelke"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180"></a>

</div>
