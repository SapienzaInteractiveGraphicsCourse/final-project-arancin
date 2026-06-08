import { LoadingManager, SRGBColorSpace } from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const SILVIA_MODEL_URL = new URL(
  "../../assets/models/vehicles/nissan-silvia-kouki/source/FINAL_MODEL_VERTEX.fbx",
  import.meta.url
).href;

const SILVIA_TEXTURE_URLS = import.meta.glob(
  "../../assets/models/vehicles/nissan-silvia-kouki/textures/*",
  {
    eager: true,
    import: "default",
    query: "?url"
  }
);

const SILVIA_TEXTURES_BY_NAME = Object.fromEntries(
  Object.entries(SILVIA_TEXTURE_URLS).map(([path, url]) => [
    path.split("/").pop(),
    url
  ])
);

let silviaTemplatePromise = null;

export async function loadSilviaModelTemplate() {
  if (!silviaTemplatePromise) {
    const manager = new LoadingManager();
    manager.setURLModifier(resolveSilviaTextureUrl);

    const loader = new FBXLoader(manager);
    silviaTemplatePromise = loader.loadAsync(SILVIA_MODEL_URL);
  }

  return silviaTemplatePromise;
}

export async function createSilviaModelInstance() {
  const template = await loadSilviaModelTemplate();
  const model = template.clone(true);
  model.name = "SilviaImportedModel";

  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    if (Array.isArray(child.material)) {
      child.material = child.material.map(cloneMaterial);
    } else if (child.material) {
      child.material = cloneMaterial(child.material);
    }
  });

  return model;
}

function cloneMaterial(material) {
  const clonedMaterial = material.clone();

  if (clonedMaterial.map) {
    clonedMaterial.map.colorSpace = SRGBColorSpace;
  }

  return clonedMaterial;
}

function resolveSilviaTextureUrl(url) {
  const textureName = url.split(/[\\/]/).pop();
  return SILVIA_TEXTURES_BY_NAME[textureName] ?? url;
}
