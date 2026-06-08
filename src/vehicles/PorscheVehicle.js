import { PlaceholderVehicle } from "./PlaceholderVehicle.js";

export class PorscheVehicle extends PlaceholderVehicle {
  constructor() {
    super({
      id: "porsche",
      name: "PorscheVehicle",
      bodyColor: 0xf8fafc,
      metalness: 0.24
    });

    this.importedModel = null;
    this.loadPromise = null;
  }

  async loadImportedModel() {
    try {
      const { createPorscheModelInstance } = await import("./loaders/loadPorscheModel.js");
      const model = await createPorscheModelInstance();

      if (this.disposed) {
        return null;
      }

      model.visible = false;
      this.importedModel = model;
      this.group.add(model);
      return model;
    } catch (error) {
      console.error("Porsche model failed to load:", error);
      return null;
    }
  }
}
