import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { ensureBrowserGlobals } from "./dom";
import { classifySymbolPath } from "./path-role";
import {
  DEFAULT_EXTRUDE_OPTIONS,
  DEFAULT_TARGET_SIZE,
  ExtrudeOptions,
  MeshPrimitive,
  Symbol3DMeshDocument,
  Symbol3DOptions,
} from "./types";

// The inner entity icon is extruded thicker than the frame and then CENTERED on
// the frame's mid-plane so it stands proud of BOTH faces — a true double-sided
// emboss/relief, readable whether the camera sees the symbol's front or back.
const ICON_DEPTH_MULTIPLIER = 2.8;

function resolveExtrudeOptions(
  partial?: Partial<ExtrudeOptions>
): ExtrudeOptions {
  return { ...DEFAULT_EXTRUDE_OPTIONS, ...partial };
}

function colorToHex(color: THREE.Color): string {
  return `#${color.getHexString()}`;
}

function buildMaterial(
  color: THREE.Color,
  opacity: number,
  role: "frame" | "icon"
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0,
    roughness: 1,
    side: THREE.DoubleSide,
    flatShading: role === "icon",
    transparent: opacity < 1,
    opacity,
  });
}

export function buildSymbolScene(
  svgString: string,
  options: Symbol3DOptions = {}
): THREE.Group {
  ensureBrowserGlobals();

  const extrude = resolveExtrudeOptions(options.extrude);
  const flipY = options.flipY ?? true;
  const targetSize = options.targetSize ?? DEFAULT_TARGET_SIZE;
  const frameOnly = options.frameOnly ?? false;

  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);

  const group = new THREE.Group();
  group.name = "symbol";

  for (let i = 0; i < svgData.paths.length; i++) {
    const path = svgData.paths[i];
    const role = classifySymbolPath(path, i);

    // milsymbol draws inner icons with strokes (fill="none"). Feeding those to
    // createShapes fills the closed stroke outline as a solid (white) blob that
    // looks nothing like the 2D glyph — so we only extrude paths that actually
    // have a fill, and in frameOnly mode only the affiliation frame.
    const style = path.userData?.style as
      | { fill?: string; fillOpacity?: number }
      | undefined;
    const fill = style?.fill;
    const hasFill = fill !== undefined && fill !== "none";
    if (!hasFill) continue;
    if (frameOnly && role !== "frame") continue;

    const shapes = SVGLoader.createShapes(path);

    const fillOpacity = path.userData?.style?.fillOpacity;
    const opacity =
      typeof fillOpacity === "number" && !Number.isNaN(fillOpacity)
        ? fillOpacity
        : 1;

    const material = buildMaterial(path.color, opacity, role);

    const pathDepth =
      role === "icon" ? extrude.depth * ICON_DEPTH_MULTIPLIER : extrude.depth;
    const pathExtrude: ExtrudeOptions = {
      ...extrude,
      depth: pathDepth,
      bevelEnabled: role === "frame" ? extrude.bevelEnabled : false,
      bevelThickness: role === "frame" ? extrude.bevelThickness : 0,
      bevelSize: role === "frame" ? extrude.bevelSize : 0,
      bevelSegments: role === "frame" ? extrude.bevelSegments : 1,
    };

    for (let j = 0; j < shapes.length; j++) {
      const geometry = new THREE.ExtrudeGeometry(shapes[j], pathExtrude);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${role}-${i}-${j}`;
      if (role === "icon") {
        // Frame occupies z ∈ [0, depth]; an icon of depth `pathDepth` whose
        // start sits at (depth - pathDepth)/2 is centered on depth/2, so it
        // pokes out equally front and back: embossed on both sides.
        mesh.position.z = (extrude.depth - pathDepth) / 2;
      }
      group.add(mesh);
    }
  }

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Self-contained icon: lay the 2D symbol PNG on the puck's front & back faces
  // so an external glTF viewer (ATAK, Cesium, Blender) shows a crisp, true-to-2D
  // icon — the same trick the live viewer does, but baked into the asset.
  if (options.iconTexturePng) {
    const eps = Math.max(size.z * 0.02, 0.05);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y));
    front.name = "icon-front";
    front.position.set(center.x, center.y, box.max.z + eps);
    front.userData.texturePng = options.iconTexturePng;
    group.add(front);

    const back = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y));
    back.name = "icon-back";
    back.position.set(center.x, center.y, box.min.z - eps);
    back.rotation.y = Math.PI; // face outward
    back.userData.texturePng = options.iconTexturePng;
    group.add(back);
  }

  group.position.sub(center);

  if (flipY) {
    group.scale.y *= -1;
  }

  if (maxDim > 0) {
    group.scale.multiplyScalar(targetSize / maxDim);
  }

  group.updateMatrixWorld(true);
  const fittedBox = new THREE.Box3().setFromObject(group);
  const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
  group.position.sub(fittedCenter);

  return group;
}

export function groupToMeshDocument(
  group: THREE.Group,
  metadata: Pick<Symbol3DOptions, "sidc" | "standard"> & {
    pose?: { headingDeg: number; tiltDeg: number };
    spin?: { degPerSec: number };
    form?: string;
  } = {}
): Symbol3DMeshDocument {
  const meshes: MeshPrimitive[] = [];
  const bounds = new THREE.Box3();

  group.updateMatrixWorld(true);

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const mesh = object as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry;

    if (!geometry.attributes.position) {
      return;
    }

    const worldMatrix = mesh.matrixWorld;
    const position = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;
    const indexAttr = geometry.index;

    const vertices: number[] = [];
    const normals: number[] = [];
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      vertex.applyMatrix4(worldMatrix);
      vertices.push(vertex.x, vertex.y, vertex.z);
      bounds.expandByPoint(vertex);

      if (normalAttr) {
        normal.fromBufferAttribute(normalAttr, i);
        normal.applyMatrix3(normalMatrix).normalize();
        normals.push(normal.x, normal.y, normal.z);
      } else {
        normals.push(0, 0, 1);
      }
    }

    const indices: number[] = [];
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.getX(i));
      }
    } else {
      for (let i = 0; i < position.count; i++) {
        indices.push(i);
      }
    }

    const material = mesh.material as THREE.MeshStandardMaterial;
    const color =
      material.color instanceof THREE.Color
        ? colorToHex(material.color)
        : "#000000";
    const opacity = material.opacity ?? 1;

    const texturePng = mesh.userData?.texturePng as string | undefined;
    const uvAttr = geometry.attributes.uv;
    let uvs: number[] | undefined;
    if (texturePng && uvAttr) {
      uvs = [];
      for (let i = 0; i < uvAttr.count; i++) {
        uvs.push(uvAttr.getX(i), uvAttr.getY(i));
      }
    }

    meshes.push({
      name: mesh.name || `mesh-${meshes.length}`,
      vertices,
      normals,
      indices,
      color,
      opacity,
      uvs,
      texturePng,
    });
  });

  const min = bounds.min;
  const max = bounds.max;

  return {
    version: 1,
    sidc: metadata.sidc,
    standard: metadata.standard,
    bounds: {
      min: [min.x, min.y, min.z],
      max: [max.x, max.y, max.z],
    },
    meshes,
    pose: metadata.pose,
    spin: metadata.spin,
    form: metadata.form,
  };
}
