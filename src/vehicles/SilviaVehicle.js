import { PlaceholderVehicle } from "./PlaceholderVehicle.js";

export class SilviaVehicle extends PlaceholderVehicle {
  constructor() {
    super({
      id: "silvia",
      name: "SilviaVehicle",
      bodyColor: 0x2f74d6,
      metalness: 0.2
    });

    this.importedModel = null;
    this.placeholderObjects = [...this.group.children];
    this.loadPromise = null;

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (!this.disposed && !this.importedModel) {
          this.loadPromise = this.loadImportedModel();
        }
      }, 0);
    }
  }

  async loadImportedModel() {
    try {
      const { createSilviaModelInstance } = await import("./loaders/loadSilviaModel.js");
      const model = await createSilviaModelInstance();

      if (this.disposed) {
        return null;
      }

      this.importedModel = model;
      this.group.add(model);
      this.placeholderObjects.forEach((object) => {
        object.visible = false;
      });
      return model;
    } catch (error) {
      console.error("Silvia model failed to load:", error);
      return null;
    }
  }

  update(deltaTime, state = {}) {
    if (!this.importedModel) {
      super.update(deltaTime, state);
      return;
    }

    super.update(deltaTime, state);
  }
}
