"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  buildSymbolGlbUrl,
  SidcSymbol3DLayer,
} from "@/lib/maplibre/SidcSymbol3DLayer";

const DEFAULT_SIDC = "10133000001207000000";
const DEFAULT_STANDARD = "APP6";
const DEFAULT_CENTER: [number, number] = [12.5683, 55.6761]; // Copenhagen

// OpenStreetMap raster basemap — no API key, and (unlike demotiles) has detail at
// the high zoom levels where a meter-scaled 3D symbol is readable.
const BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

interface DemoParams {
  sidc: string;
  standard: string;
  depth: number;
  targetSize: number;
  scale: number;
}

function readDemoParams(): DemoParams {
  if (typeof window === "undefined") {
    return {
      sidc: DEFAULT_SIDC,
      standard: DEFAULT_STANDARD,
      depth: 8,
      targetSize: 100,
      scale: 6,
    };
  }

  const search = new URLSearchParams(window.location.search);
  return {
    sidc: search.get("sidc") ?? DEFAULT_SIDC,
    standard: search.get("standard") ?? DEFAULT_STANDARD,
    depth: Number(search.get("depth") ?? "8"),
    targetSize: Number(search.get("targetSize") ?? "100"),
    scale: Number(search.get("scale") ?? "6"),
  };
}

export default function MapLibreDemoPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [modelUrl, setModelUrl] = useState("");

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const params = readDemoParams();
    const origin = DEFAULT_CENTER;
    const glbUrl = buildSymbolGlbUrl(
      window.location.origin,
      params.standard,
      params.sidc,
      {
        depth: params.depth,
        targetSize: params.targetSize,
      }
    );
    setModelUrl(glbUrl);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: origin,
      zoom: 15.5,
      pitch: 60,
      bearing: -20,
      canvasContextAttributes: { antialias: true },
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const symbolLayer = new SidcSymbol3DLayer({
      id: "sidc-symbol-3d",
      modelUrl: glbUrl,
      origin,
      scaleMultiplier: params.scale,
    });

    map.on("style.load", () => {
      map.addLayer(symbolLayer);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "12px 16px",
          background: "#0f172a",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          borderBottom: "1px solid #334155",
        }}
      >
        <strong>MapLibre 3D SIDC symbol</strong>
        <span style={{ marginLeft: 12, color: "#94a3b8" }}>
          GLB from this server · tilted map · custom Three.js layer
        </span>
        {modelUrl && (
          <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
            Model:{" "}
            <a href={modelUrl} style={{ color: "#38bdf8" }}>
              {modelUrl}
            </a>
          </div>
        )}
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
          Query: ?sidc=…&standard=APP6&depth=8&targetSize=100&scale=6
        </div>
      </header>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
