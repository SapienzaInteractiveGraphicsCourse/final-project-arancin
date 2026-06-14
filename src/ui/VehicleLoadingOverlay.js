const VEHICLE_DISPLAY_NAMES = {
  kart: "Kart",
  porsche: "Porsche",
  silvia: "Silvia"
};

export function createVehicleLoadingOverlay(setup = {}) {
  const element = document.createElement("section");
  element.className = "vehicle-loading-overlay";
  element.setAttribute("aria-label", "Loading race vehicle");
  element.setAttribute("aria-live", "polite");

  const vehicleName = VEHICLE_DISPLAY_NAMES[setup.vehicleId] ?? "Vehicle";
  const trackName = setup.trackName ?? "";

  element.innerHTML = `
    <div class="vehicle-loading-panel">
      <span class="vehicle-loading-eyebrow">Preparing Race</span>
      <strong>${vehicleName}</strong>
      <div class="vehicle-loading-bar" aria-hidden="true">
        <span></span>
      </div>
      ${trackName ? `<small>${trackName}</small>` : ""}
    </div>
  `;

  return {
    element,
    remove() {
      element.remove();
    }
  };
}
