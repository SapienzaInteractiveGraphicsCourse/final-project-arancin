import { PlaceholderVehicle } from "./PlaceholderVehicle.js";

export class SilviaVehicle extends PlaceholderVehicle {
  constructor() {
    super({
      id: "silvia",
      name: "SilviaVehicle",
      bodyColor: 0x2f74d6,
      metalness: 0.2
    });
  }
}
