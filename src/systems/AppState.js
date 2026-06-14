import { DEFAULT_RACE_SETUP } from "../config/raceOptions.js";

const APP_PHASES = {
  SETUP: "setup",
  LOADING: "loading",
  PREVIEW: "preview",
  RACE: "race"
};

export class AppState extends EventTarget {
  constructor(initialSetup = DEFAULT_RACE_SETUP) {
    super();
    this.phase = APP_PHASES.SETUP;
    this.setup = { ...initialSetup };
  }

  getSnapshot() {
    return {
      phase: this.phase,
      setup: { ...this.setup }
    };
  }

  setSetup(setup) {
    this.setup = {
      ...this.setup,
      ...setup
    };
    this.emitChange();
  }

  setPhase(phase) {
    if (!Object.values(APP_PHASES).includes(phase)) {
      throw new Error(`Unknown app phase: ${phase}`);
    }

    this.phase = phase;
    this.emitChange();
  }

  startLoading(setup) {
    this.setSetup(setup);
    this.phase = APP_PHASES.LOADING;
    this.emitChange();
  }

  startPreview() {
    this.setPhase(APP_PHASES.PREVIEW);
  }

  startSetup() {
    this.setPhase(APP_PHASES.SETUP);
  }

  emitChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: this.getSnapshot()
      })
    );
  }
}
