import ms from "milsymbol";
import { NextRequest } from "next/server";
import sharp from "sharp";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { SVGPathData } from "svg-pathdata";
import { JSDOM } from "jsdom";

type RouteParams = {
  params: {
    standard: string;
    sidc: string;
  };
};

type ImageFormat =
  | "svg"
  | "png"
  | "jpg"
  | "jpeg"
  | "gif"
  | "webp"
  | "avif"
  | "gltf"
  | "glb"
  | "obj";

interface ImageDimensions {
  width: number;
  height: number;
}

const DEFAULT_SIZE = 100;
const MIME_TYPES = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  gltf: "model/gltf+json",
  glb: "model/gltf-binary",
  obj: "model/obj",
} as const;

function getDimensions(searchParams: URLSearchParams): ImageDimensions {
  const size = parseInt(searchParams.get("size") || String(DEFAULT_SIZE), 10);
  const width = parseInt(searchParams.get("width") || String(size), 10);
  const height = parseInt(searchParams.get("height") || String(width), 10);
  return { width, height };
}

function getSymbolFormat(sidc: string): ImageFormat {
  const format = sidc.split(".").pop()?.toLowerCase() as ImageFormat;
  if (!Object.keys(MIME_TYPES).includes(format)) {
    throw new Error("Unsupported format");
  }
  return format;
}

async function generateImage(
  svg: string,
  dimensions: ImageDimensions,
  format: ImageFormat
): Promise<Buffer> {
  const image = sharp(Buffer.from(svg))
    .resize(dimensions.width, dimensions.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    // Ensure we preserve alpha channel
    .ensureAlpha();

  switch (format) {
    case "jpg":
    case "jpeg":
      return image
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg()
        .toBuffer();
    case "gif":
      return image.gif().toBuffer();
    case "webp":
      return image
        .webp({
          alphaQuality: 100,
          lossless: true,
        })
        .toBuffer();
    case "avif":
      return image
        .avif({
          quality: 90,
          lossless: true,
        })
        .toBuffer();
    default: // PNG
      return image
        .png({
          compressionLevel: 9,
          palette: false, // Ensure we don't convert to indexed color
        })
        .toBuffer();
  }
}

async function convertSVGTo3D(svgString: string, format: ImageFormat) {
  // Create virtual DOM for SVG parsing
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body>${svgString}</body></html>`,
    {
      url: "http://localhost",
      contentType: "text/html",
      runScripts: "dangerously",
      resources: "usable",
    }
  );

  const document = dom.window.document;
  const svgElement = document.querySelector("svg");

  if (!svgElement) {
    throw new Error("No SVG element found");
  }

  try {
    // Create a 3D scene
    const scene = new THREE.Scene();
    const group = new THREE.Group();

    // Get all paths from the SVG
    const pathElements = svgElement.getElementsByTagName("path");

    // Parameters for 3D conversion
    const extrudeSettings = {
      depth: 5,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelOffset: 0,
      bevelSegments: 3,
    };

    // Process each path in the SVG
    for (let i = 0; i < pathElements.length; i++) {
      const pathElement = pathElements[i];
      const pathData = new SVGPathData(pathElement.getAttribute("d") || "");
      const shape = new THREE.Shape();

      // Convert SVG path commands to THREE.js Shape
      pathData.commands.forEach((cmd) => {
        switch (cmd.type) {
          case SVGPathData.MOVE_TO:
            shape.moveTo(cmd.x, cmd.y);
            break;
          case SVGPathData.LINE_TO:
            shape.lineTo(cmd.x, cmd.y);
            break;
          case SVGPathData.CURVE_TO:
            shape.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
            break;
          case SVGPathData.QUAD_TO:
            shape.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
            break;
          case SVGPathData.ARC:
            shape.absarc(cmd.x, cmd.y, cmd.rX, 0, Math.PI * 2);
            break;
          case SVGPathData.CLOSE_PATH:
            shape.closePath();
            break;
        }
      });

      // Create geometry with fixed depth
      const geometry = new THREE.ExtrudeGeometry(shape, {
        ...extrudeSettings,
        depth: 3, // Fixed depth for now
      });

      // Get color from SVG path
      const fill = pathElement.getAttribute("fill") || "#000000";
      const color = new THREE.Color(fill);

      // Create material with better visual properties
      const material = new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.2,
        roughness: 0.8,
        side: THREE.DoubleSide,
        flatShading: true,
        transparent: true,
        opacity: parseFloat(pathElement.getAttribute("fill-opacity") || "1.0"),
      });

      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
    }

    // Center and scale the group
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 100 / maxDim;
    group.scale.multiplyScalar(scale);

    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);

    // Add group to scene
    scene.add(group);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 2, 3);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-1, -1, -1);

    scene.add(ambientLight);
    scene.add(directionalLight);
    scene.add(backLight);

    // Export to requested format
    return new Promise((resolve, reject) => {
      switch (format) {
        case "gltf":
        case "glb": {
          const exporter = new GLTFExporter();
          const options = {
            binary: format === "glb",
            trs: true,
            onlyVisible: true,
            truncateDrawRange: true,
            maxTextureSize: 4096,
            animations: [],
            includeCustomExtensions: false,
          };

          exporter.parse(
            scene,
            (result) => {
              if (format === "gltf") {
                resolve(JSON.stringify(result));
              } else {
                resolve(result as ArrayBuffer);
              }
            },
            (error) => reject(error),
            options
          );
          break;
        }

        case "obj": {
          const exporter = new OBJExporter();
          const result = exporter.parse(scene);
          resolve(result);
          break;
        }

        default:
          reject(new Error(`Unsupported 3D format: ${format}`));
      }
    });
  } catch (error) {
    console.error("Error in 3D conversion:", error);
    throw error;
  } finally {
    // Clean up
    dom.window.close();
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const dimensions = getDimensions(searchParams);
    const format = getSymbolFormat(params.sidc);

    const symbol = new ms.Symbol(params.sidc, {
      size: Math.min(dimensions.width, dimensions.height),
      standard: params.standard === "2525" ? "2525" : "APP6",
    });

    const symbolSVG = symbol.asSVG();

    // Handle 3D formats
    if (format === "gltf" || format === "glb" || format === "obj") {
      const model3D = await convertSVGTo3D(symbolSVG, format);

      // Handle binary GLB format
      if (format === "glb" && model3D instanceof ArrayBuffer) {
        return new Response(model3D, {
          headers: {
            "Content-Type": MIME_TYPES[format],
            "Content-Disposition": `attachment; filename="symbol.${format}"`,
          },
        });
      }

      return new Response(model3D as string, {
        headers: {
          "Content-Type": MIME_TYPES[format],
          "Content-Disposition": `attachment; filename="symbol.${format}"`,
        },
      });
    }

    if (format === "svg") {
      return new Response(symbolSVG, {
        headers: { "Content-Type": MIME_TYPES[format] },
      });
    }

    const buffer = await generateImage(symbolSVG, dimensions, format);
    return new Response(buffer, {
      headers: { "Content-Type": MIME_TYPES[format] },
    });
  } catch (error) {
    console.error("Error generating symbol:", error);
    const message =
      error instanceof Error ? error.message : "Error generating symbol";
    return new Response(message, { status: 500 });
  }
}
