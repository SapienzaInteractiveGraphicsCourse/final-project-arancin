export const VEHICLE_PERFORMANCE = {
  porsche: {
    maxForwardSpeed: 80,
    maxReverseSpeed: 9,
    acceleration: 70,
    brakeAcceleration: 38,
    rollingFriction: 1.5,
    idleFriction: 2.5,
    handbrakeFriction: 8,
    turnRate: 2.15,
    steeringReturn: 8,
    steeringResponsiveness: 9.5
  },
  silvia: {
    maxForwardSpeed: 65,
    maxReverseSpeed: 8,
    acceleration: 52,
    brakeAcceleration: 20,
    rollingFriction: 1.6,
    idleFriction: 2.6,
    handbrakeFriction: 3.4,
    turnRate: 2.75,
    steeringReturn: 8.8,
    steeringResponsiveness: 10
  },
  kart: {
    maxForwardSpeed: 32,
    maxReverseSpeed: 8,
    acceleration: 30,
    brakeAcceleration: 34,
    rollingFriction: 1.8,
    idleFriction: 2.8,
    handbrakeFriction: 8,
    turnRate: 1.95,
    steeringReturn: 8,
    steeringResponsiveness: 9
  }
};

export function getVehiclePerformance(vehicleId) {
  return {
    ...(VEHICLE_PERFORMANCE[vehicleId] ?? VEHICLE_PERFORMANCE.kart)
  };
}
