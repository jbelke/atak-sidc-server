import * as THREE from "three";
import { buildSymbolScene, groupToMeshDocument } from "./build-scene";
import { exportSymbol3D } from "./export";
import {
  ExtrudeOptions,
  Symbol3DFormat,
  Symbol3DMeshDocument,
  Symbol3DOptions,
} from "./types";

export type {
  ExtrudeOptions,
  MeshPrimitive,
  Symbol3DFormat,
  Symbol3DMeshDocument,
  Symbol3DOptions,
} from "./types";

export { DEFAULT_EXTRUDE_OPTIONS, DEFAULT_TARGET_SIZE } from "./types";

export interface GenerateSymbol3DResult {
  group: THREE.Group;
  meshDocument: Symbol3DMeshDocument;
  data: string | ArrayBuffer;
}

export function parseExtrudeOptions(
  searchParams: URLSearchParams
): Partial<ExtrudeOptions> {
  const options: Partial<ExtrudeOptions> = {};

  const depth = searchParams.get("depth");
  if (depth !== null) {
    options.depth = parseFloat(depth);
  }

  const bevel = searchParams.get("bevel");
  if (bevel !== null) {
    options.bevelEnabled = bevel === "true" || bevel === "1";
  }

  const bevelThickness = searchParams.get("bevelThickness");
  if (bevelThickness !== null) {
    options.bevelThickness = parseFloat(bevelThickness);
  }

  const bevelSize = searchParams.get("bevelSize");
  if (bevelSize !== null) {
    options.bevelSize = parseFloat(bevelSize);
  }

  const bevelSegments = searchParams.get("bevelSegments");
  if (bevelSegments !== null) {
    options.bevelSegments = parseInt(bevelSegments, 10);
  }

  return options;
}

export function parseSymbol3DOptions(
  searchParams: URLSearchParams,
  metadata: Pick<Symbol3DOptions, "sidc" | "standard"> = {}
): Symbol3DOptions {
  const targetSize = searchParams.get("targetSize");
  const flipY = searchParams.get("flipY");
  const frameOnly = searchParams.get("frameOnly");

  return {
    extrude: parseExtrudeOptions(searchParams),
    targetSize:
      targetSize !== null ? parseFloat(targetSize) : undefined,
    flipY: flipY !== null ? flipY === "true" || flipY === "1" : undefined,
    frameOnly:
      frameOnly !== null ? frameOnly === "true" || frameOnly === "1" : undefined,
    sidc: metadata.sidc,
    standard: metadata.standard,
  };
}

export async function generateSymbol3D(
  svgString: string,
  format: Symbol3DFormat,
  options: Symbol3DOptions = {}
): Promise<GenerateSymbol3DResult> {
  const group = buildSymbolScene(svgString, options);
  const meshDocument = groupToMeshDocument(group, {
    sidc: options.sidc,
    standard: options.standard,
  });
  const data = await exportSymbol3D(group, format, meshDocument);

  return { group, meshDocument, data };
}

export async function convertSVGTo3D(
  svgString: string,
  format: Symbol3DFormat,
  options: Symbol3DOptions = {}
): Promise<string | ArrayBuffer> {
  const { data } = await generateSymbol3D(svgString, format, options);
  return data;
}
