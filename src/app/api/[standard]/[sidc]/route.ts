import ms from "milsymbol";
import { NextRequest } from "next/server";
import sharp from "sharp";
import {
  convertSVGTo3D,
  parseSymbol3DOptions,
  type Symbol3DFormat,
} from "@/lib/symbol3d";

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
  | "obj"
  | "mesh";

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
  mesh: "application/json",
} as const;

function getDimensions(searchParams: URLSearchParams): ImageDimensions {
  const size = parseInt(searchParams.get("size") || String(DEFAULT_SIZE), 10);
  const width = parseInt(searchParams.get("width") || String(size), 10);
  const height = parseInt(searchParams.get("height") || String(width), 10);
  return { width, height };
}

function getSymbolFormat(sidcParam: string): ImageFormat {
  const format = sidcParam.split(".").pop()?.toLowerCase() as ImageFormat;
  if (!Object.keys(MIME_TYPES).includes(format)) {
    throw new Error("Unsupported format");
  }
  return format;
}

function extractSidcCode(sidcParam: string): string {
  const lastDot = sidcParam.lastIndexOf(".");
  if (lastDot === -1) {
    return sidcParam;
  }

  const extension = sidcParam.slice(lastDot + 1).toLowerCase();
  if (Object.keys(MIME_TYPES).includes(extension)) {
    return sidcParam.slice(0, lastDot);
  }

  return sidcParam;
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
    default:
      return image
        .png({
          compressionLevel: 9,
          palette: false,
        })
        .toBuffer();
  }
}

function is3DFormat(format: ImageFormat): format is Symbol3DFormat {
  return format === "gltf" || format === "glb" || format === "obj" || format === "mesh";
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const dimensions = getDimensions(searchParams);
    const format = getSymbolFormat(params.sidc);
    const sidcCode = extractSidcCode(params.sidc);
    const standard = params.standard === "2525" ? "2525" : "APP6";

    const symbol = new ms.Symbol(sidcCode, {
      size: Math.min(dimensions.width, dimensions.height),
      standard,
    });

    const symbolSVG = symbol.asSVG();

    if (is3DFormat(format)) {
      const symbol3DOptions = parseSymbol3DOptions(searchParams, {
        sidc: sidcCode,
        standard,
      });

      // Bake the crisp 2D icon onto the puck faces so the GLB is self-contained
      // for external glTF clients (ATAK, Cesium). OPT-IN via ?bakeIcon=1 — the
      // live gallery textures the faces itself, so a baked plane there would just
      // get repainted flat by its material pass. `mesh`/`obj` stay geometry-only.
      const bakeIcon = searchParams.get("bakeIcon");
      if (
        (format === "glb" || format === "gltf") &&
        (bakeIcon === "1" || bakeIcon === "true")
      ) {
        const iconPng = await generateImage(symbolSVG, { width: 256, height: 256 }, "png");
        symbol3DOptions.iconTexturePng = iconPng.toString("base64");
      }

      const model3D = await convertSVGTo3D(symbolSVG, format, symbol3DOptions);

      if (format === "glb" && model3D instanceof ArrayBuffer) {
        return new Response(model3D, {
          headers: {
            "Content-Type": MIME_TYPES[format],
            "Content-Disposition": `attachment; filename="symbol-${sidcCode}.${format}"`,
          },
        });
      }

      return new Response(model3D as string, {
        headers: {
          "Content-Type": MIME_TYPES[format],
          "Content-Disposition": `attachment; filename="symbol-${sidcCode}.${format}"`,
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
