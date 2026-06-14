import maplibregl, { type CustomRenderMethodInput } from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  applyFlatSymbolMaterials,
  groundSymbolModel,
} from "@/lib/maplibre/applyFlatSymbolMaterials";

export interface SymbolFieldTrack {
  id: string;
  modelUrl: string;
  lngLat: [number, number];
  altitudeMeters?: number;
}

export interface SidcSymbolFieldLayerOptions {
  id: string;
  tracks: SymbolFieldTrack[];
  /** Apparent symbol size multiplier on top of the per-track mercator meter scale. */
  scaleMultiplier?: number;
  /** Zoom at which scaleMultiplier defines the on-screen size. */
  referenceZoom?: number;
  /** Keep roughly constant on-screen size while zooming (map-marker behavior). */
  screenSpaceScaling?: boolean;
}

interface PlacedSymbol {
  group: THREE.Group;
  mercatorX: number;
  mercatorY: number;
  mercatorZ: number;
  meterScale: number;
}

/**
 * MapLibre custom 3D layer that renders MANY georeferenced GLB military symbols
 * (one shared scene / renderer). Each symbol stands upright, faces map-north,
 * and keeps a constant apparent size as you zoom — a lightweight 3D COP.
 *
 * Uses MapLibre v5's `defaultProjectionData.mainMatrix` (mercator → clip); each
 * symbol's own mercator placement lives in its wrapper group's world matrix.
 */
export class SidcSymbolFieldLayer implements maplibregl.CustomLayerInterface {
  id: string;
  type: "custom" = "custom";
  renderingMode: "3d" = "3d";

  private readonly tracks: SymbolFieldTrack[];
  private readonly scaleMultiplier: number;
  private readonly screenSpaceScaling: boolean;
  private readonly referenceZoomOption?: number;
  private referenceZoom = 0;

  private map?: maplibregl.Map;
  private camera?: THREE.Camera;
  private scene?: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;
  private readonly symbols: PlacedSymbol[] = [];

  constructor(options: SidcSymbolFieldLayerOptions) {
    this.id = options.id;
    this.tracks = options.tracks;
    this.scaleMultiplier = options.scaleMultiplier ?? 8;
    this.screenSpaceScaling = options.screenSpaceScaling ?? true;
    this.referenceZoomOption = options.referenceZoom;
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.map = map;
    this.referenceZoom = this.referenceZoomOption ?? map.getZoom();
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();

    const loader = new GLTFLoader();
    for (const track of this.tracks) {
      loader.load(
        track.modelUrl,
        (gltf: GLTF) => {
          if (!this.scene) return;
          applyFlatSymbolMaterials(gltf.scene);
          groundSymbolModel(gltf.scene);

          const wrapper = new THREE.Group();
          wrapper.matrixAutoUpdate = false; // we drive the matrix each frame
          wrapper.add(gltf.scene);
          wrapper.traverse((o) => {
            o.frustumCulled = false; // extreme mercator matrices confuse culling
          });
          this.scene.add(wrapper);

          const mercator = maplibregl.MercatorCoordinate.fromLngLat(
            track.lngLat,
            track.altitudeMeters ?? 0
          );
          this.symbols.push({
            group: wrapper,
            mercatorX: mercator.x,
            mercatorY: mercator.y,
            mercatorZ: mercator.z,
            meterScale: mercator.meterInMercatorCoordinateUnits(),
          });
          map.triggerRepaint();
        },
        undefined,
        (error: unknown) => {
          console.error(`SidcSymbolFieldLayer: failed to load ${track.id}`, error);
        }
      );
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  onRemove(): void {
    this.symbols.length = 0;
    this.renderer?.dispose();
    this.renderer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.map = undefined;
  }

  render(
    _gl: WebGLRenderingContext | WebGL2RenderingContext,
    options: CustomRenderMethodInput
  ): void {
    if (!this.renderer || !this.scene || !this.camera || !this.map) {
      return;
    }

    const zoom = this.map.getZoom();
    const zoomScale = this.screenSpaceScaling
      ? Math.pow(2, this.referenceZoom - zoom)
      : 1;
    const bearing = (-this.map.getBearing() * Math.PI) / 180;

    const rotationX = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2 // stand the flat artwork upright
    );
    const rotationY = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 1, 0),
      bearing // keep facing map-north as the basemap rotates
    );

    for (const symbol of this.symbols) {
      const scale = symbol.meterScale * this.scaleMultiplier * zoomScale;
      symbol.group.matrix
        .makeTranslation(symbol.mercatorX, symbol.mercatorY, symbol.mercatorZ)
        .scale(new THREE.Vector3(scale, -scale, scale))
        .multiply(rotationX)
        .multiply(rotationY);
      symbol.group.matrixWorldNeedsUpdate = true;
    }

    // mainMatrix maps mercator → clip; each wrapper matrix carries its own placement.
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(
      options.defaultProjectionData.mainMatrix
    );
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }
}
