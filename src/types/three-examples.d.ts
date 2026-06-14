declare module "three/examples/jsm/loaders/SVGLoader" {
  import { Loader, LoadingManager, Shape, ShapePath } from "three";

  export class SVGLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (data: SVGResult) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    parse(text: string): SVGResult;
    static createShapes(shapePath: SVGResultPath): Shape[];
  }

  export interface SVGResult {
    paths: SVGResultPath[];
    xml: XMLDocument;
  }

  export interface SVGResultPath extends ShapePath {
    color: import("three").Color;
    userData?: {
      style?: {
        fillOpacity?: number;
      };
      opacity?: number;
    };
  }
}

declare module "three/examples/jsm/exporters/GLTFExporter" {
  import { Object3D, Scene } from "three";

  export interface GLTFExporterOptions {
    binary?: boolean;
    trs?: boolean;
    onlyVisible?: boolean;
    truncateDrawRange?: boolean;
    maxTextureSize?: number;
    animations?: any[];
    includeCustomExtensions?: boolean;
  }

  export class GLTFExporter {
    parse(
      input: Object3D | Object3D[] | Scene,
      onCompleted: (gltf: any) => void,
      onError?: (error: any) => void,
      options?: GLTFExporterOptions
    ): void;
  }
}

declare module "three/examples/jsm/exporters/OBJExporter" {
  import { Object3D, Scene } from "three";

  export class OBJExporter {
    parse(object: Object3D | Scene): string;
  }
}

// The no-extension specifier doesn't resolve against @types/three, but the
// ".js" one does. Alias it so GLTFLoader / GLTF are the same types everywhere.
declare module "three/examples/jsm/loaders/GLTFLoader" {
  export * from "three/examples/jsm/loaders/GLTFLoader.js";
}
