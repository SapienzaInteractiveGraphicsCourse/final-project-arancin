import {
  DEFAULT_RACE_SETUP,
  RACE_MODE_OPTIONS,
  TRACK_OPTIONS,
  VEHICLE_OPTIONS,
  getRaceSetupLabels
} from "../config/raceOptions.js";

const SETUP_STEPS = [
  {
    key: "trackId",
    title: "Choose Track",
    eyebrow: "Step 1 / 3",
    summaryLabel: "Track",
    options: TRACK_OPTIONS
  },
  {
    key: "vehicleId",
    title: "Choose Vehicle",
    eyebrow: "Step 2 / 3",
    summaryLabel: "Vehicle",
    options: VEHICLE_OPTIONS
  },
  {
    key: "raceMode",
    title: "Choose Mode",
    eyebrow: "Step 3 / 3",
    summaryLabel: "Mode",
    options: RACE_MODE_OPTIONS
  }
];

const OPTION_THEMES = {
  vegas: { accent: "#a855f7", second: "#facc15", dark: "#13071f" },
  beach: { accent: "#06b6d4", second: "#facc15", dark: "#06242c" },
  monaco: { accent: "#ef4444", second: "#f8fafc", dark: "#090b10" },
  kart: { accent: "#facc15", second: "#22c55e", dark: "#1f1b08" },
  porsche: { accent: "#f59e0b", second: "#f8fafc", dark: "#1c1206" },
  silvia: { accent: "#38bdf8", second: "#e5e7eb", dark: "#061726" },
  race: { accent: "#ef4444", second: "#facc15", dark: "#1f0808" },
  "time-trial": { accent: "#22d3ee", second: "#a78bfa", dark: "#071923" }
};

export function createSetupMenu({ onStart }) {
  const setup = { ...DEFAULT_RACE_SETUP };
  let currentStepIndex = 0;

  const menu = document.createElement("section");
  menu.className = "setup-menu";
  menu.setAttribute("aria-label", "Race setup");

  const title = document.createElement("h1");
  title.className = "setup-title";
  title.textContent = "Kart Racing Simulator";

  const panel = document.createElement("div");
  panel.className = "setup-panel setup-panel-progressive";

  const header = document.createElement("header");
  header.className = "setup-header";
  header.innerHTML = `
    <p class="setup-eyebrow">Interactive Graphics Project</p>
  `;

  const progress = document.createElement("div");
  progress.className = "setup-progress";

  const stage = document.createElement("div");
  stage.className = "setup-stage";

  const nav = document.createElement("div");
  nav.className = "setup-nav";

  const backButton = document.createElement("button");
  backButton.className = "setup-nav-button setup-nav-button-secondary";
  backButton.type = "button";
  backButton.textContent = "Back";

  const nextButton = document.createElement("button");
  nextButton.className = "setup-nav-button";
  nextButton.type = "button";
  nextButton.textContent = "Next";

  nav.append(backButton, nextButton);
  panel.append(header, progress, stage, nav);
  menu.appendChild(title);
  menu.appendChild(panel);

  function render() {
    const step = SETUP_STEPS[currentStepIndex];
    const selectedId = setup[step.key];
    const selectedOption = step.options.find((option) => option.id === selectedId) ?? step.options[0];

    menu.dataset.setupStep = step.key;
    applyOptionTheme(panel, selectedOption.id);
    renderProgress(progress, setup, currentStepIndex);
    renderStage(stage, step, selectedId);

    backButton.disabled = currentStepIndex === 0;
    nextButton.textContent = currentStepIndex === SETUP_STEPS.length - 1 ? "Start" : "Next";
  }

  stage.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-carousel-action]");

    if (actionButton) {
      moveSelection(Number(actionButton.dataset.carouselAction));
      return;
    }

    const optionButton = event.target.closest("[data-option-id]");

    if (!optionButton) {
      return;
    }

    setup[SETUP_STEPS[currentStepIndex].key] = optionButton.dataset.optionId;
    render();
  });

  backButton.addEventListener("click", () => {
    currentStepIndex = Math.max(0, currentStepIndex - 1);
    render();
  });

  nextButton.addEventListener("click", () => {
    if (currentStepIndex < SETUP_STEPS.length - 1) {
      currentStepIndex += 1;
      render();
      return;
    }

    menu.hidden = true;
    onStart?.({ ...setup });
  });

  function moveSelection(direction) {
    const step = SETUP_STEPS[currentStepIndex];
    const selectedIndex = step.options.findIndex((option) => option.id === setup[step.key]);
    const nextIndex = wrapIndex(selectedIndex + direction, step.options.length);

    setup[step.key] = step.options[nextIndex].id;
    render();
  }

  render();

  return {
    element: menu,
    getSetup: () => ({ ...setup }),
    show: () => {
      menu.hidden = false;
      render();
    },
    hide: () => {
      menu.hidden = true;
    }
  };
}

