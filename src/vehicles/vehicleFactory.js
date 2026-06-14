import { KartVehicle } from "./KartVehicle.js";
import { PorscheVehicle } from "./PorscheVehicle.js";
import { SilviaVehicle } from "./SilviaVehicle.js";

const VEHICLE_FACTORIES = {
  kart: () => new KartVehicle(),
  porsche: () => new PorscheVehicle(),
  silvia: () => new SilviaVehicle()
};

export function createVehicleById(vehicleId) {
  const factory = VEHICLE_FACTORIES[vehicleId] ?? VEHICLE_FACTORIES.kart;
  return factory();
}
