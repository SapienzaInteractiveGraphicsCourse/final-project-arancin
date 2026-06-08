import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PORSCHE_MODEL_URL = new URL(
  "../../assets/models/vehicles/porsche-cayman-gt4/source/porsche_cayman_gt4+.glb",
  import.meta.url
).href;

let porscheTemplatePromise = null;

export async function loadPorscheModelTemplate() {
  if (!porscheTemplatePromise) {
    const loader = new GLTFLoader();
    porscheTemplatePromise = loader.loadAsync(PORSCHE_MODEL_URL);
  }

  return porscheTemplatePromise;
}

export async function createPorscheModelInstance() {
  const gltf = await loadPorscheModelTemplate();
  const model = gltf.scene.clone(true);
  model.name = "PorscheImportedModel";

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
    }
  });

  return model;
}
