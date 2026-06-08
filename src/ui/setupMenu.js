import {
  DEFAULT_RACE_SETUP,
  RACE_MODE_OPTIONS,
  TRACK_OPTIONS,
  VEHICLE_OPTIONS
} from "../config/raceOptions.js";

function createOptionButton(groupName, option, selectedId) {
  const button = document.createElement("button");
  button.className = "setup-option";
  button.type = "button";
  button.dataset.group = groupName;
  button.dataset.value = option.id;
  button.setAttribute("aria-pressed", String(option.id === selectedId));

  button.innerHTML = `
    <strong>${option.name}</strong>
    <span>${option.description}</span>
  `;

  return button;
}

function createOptionGroup(title, groupName, options, selectedId) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "setup-group";

  const legend = document.createElement("legend");
  legend.textContent = title;
  fieldset.appendChild(legend);

  const list = document.createElement("div");
  list.className = "setup-options";

  options.forEach((option) => {
    list.appendChild(createOptionButton(groupName, option, selectedId));
  });

  fieldset.appendChild(list);
  return fieldset;
}

function updatePressedState(menu, groupName, selectedValue) {
  const buttons = menu.querySelectorAll(`[data-group="${groupName}"]`);

  buttons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.value === selectedValue));
  });
}

export function createSetupMenu({ onStart }) {
  const setup = { ...DEFAULT_RACE_SETUP };
  const menu = document.createElement("section");
  menu.className = "setup-menu";
  menu.setAttribute("aria-label", "Race setup");

  const panel = document.createElement("div");
  panel.className = "setup-panel";
  panel.innerHTML = `
    <p class="setup-eyebrow">Interactive Graphics Project</p>
    <h1>Kart Racing Simulator</h1>
  `;

  panel.appendChild(createOptionGroup("Track", "trackId", TRACK_OPTIONS, setup.trackId));
  panel.appendChild(createOptionGroup("Vehicle", "vehicleId", VEHICLE_OPTIONS, setup.vehicleId));
  panel.appendChild(createOptionGroup("Mode", "raceMode", RACE_MODE_OPTIONS, setup.raceMode));

  const startButton = document.createElement("button");
  startButton.className = "start-button";
  startButton.type = "button";
  startButton.textContent = "Start";
  panel.appendChild(startButton);

  menu.appendChild(panel);

  menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group]");

    if (!button) {
      return;
    }

    setup[button.dataset.group] = button.dataset.value;
    updatePressedState(menu, button.dataset.group, button.dataset.value);
  });

  startButton.addEventListener("click", () => {
    menu.hidden = true;
    onStart?.({ ...setup });
  });

  return {
    element: menu,
    getSetup: () => ({ ...setup }),
    show: () => {
      menu.hidden = false;
    },
    hide: () => {
      menu.hidden = true;
    }
  };
}
