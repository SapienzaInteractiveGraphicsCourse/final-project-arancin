import { VEHICLE_COLOR_OPTIONS } from "../config/raceOptions.js";

export function createPreRaceColorPicker({ selectedColor, onSelect, onConfirm }) {
  const element = document.createElement("section");
  element.className = "pre-race-color-picker";
  element.setAttribute("aria-label", "Choose vehicle color");

  const colorButtons = VEHICLE_COLOR_OPTIONS.map((option) => {
    const button = document.createElement("button");
    button.className = "pre-race-color-option";
    button.type = "button";
    button.dataset.color = option.value;
    button.style.setProperty("--vehicle-color", option.value);
    button.setAttribute("aria-label", option.name);
    button.setAttribute("aria-pressed", String(option.value === selectedColor));
    button.innerHTML = `
      <span class="pre-race-color-swatch" aria-hidden="true"></span>
      <strong>${option.name}</strong>
    `;

    button.addEventListener("click", () => {
      selectedColor = option.value;
      colorButtons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item.dataset.color === selectedColor));
      });
      onSelect?.(selectedColor);
    });

    return button;
  });

  const options = document.createElement("div");
  options.className = "pre-race-color-options";
  colorButtons.forEach((button) => options.appendChild(button));

  const confirmButton = document.createElement("button");
  confirmButton.className = "pre-race-start-button";
  confirmButton.type = "button";
  confirmButton.textContent = "Start Race";
  confirmButton.addEventListener("click", () => {
    onConfirm?.(selectedColor);
  });

  element.innerHTML = `
    <div class="pre-race-color-copy">
      <span>Vehicle Color</span>
      <strong>Choose your livery</strong>
    </div>
  `;
  element.appendChild(options);
  element.appendChild(confirmButton);

  return {
    element,
    hide: () => {
      element.hidden = true;
    }
  };
}