function renderProgress(container, setup, currentStepIndex) {
  const labels = getRaceSetupLabels(setup);

  container.innerHTML = SETUP_STEPS.map((step, index) => {
    const state = index === currentStepIndex ? "active" : index < currentStepIndex ? "complete" : "pending";
    const value = labels[labelKeyForStep(step.key)];

    return `
      <div class="setup-progress-item" data-state="${state}">
        <span>${step.summaryLabel}</span>
        <strong>${value}</strong>
      </div>
    `;
  }).join("");
}

function renderStage(container, step, selectedId) {
  const selectedIndex = step.options.findIndex((option) => option.id === selectedId);

  container.innerHTML = `
    <div class="setup-step-copy">
      <span>${step.eyebrow}</span>
      <h2>${step.title}</h2>
      <p>${step.options[selectedIndex]?.description ?? ""}</p>
    </div>
    <div class="setup-carousel">
      <button class="setup-carousel-arrow" type="button" data-carousel-action="-1" aria-label="Previous option">‹</button>
      <div class="setup-carousel-track">
        ${step.options.map((option, index) => renderOptionCard(option, getCardPlacement(index, selectedIndex, step.options.length))).join("")}
      </div>
      <button class="setup-carousel-arrow" type="button" data-carousel-action="1" aria-label="Next option">›</button>
    </div>
  `;
}

function renderOptionCard(option, placement) {
  const theme = OPTION_THEMES[option.id] ?? OPTION_THEMES.race;

  return `
    <button
      class="setup-option-card"
      type="button"
      data-option-id="${option.id}"
      data-placement="${placement}"
      style="--option-accent: ${theme.accent}; --option-second: ${theme.second}; --option-dark: ${theme.dark};"
    >
      <span class="setup-option-glint"></span>
      <span class="setup-option-icon" data-icon="${option.id}"></span>
      <strong>${option.name}</strong>
      <span>${option.description}</span>
    </button>
  `;
}

function getCardPlacement(index, selectedIndex, length) {
  if (index === selectedIndex) {
    return "active";
  }

  if (index === wrapIndex(selectedIndex - 1, length)) {
    return "previous";
  }

  if (index === wrapIndex(selectedIndex + 1, length)) {
    return "next";
  }

  return "hidden";
}

function applyOptionTheme(element, optionId) {
  const theme = OPTION_THEMES[optionId] ?? OPTION_THEMES.race;

  element.style.setProperty("--setup-accent", theme.accent);
  element.style.setProperty("--setup-second", theme.second);
  element.style.setProperty("--setup-dark", theme.dark);
}

function labelKeyForStep(stepKey) {
  if (stepKey === "trackId") {
    return "track";
  }

  if (stepKey === "vehicleId") {
    return "vehicle";
  }

  return "mode";
}

function wrapIndex(index, length) {
  return (index + length) % length;
}
