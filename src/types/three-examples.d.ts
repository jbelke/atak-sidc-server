declare module "three/examples/jsm/loaders/SVGLoader" {
  import { Loader, LoadingManager, ShapePath } from "three";

  export class SVGLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (data: SVGResult) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    parse(text: string): SVGResult;
  }

  export interface SVGResult {
    paths: SVGResultPath[];
    xml: XMLDocument;
  }

  export interface SVGResultPath extends ShapePath {
    color: number;
    userData?: {
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
