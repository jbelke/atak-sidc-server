import maplibregl, { type CustomRenderMethodInput } from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  applyFlatSymbolMaterials,
  groundSymbolModel,
} from "@/lib/maplibre/applyFlatSymbolMaterials";

export interface SidcSymbolLayerOptions {
  id: string;
  modelUrl: string;
  origin: [number, number];
  altitudeMeters?: number;
  /** Extra scale multiplier on top of mercator meter scale at reference zoom */
  scaleMultiplier?: number;
  /**
   * Keep roughly constant on-screen size while zooming (map-marker behavior).
   * When false, size follows real-world meters and shrinks as you zoom out.
   */
  screenSpaceScaling?: boolean;
  /** Zoom level where scaleMultiplier defines apparent symbol size */
  referenceZoom?: number;
}

/**
 * MapLibre custom 3D layer that renders a GLB military symbol at a geographic point.
 * Symbols stand upright (vertical billboard) with flat APP-6 colors for map readability.
 */
export class SidcSymbol3DLayer implements maplibregl.CustomLayerInterface {
  id: string;
  type: "custom" = "custom";
  renderingMode: "3d" = "3d";

  private readonly modelUrl: string;
  private readonly origin: [number, number];
  private readonly altitudeMeters: number;
  private readonly scaleMultiplier: number;
  private readonly screenSpaceScaling: boolean;
  private readonly referenceZoomOption?: number;
  private referenceZoom: number;
  private baseMeterScale: number;

  private map?: maplibregl.Map;
  private camera?: THREE.Camera;
  private scene?: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;
  private model?: THREE.Group;
  private modelTransform?: {
    translateX: number;
    translateY: number;
    translateZ: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
  };

  constructor(options: SidcSymbolLayerOptions) {
    this.id = options.id;
    this.modelUrl = options.modelUrl;
    this.origin = options.origin;
    this.altitudeMeters = options.altitudeMeters ?? 0;
    this.scaleMultiplier = options.scaleMultiplier ?? 1;
    this.screenSpaceScaling = options.screenSpaceScaling ?? true;
    this.referenceZoomOption = options.referenceZoom;
    this.referenceZoom = 0;
    this.baseMeterScale = 0;
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.map = map;
    this.referenceZoom = this.referenceZoomOption ?? map.getZoom();
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();

    const mercator = maplibregl.MercatorCoordinate.fromLngLat(
      this.origin,
      this.altitudeMeters
    );

    // Stand symbol vertical (face readable on a pitched map), spin with map bearing.
    this.modelTransform = {
      translateX: mercator.x,
      translateY: mercator.y,
      translateZ: mercator.z,
      rotateX: -Math.PI / 2,
      rotateY: 0,
      rotateZ: 0,
    };

    this.baseMeterScale =
      mercator.meterInMercatorCoordinateUnits() * this.scaleMultiplier;

    const loader = new GLTFLoader();
    loader.load(
      this.modelUrl,
      (gltf: GLTF) => {
        applyFlatSymbolMaterials(gltf.scene);
        groundSymbolModel(gltf.scene);
        this.model = gltf.scene;
        this.scene?.add(this.model);
        map.triggerRepaint();
      },
      undefined,
      (error: unknown) => {
        console.error("SidcSymbol3DLayer: failed to load GLB", error);
      }
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  onRemove(): void {
    this.model = undefined;
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
    if (
      !this.model ||
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.modelTransform ||
      !this.map
    ) {
      return;
    }

    // Keep the symbol facing map north as the user rotates the basemap.
    this.modelTransform.rotateY =
      (-this.map.getBearing() * Math.PI) / 180;

    const zoomScale = this.screenSpaceScaling
      ? Math.pow(2, this.referenceZoom - this.map.getZoom())
      : 1;
    const scale = this.baseMeterScale * zoomScale;

    const rotationX = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(1, 0, 0),
      this.modelTransform.rotateX
    );
    const rotationY = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 1, 0),
      this.modelTransform.rotateY
    );
    const rotationZ = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 0, 1),
      this.modelTransform.rotateZ
    );

    const mapMatrix = new THREE.Matrix4().fromArray(
      options.defaultProjectionData.mainMatrix
    );
    const localMatrix = new THREE.Matrix4()
      .makeTranslation(
        this.modelTransform.translateX,
        this.modelTransform.translateY,
        this.modelTransform.translateZ
      )
      .scale(
        new THREE.Vector3(scale, -scale, scale)
      )
      .multiply(rotationX)
      .multiply(rotationY)
      .multiply(rotationZ);

    this.camera.projectionMatrix = mapMatrix.multiply(localMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }
}

export function buildSymbolGlbUrl(
  baseUrl: string,
  standard: string,
  sidc: string,
  params: { depth?: number; targetSize?: number } = {}
): string {
  const search = new URLSearchParams();
  if (params.depth !== undefined) {
    search.set("depth", String(params.depth));
  }
  if (params.targetSize !== undefined) {
    search.set("targetSize", String(params.targetSize));
  }
  const query = search.toString();
  return `${baseUrl.replace(/\/$/, "")}/api/${standard}/${sidc}.glb${query ? `?${query}` : ""}`;
}
