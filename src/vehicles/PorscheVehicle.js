import { PlaceholderVehicle } from "./PlaceholderVehicle.js";

export class PorscheVehicle extends PlaceholderVehicle {
  constructor() {
    super({
      id: "porsche",
      name: "PorscheVehicle",
      bodyColor: 0xf8fafc,
      metalness: 0.24
    });
  }
}
