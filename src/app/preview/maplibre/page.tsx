"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildSymbolGlbUrl } from "@/lib/maplibre/SidcSymbol3DLayer";
import {
  SidcSymbolFieldLayer,
  type SymbolFieldTrack,
  type SymbolForm,
} from "@/lib/maplibre/SidcSymbolFieldLayer";
import styles from "./cop.module.css";

type Mode = "3d" | "2d";
type Affiliation =
  | "friend"
  | "hostile"
  | "neutral"
  | "unknown"
  | "assumed_friend"
  | "suspect"
  | "pending";

const AFFIL_CODE: Record<Affiliation, string> = {
  pending: "0",
  unknown: "1",
  assumed_friend: "2",
  friend: "3",
  neutral: "4",
  suspect: "5",
  hostile: "6",
};

const AFFIL_COLOR: Record<Affiliation, string> = {
  friend: "#7fd2ff",
  assumed_friend: "#7fd2ff",
  hostile: "#ff7b72",
  suspect: "#ffb37b",
  neutral: "#76e0a0",
  unknown: "#f5d44e",
  pending: "#f5d44e",
};

// The four "flag" (standard-identity) versions shown as quick toggles.
const FLAGS: Affiliation[] = ["friend", "hostile", "neutral", "unknown"];

interface CatalogEntry {
  id: string;
  symbolSet: string;
  symbolSetName: string;
  mainIcon: string;
  label: string;
}
interface CatalogResponse {
  count: number;
  symbolSets: Array<{ id: string; name: string; count: number }>;
  entries: CatalogEntry[];
}

const STANDARD = "APP6";
const CENTER: [number, number] = [12.585, 55.676];
const MAX_DISPLAY = 80; // cap symbols per view so 2D markers / 3D GLBs stay sane
const DEFAULT_SET = "30"; // Sea surface

/** Client replica of the server's buildSidc (version+context+affiliation+set+...+icon). */
function buildSidc(aff: Affiliation, set: string, icon: string): string {
  const s = set.padStart(2, "0").slice(-2);
  const i = icon.padStart(6, "0").slice(-6);
  return "10" + "0" + AFFIL_CODE[aff] + s + "0" + "0" + "00" + i + "0000";
}

function gridLayout(
  n: number
): { positions: [number, number][]; bounds: [[number, number], [number, number]] } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.4)));
  const rows = Math.ceil(n / cols);
  const dLng = 0.0072;
  const dLat = 0.0049;
  const positions: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const r = Math.floor(k / cols);
    const c = k % cols;
    const lng = CENTER[0] + (c - (cols - 1) / 2) * dLng;
    const lat = CENTER[1] - (r - (rows - 1) / 2) * dLat;
    positions.push([lng, lat]);
  }
  const lngs = positions.map((p) => p[0]);
  const lats = positions.map((p) => p[1]);
  return {
    positions,
    bounds: [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
  };
}

const BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#05080d" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 0.9 } },
  ],
};

