import {
  Accessor,
  Document,
  Material,
  NodeIO,
  type Texture,
} from "@gltf-transform/core";
import * as THREE from "three";
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

function poseRotation(pose?: {
  headingDeg: number;
  tiltDeg: number;
}): [number, number, number, number] {
  if (!pose || (pose.headingDeg === 0 && pose.tiltDeg === 0)) {
    return [0, 0, 0, 1];
  }
  const deg = Math.PI / 180;
  // heading spins the icon in its own plane (about the face normal, Z); tilt
  // then lifts it about X. Euler XYZ applies Z first, X last → heading-then-tilt.
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pose.tiltDeg * deg, 0, pose.headingDeg * deg, "XYZ")
  );
  return [q.x, q.y, q.z, q.w];
}

function addSpinAnimation(
  document: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  targetNode: ReturnType<Document["createNode"]>,
  degPerSec: number
): void {
  const period = 360 / Math.abs(degPerSec); // seconds per revolution
  const dir = Math.sign(degPerSec);
  const steps = 8;
  const times: number[] = [];
  const quats: number[] = [];
  // Turn about the vertical axis (Z = up when the puck lies flat) — a leaned
  // symbol sweeps around like a standee on a turntable, revealing its sides.
  const axis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= steps; i++) {
    times.push((period * i) / steps);
    const q = new THREE.Quaternion().setFromAxisAngle(
      axis,
      dir * 2 * Math.PI * (i / steps)
    );
    quats.push(q.x, q.y, q.z, q.w);
  }

  const input = document
    .createAccessor("spin-input", buffer)
    .setArray(new Float32Array(times))
    .setType(Accessor.Type.SCALAR);
  const output = document
    .createAccessor("spin-output", buffer)
    .setArray(new Float32Array(quats))
    .setType(Accessor.Type.VEC4);

  const sampler = document
    .createAnimationSampler()
    .setInput(input)
    .setOutput(output)
    .setInterpolation("LINEAR");
  const channel = document
    .createAnimationChannel()
    .setTargetNode(targetNode)
    .setTargetPath("rotation")
    .setSampler(sampler);
  document.createAnimation("spin").addSampler(sampler).addChannel(channel);
}

function buildDocument(meshDocument: Symbol3DMeshDocument): Document {
  const document = new Document();
  const buffer = document.createBuffer("geometry");
  const scene = document.createScene("symbol");

  // Node order: spin (outer, animated about vertical) → pose (lean) → meshes,
  // so a leaned symbol turns about the world-vertical axis like a standee on a
  // turntable — matching the live viewer. Spin outside the lean, not under it.
  const spinNode = document.createNode("symbol-spin");
  if (meshDocument.form) {
    spinNode.setExtras({ ...spinNode.getExtras(), form: meshDocument.form });
  }
  scene.addChild(spinNode);
  const poseNode = document.createNode("symbol-pose");
  poseNode.setRotation(poseRotation(meshDocument.pose));
  spinNode.addChild(poseNode);

  // one Texture per distinct PNG (front & back faces share it).
  const textureCache = new Map<string, Texture>();
  const getTexture = (png: string): Texture => {
    const cached = textureCache.get(png);
    if (cached) return cached;
    const texture = document
      .createTexture("icon")
      .setMimeType("image/png")
      .setImage(new Uint8Array(Buffer.from(png, "base64")));
    textureCache.set(png, texture);
    return texture;
  };

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
      .setMetallicFactor(0)
      .setRoughnessFactor(1);

    if (meshData.texturePng && meshData.uvs) {
      const uvAccessor = document
        .createAccessor(`${meshData.name}-uv`, buffer)
        .setArray(new Float32Array(meshData.uvs))
        .setType(Accessor.Type.VEC2);
      primitive.setAttribute("TEXCOORD_0", uvAccessor);
      material
        .setBaseColorFactor([1, 1, 1, 1])
        .setBaseColorTexture(getTexture(meshData.texturePng))
        .setAlphaMode(Material.AlphaMode.BLEND);
    } else {
      material.setEmissiveFactor([r, g, b]);
      if (meshData.opacity < 1) {
        material.setAlphaMode(Material.AlphaMode.BLEND);
      }
    }

    primitive.setMaterial(material);
    mesh.addPrimitive(primitive);

    const node = document.createNode(meshData.name).setMesh(mesh);
    poseNode.addChild(node);
  }

  if (meshDocument.spin && meshDocument.spin.degPerSec !== 0) {
    addSpinAnimation(document, buffer, spinNode, meshDocument.spin.degPerSec);
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
