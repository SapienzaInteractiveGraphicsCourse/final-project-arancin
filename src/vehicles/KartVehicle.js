import { PlaceholderVehicle } from "./PlaceholderVehicle.js";

export class KartVehicle extends PlaceholderVehicle {
  constructor() {
    super({
      id: "kart",
      name: "KartVehicle",
      bodyColor: 0xd6332f,
      metalness: 0.08
    });
  }
}