export default function MapLibreGalleryPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const fieldRef = useRef<SidcSymbolFieldLayer | null>(null);
  const fieldLayerId = "sidc-symbol-field";

  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [mode, setMode] = useState<Mode>("3d");
  const [affiliation, setAffiliation] = useState<Affiliation>("friend");
  const [setId, setSetId] = useState<string>(DEFAULT_SET);
  const [tilt, setTilt] = useState(40); // puck lean toward viewer, degrees
  const [heading, setHeading] = useState(0); // icon orientation, degrees
  const [spin, setSpin] = useState(0); // continuous rotation, deg/sec
  const [form, setForm] = useState<SymbolForm>("puck");
  const [readout, setReadout] = useState({ lng: CENTER[0], lat: CENTER[1], zoom: 13 });

  // --- hydrate 3D presentation state from the URL once (?form&tilt&heading&spin) ---
  // Guarded so React 18 StrictMode's double-mount doesn't re-read the URL after
  // the write effect below has already rewritten it to current (default) state.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const q = new URLSearchParams(window.location.search);
    const f = q.get("form");
    if (f === "puck" || f === "billboard") setForm(f);
    const num = (k: string) => {
      const v = q.get(k);
      return v === null ? null : Number(v);
    };
    const t = num("tilt");
    if (t !== null && !Number.isNaN(t)) setTilt(t);
    const h = num("heading");
    if (h !== null && !Number.isNaN(h)) setHeading(h);
    const s = num("spin");
    if (s !== null && !Number.isNaN(s)) setSpin(s);
    const set = q.get("set");
    if (set) setSetId(set);
    const aff = q.get("aff");
    if (aff && aff in AFFIL_CODE) setAffiliation(aff as Affiliation);
  }, []);

  // --- reflect 3D presentation state back into the URL (shareable / for clients) ---
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("set", setId);
    q.set("aff", affiliation);
    q.set("form", form);
    q.set("tilt", String(tilt));
    q.set("heading", String(heading));
    q.set("spin", String(spin));
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [setId, affiliation, form, tilt, heading, spin]);

  // --- fetch catalog once ---
  useEffect(() => {
    fetch("/api/catalog?standard=APP6")
      .then((r) => r.json())
      .then((c: CatalogResponse) => setCatalog(c))
      .catch((e) => console.error("catalog fetch failed", e));
  }, []);

  const setEntries = useMemo(() => {
    if (!catalog) return [];
    return catalog.entries.filter((e) => e.symbolSet === setId).slice(0, MAX_DISPLAY);
  }, [catalog, setId]);

  const setMeta = catalog?.symbolSets.find((s) => s.id === setId);

  // --- init map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: CENTER,
      zoom: 13,
      pitch: 55,
      bearing: -15,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    });
    mapRef.current = map;
    if (typeof window !== "undefined") (window as unknown as { __map: maplibregl.Map }).__map = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("style.load", () => {
      try {
        map.setSky({
          "sky-color": "#0a1a2f",
          "horizon-color": "#14304a",
          "fog-color": "#070b12",
          "sky-horizon-blend": 0.6,
          "horizon-fog-blend": 0.6,
          "fog-ground-blend": 0.35,
        });
      } catch {
        /* cosmetic */
      }
      setReady(true);
    });

    const sync = () => {
      const c = map.getCenter();
      setReadout({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
    };
    map.on("move", sync);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- (re)build the symbol field when inputs change ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || setEntries.length === 0) return;

    // clear previous render
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (map.getLayer(fieldLayerId)) map.removeLayer(fieldLayerId);

    const { positions, bounds } = gridLayout(setEntries.length);
    const origin = window.location.origin;

    const fitOpts: maplibregl.FitBoundsOptions = {
      padding: { top: 70, bottom: 70, left: 300, right: 70 },
      pitch: mode === "3d" ? 55 : 18,
      bearing: -15,
      duration: 700,
      maxZoom: 15.5,
    };

    if (mode === "2d") {
      setEntries.forEach((entry, k) => {
        const sidc = buildSidc(affiliation, entry.symbolSet, entry.mainIcon);
        const el = document.createElement("div");
        el.className = styles.marker;
        const img = document.createElement("img");
        img.src = `${origin}/api/${STANDARD}/${sidc}.png?size=64`;
        img.alt = entry.label;
        img.title = `${entry.label}\n${sidc}`;
        el.appendChild(img);
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(positions[k])
          .addTo(map);
        markersRef.current.push(marker);
      });
    } else {
      const tracks: SymbolFieldTrack[] = setEntries.map((entry, k) => {
        const sidc = buildSidc(affiliation, entry.symbolSet, entry.mainIcon);
        return {
          id: entry.id,
          lngLat: positions[k],
          // Frame-only puck (geometric depth) + crisp 2D icon as a face texture.
          modelUrl:
            buildSymbolGlbUrl(origin, STANDARD, sidc, {
              depth: 9,
              targetSize: 100,
            }) + "&frameOnly=1",
          textureUrl: `${origin}/api/${STANDARD}/${sidc}.png?size=256`,
        };
      });
      const cam = map.cameraForBounds(bounds, fitOpts);
      const field = new SidcSymbolFieldLayer({
        id: fieldLayerId,
        tracks,
        scaleMultiplier: 3,
        referenceZoom: cam?.zoom ?? map.getZoom(),
        screenSpaceScaling: true,
        tiltDegrees: tilt,
        headingDegrees: heading,
        spinDegPerSec: spin,
        form,
      });
      map.addLayer(field);
      fieldRef.current = field;
      if (typeof window !== "undefined") (window as unknown as { __field: unknown }).__field = field;
    }

    map.fitBounds(bounds, fitOpts);
    // `tilt` is intentionally excluded — it is applied live below without a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, affiliation, setId, setEntries]);

  // Live-apply presentation changes without rebuilding the field (no GLB reloads).
  useEffect(() => {
    fieldRef.current?.setTilt(tilt);
  }, [tilt]);
  useEffect(() => {
    fieldRef.current?.setHeading(heading);
  }, [heading]);
  useEffect(() => {
    fieldRef.current?.setSpin(spin);
  }, [spin]);
  useEffect(() => {
    fieldRef.current?.setForm(form);
  }, [form]);

  const total = setMeta?.count ?? setEntries.length;

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <b>ATAK · SIDC</b>
          <span>3D SYMBOL GALLERY · COP</span>
        </div>
        <div className={styles.topSpacer} />
        <div className={styles.segment}>
          {(["3d", "2d"] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? styles.segOn : styles.seg}
              onClick={() => setMode(m)}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className={styles.stat}>
          STD <b>{STANDARD}</b>
        </div>
        <div className={styles.live}>
          <span className={styles.liveDot} /> LIVE
        </div>
      </div>

      <div className={styles.body}>
        <div ref={containerRef} className={styles.map} />

        <div className={styles.panel}>
          <div className={styles.panelHead}>◰ SYMBOL GALLERY</div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>FLAG · AFFILIATION</div>
            <div className={styles.flags}>
              {FLAGS.map((a) => (
                <button
                  key={a}
                  className={affiliation === a ? styles.flagOn : styles.flag}
                  style={{ ["--c" as string]: AFFIL_COLOR[a] }}
                  onClick={() => setAffiliation(a)}
                >
                  <span className={styles.swatch} style={{ background: AFFIL_COLOR[a] }} />
                  {a === "unknown" ? "UNKNOWN" : a.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>SYMBOL SET</div>
            <select
              className={styles.select}
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
            >
              {catalog?.symbolSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.count})
                </option>
              ))}
            </select>
            <div className={styles.note}>
              showing <b>{setEntries.length}</b>
              {total > setEntries.length ? ` of ${total}` : ""} · {mode.toUpperCase()} ·{" "}
              {affiliation.toUpperCase()}
            </div>
          </div>

          {mode === "3d" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>3D PRESENTATION</div>
              <div className={styles.flags}>
                {(["puck", "billboard"] as SymbolForm[]).map((f) => (
                  <button
                    key={f}
                    className={form === f ? styles.flagOn : styles.flag}
                    onClick={() => setForm(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className={styles.sliderLabel}>
                VERTICALITY · {form === "billboard" ? "auto" : `${tilt}°`}
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={tilt}
                disabled={form === "billboard"}
                onChange={(e) => setTilt(Number(e.target.value))}
                className={styles.slider}
                aria-label="Puck verticality"
              />

              <div className={styles.sliderLabel}>HEADING · {heading}°</div>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={heading}
                onChange={(e) => setHeading(Number(e.target.value))}
                className={styles.slider}
                aria-label="Icon heading"
              />

              <div className={styles.sliderLabel}>SPIN · {spin}°/s</div>
              <input
                type="range"
                min={0}
                max={180}
                step={5}
                value={spin}
                onChange={(e) => setSpin(Number(e.target.value))}
                className={styles.slider}
                aria-label="Spin rate"
              />
              <div className={styles.note}>orientation · verticality · rotation — all in the URL</div>
            </div>
          )}

          <div className={styles.gridList}>
            {setEntries.map((entry) => (
              <div key={entry.id} className={styles.gridRow} title={entry.label}>
                <span
                  className={styles.trackDot}
                  style={{ color: AFFIL_COLOR[affiliation] }}
                />
                <span className={styles.trackLabel}>{entry.label || entry.mainIcon}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.bottombar}>
        <span>
          SET <b>{setMeta?.name ?? setId}</b>
        </span>
        <span>
          LAT <b>{readout.lat.toFixed(4)}°</b>
        </span>
        <span>
          LON <b>{readout.lng.toFixed(4)}°</b>
        </span>
        <span>
          ZOOM <b>{readout.zoom.toFixed(1)}</b>
        </span>
        <div className={styles.bottomSpacer} />
        <span>
          {mode === "3d" ? "GLB extrusion · Three.js custom layer" : "2D raster markers"} ·
          MapLibre GL JS
        </span>
      </div>
    </div>
  );
}
