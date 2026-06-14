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

const ICON_DEPTH_MULTIPLIER = 2.8;
const ICON_Z_OFFSET_FACTOR = 1.05;

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

  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);

  const group = new THREE.Group();
  group.name = "symbol";

  for (let i = 0; i < svgData.paths.length; i++) {
    const path = svgData.paths[i];
    const shapes = SVGLoader.createShapes(path);
    const role = classifySymbolPath(path, i);

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
        mesh.position.z = extrude.depth * ICON_Z_OFFSET_FACTOR;
      }
      group.add(mesh);
    }
  }

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

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
  metadata: Pick<Symbol3DOptions, "sidc" | "standard"> = {}
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

    meshes.push({
      name: mesh.name || `mesh-${meshes.length}`,
      vertices,
      normals,
      indices,
      color,
      opacity,
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
  };
}
