import {
  Accessor,
  Document,
  Material,
  NodeIO,
} from "@gltf-transform/core";
import { Symbol3DMeshDocument } from "./types";

function hexToLinearRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const linear = (channel: number) =>
    channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);

  return [linear(r), linear(g), linear(b)];
}

function toIndexArray(indices: number[], vertexCount: number): Uint16Array | Uint32Array {
  const maxIndex = indices.length > 0 ? Math.max(...indices) : 0;
  if (maxIndex >= 65535 || vertexCount >= 65535) {
    return new Uint32Array(indices);
  }
  return new Uint16Array(indices);
}

function buildDocument(meshDocument: Symbol3DMeshDocument): Document {
  const document = new Document();
  const buffer = document.createBuffer("geometry");
  const scene = document.createScene("symbol");
  const rootNode = document.createNode("symbol-root");
  scene.addChild(rootNode);

  for (const meshData of meshDocument.meshes) {
    const mesh = document.createMesh(meshData.name);
    const primitive = document.createPrimitive();

    const positionAccessor = document
      .createAccessor(`${meshData.name}-position`, buffer)
      .setArray(new Float32Array(meshData.vertices))
      .setType(Accessor.Type.VEC3);

    const normalAccessor = document
      .createAccessor(`${meshData.name}-normal`, buffer)
      .setArray(new Float32Array(meshData.normals))
      .setType(Accessor.Type.VEC3);

    const indexAccessor = document
      .createAccessor(`${meshData.name}-indices`, buffer)
      .setArray(
        toIndexArray(
          meshData.indices,
          meshData.vertices.length / 3
        )
      )
      .setType(Accessor.Type.SCALAR);

    primitive
      .setAttribute("POSITION", positionAccessor)
      .setAttribute("NORMAL", normalAccessor)
      .setIndices(indexAccessor);

    const [r, g, b] = hexToLinearRgb(meshData.color);
    const material = document
      .createMaterial(`${meshData.name}-material`)
      .setDoubleSided(true)
      .setBaseColorFactor([r, g, b, meshData.opacity])
      .setEmissiveFactor([r, g, b])
      .setMetallicFactor(0)
      .setRoughnessFactor(1);

    if (meshData.opacity < 1) {
      material.setAlphaMode(Material.AlphaMode.BLEND);
    }

    primitive.setMaterial(material);
    mesh.addPrimitive(primitive);

    const node = document.createNode(meshData.name).setMesh(mesh);
    rootNode.addChild(node);
  }

  return document;
}

export async function meshDocumentToGLB(
  meshDocument: Symbol3DMeshDocument
): Promise<ArrayBuffer> {
  const document = buildDocument(meshDocument);
  const io = new NodeIO();
  const binary = await io.writeBinary(document);
  return binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength
  ) as ArrayBuffer;
}

export async function meshDocumentToGLTF(
  meshDocument: Symbol3DMeshDocument
): Promise<string> {
  const document = buildDocument(meshDocument);
  const io = new NodeIO();
  const json = await io.writeJSON(document);
  return JSON.stringify(json);
}
