import * as THREE from "three";

/**
 * Replace PBR/glTF materials with unlit MeshBasicMaterial so APP-6 fills match
 * the 2D SVG on the map (no lighting washout or metallic darkening).
 */
export function applyFlatSymbolMaterials(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const mesh = object as THREE.Mesh;
    const source = mesh.material;

    const sources = Array.isArray(source) ? source : [source];
    const basicMaterials = sources.map((mat) => {
      const color = new THREE.Color(1, 1, 1);
      let opacity = 1;
      let transparent = false;

      if (mat instanceof THREE.Material) {
        transparent = mat.transparent;
        opacity = mat.opacity;

        if ("color" in mat && mat.color instanceof THREE.Color) {
          color.copy(mat.color);
        }
      }

      return new THREE.MeshBasicMaterial({
        color,
        transparent,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
      });
    });

    mesh.material =
      basicMaterials.length === 1 ? basicMaterials[0] : basicMaterials;
  });
}

/**
 * Shift model so its bottom rests on the local ground plane (z = 0).
 */
export function groundSymbolModel(root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.z)) {
    return;
  }
  root.position.z -= box.min.z;
}
