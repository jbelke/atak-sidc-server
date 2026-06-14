export type Symbol3DFormat = "gltf" | "glb" | "obj" | "mesh";

export interface ExtrudeOptions {
  depth: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  bevelOffset: number;
  bevelSegments: number;
}

export interface Symbol3DOptions {
  extrude?: Partial<ExtrudeOptions>;
  /** Scale the model so its largest dimension equals this value */
  targetSize?: number;
  /** Flip SVG Y-down coordinates to Y-up (recommended for WebGL / Three.js) */
  flipY?: boolean;
  /**
   * Extrude only the affiliation frame (a colored "puck"), skipping inner icon
   * geometry. The icon is meant to be supplied as a texture on the puck faces —
   * milsymbol icons are stroke-based (fill="none") and do not survive fill
   * extrusion, so geometric icons read as solid blobs.
   */
  frameOnly?: boolean;
  /** Base64 PNG (no data: prefix) of the 2D symbol, textured onto the puck faces. */
  iconTexturePng?: string;
  /** Baked default pose: in-plane icon orientation, degrees. */
  headingDegrees?: number;
  /** Baked default pose: lean toward the (default) viewer, degrees. */
  tiltDegrees?: number;
  /** Bake a continuous spin animation, degrees/second (0 = none). */
  spinDegPerSec?: number;
  /** Presentation form hint recorded in the GLB (`puck` | `billboard`). */
  form?: string;
  sidc?: string;
  standard?: string;
}

export interface MeshPrimitive {
  name: string;
  vertices: number[];
  normals: number[];
  indices: number[];
  color: string;
  opacity: number;
  /** UVs (length = vertices/3 * 2) for textured faces. */
  uvs?: number[];
  /** Base64 PNG mapped as this primitive's baseColorTexture. */
  texturePng?: string;
}

export interface Symbol3DMeshDocument {
  version: 1;
  sidc?: string;
  standard?: string;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  meshes: MeshPrimitive[];
  /** Baked default pose applied to the GLB root node. */
  pose?: { headingDeg: number; tiltDeg: number };
  /** Continuous spin animation about the face normal, degrees/second. */
  spin?: { degPerSec: number };
  /** Presentation form hint (`puck` | `billboard`). */
  form?: string;
}

export const DEFAULT_EXTRUDE_OPTIONS: ExtrudeOptions = {
  depth: 4,
  bevelEnabled: true,
  bevelThickness: 0.35,
  bevelSize: 0.35,
  bevelOffset: 0,
  bevelSegments: 2,
};

export const DEFAULT_TARGET_SIZE = 100;
