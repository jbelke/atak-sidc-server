import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { meshDocumentToGLB, meshDocumentToGLTF } from "./gltf-from-mesh";
import { Symbol3DFormat, Symbol3DMeshDocument } from "./types";

function createExportScene(group: THREE.Group): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(group.clone(true));
  return scene;
}

export async function exportSymbol3D(
  group: THREE.Group,
  format: Symbol3DFormat,
  meshDocument?: Symbol3DMeshDocument
): Promise<string | ArrayBuffer> {
  switch (format) {
    case "mesh":
      if (!meshDocument) {
        throw new Error("Mesh document required for mesh export");
      }
      return JSON.stringify(meshDocument);

    case "gltf":
      if (!meshDocument) {
        throw new Error("Mesh document required for gltf export");
      }
      return await meshDocumentToGLTF(meshDocument);

    case "glb":
      if (!meshDocument) {
        throw new Error("Mesh document required for glb export");
      }
      return await meshDocumentToGLB(meshDocument);

    case "obj": {
      const exporter = new OBJExporter();
      return exporter.parse(createExportScene(group));
    }

    default:
      throw new Error(`Unsupported 3D format: ${format}`);
  }
}
