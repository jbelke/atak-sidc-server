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
  /**
   * Optional 2D milsymbol raster (PNG) mapped onto the puck's front & back faces.
   * Gives crisp, true-to-2D icons that geometric extrusion cannot reproduce for
   * stroke-based glyphs.
   */
  textureUrl?: string;
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
  /**
   * Lift each puck's far edge toward the camera by this many degrees. 0 = lie
   * flat on the ground (token); 90 = stand fully upright facing the viewer.
   */
  tiltDegrees?: number;
  /** Spin the icon in its own plane, degrees/second (0 = static). */
  headingDegrees?: number;
  /** Continuous in-plane rotation rate, degrees/second (0 = none). */
  spinDegPerSec?: number;
  /**
   * Presentation form. `puck` = ground token leaned by tiltDegrees;
   * `billboard` = always rotate flat-on to the camera (perfect 2D parity).
   */
  form?: SymbolForm;
}

export type SymbolForm = "puck" | "billboard";

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
  private tiltDegrees: number;
  private headingDegrees: number;
  private spinDegPerSec: number;
  private form: SymbolForm;
  private spinPhaseRad = 0;
  private lastFrameMs?: number;

  private map?: maplibregl.Map;
  private camera?: THREE.Camera;
  private scene?: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;
  private readonly symbols: PlacedSymbol[] = [];
  private readonly textureLoader = new THREE.TextureLoader();

  constructor(options: SidcSymbolFieldLayerOptions) {
    this.id = options.id;
    this.tracks = options.tracks;
    this.scaleMultiplier = options.scaleMultiplier ?? 8;
    this.screenSpaceScaling = options.screenSpaceScaling ?? true;
    this.referenceZoomOption = options.referenceZoom;
    this.tiltDegrees = options.tiltDegrees ?? 0;
    this.headingDegrees = options.headingDegrees ?? 0;
    this.spinDegPerSec = options.spinDegPerSec ?? 0;
    this.form = options.form ?? "puck";
  }

  /** Live-adjust how far the pucks lean toward the viewer (0 = flat, 90 = upright). */
  setTilt(degrees: number): void {
    this.tiltDegrees = Math.max(0, Math.min(90, degrees));
    this.map?.triggerRepaint();
  }

  /** Live-adjust the icon's in-plane heading (orientation), degrees. */
  setHeading(degrees: number): void {
    this.headingDegrees = degrees;
    this.map?.triggerRepaint();
  }

  /** Live-adjust the continuous spin rate, degrees/second (0 = stop). */
  setSpin(degPerSec: number): void {
    this.spinDegPerSec = degPerSec;
    this.map?.triggerRepaint();
  }

  /** Switch presentation form: `puck` (leaning token) or `billboard` (faces camera). */
  setForm(form: SymbolForm): void {
    this.form = form;
    this.map?.triggerRepaint();
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
          if (track.textureUrl) {
            this.applyFaceTexture(gltf.scene, track.textureUrl);
          }

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

  /**
   * Lay the 2D milsymbol PNG onto the puck's front and back faces. The texture's
   * transparent background lets the extruded frame's colored rim read as 3D depth
   * while the icon/outline stays pixel-crisp and identical to the 2D symbol.
   */
  private applyFaceTexture(root: THREE.Object3D, url: string): void {
    const box = new THREE.Box3().setFromObject(root);
    if (!Number.isFinite(box.min.z)) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const eps = Math.max(size.z * 0.02, 0.05);

    const texture = this.textureLoader.load(url, () => this.map?.triggerRepaint());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    const geometry = new THREE.PlaneGeometry(size.x, size.y);

    const front = new THREE.Mesh(geometry, material);
    front.position.set(center.x, center.y, box.max.z + eps);
    root.add(front);

    const back = new THREE.Mesh(geometry, material);
    back.position.set(center.x, center.y, box.min.z - eps);
    back.rotation.y = Math.PI; // face outward so the icon isn't mirrored
    root.add(back);
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
    const bearingRad = (this.map.getBearing() * Math.PI) / 180;

    // Advance the spin phase by wall-clock so the rate is frame-rate independent.
    const nowMs =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.lastFrameMs !== undefined && this.spinDegPerSec !== 0) {
      const dt = (nowMs - this.lastFrameMs) / 1000;
      this.spinPhaseRad =
        (this.spinPhaseRad + (this.spinDegPerSec * Math.PI) / 180 * dt) %
        (Math.PI * 2);
    }
    this.lastFrameMs = nowMs;

    // In-plane orientation of the icon: counter the basemap bearing (north-up)
    // plus a fixed heading. (Spin is NOT in-plane — see below.)
    const headingRad = (this.headingDegrees * Math.PI) / 180;
    const rotationZ = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 0, 1),
      -bearingRad + headingRad
    );

    // Lean each puck up toward the viewer. The camera's horizontal look direction
    // (over the ground) at compass bearing B is d = (sinB, -cosB) in mercator
    // (y grows southward); rotating about the horizontal axis d×ẑ lifts the far
    // edge so the face turns to the camera. A `billboard` form auto-sets that
    // lean to the map pitch, so the face stays flat-on to the camera.
    const effectiveTiltDeg =
      this.form === "billboard" ? this.map.getPitch() : this.tiltDegrees;
    const tiltRad = (effectiveTiltDeg * Math.PI) / 180;
    const tiltAxis = new THREE.Vector3(
      -Math.cos(bearingRad),
      -Math.sin(bearingRad),
      0
    );
    const tilt = new THREE.Matrix4().makeRotationAxis(tiltAxis, tiltRad);

    // SPIN turns each puck about the world VERTICAL axis (mercator +z = up).
    // Applied OUTSIDE the lean, so a leaned puck sweeps around like a standee on
    // a turntable — face → edge → back → face — revealing its 3D sides.
    const spinVertical = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 0, 1),
      this.spinPhaseRad
    );

    for (const symbol of this.symbols) {
      const scale = symbol.meterScale * this.scaleMultiplier * zoomScale;
      const scaleM = new THREE.Matrix4().makeScale(scale, -scale, scale);
      symbol.group.matrix
        .makeTranslation(symbol.mercatorX, symbol.mercatorY, symbol.mercatorZ)
        .multiply(spinVertical)
        .multiply(tilt)
        .multiply(scaleM)
        .multiply(rotationZ);
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
