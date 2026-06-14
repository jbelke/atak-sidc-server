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
