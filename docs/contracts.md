# Shared Contracts

Contratti condivisi tra i branch feature. Prima di cambiare queste API, aggiornare questa documentazione e avvisare il gruppo.

## App State

File: `src/systems/AppState.js`

Snapshot previsto:

```js
{
  phase: "setup" | "loading" | "preview" | "race",
  setup: {
    trackId: "vegas" | "beach" | "monaco",
    vehicleId: "kart" | "porsche" | "silvia",
    raceMode: "race" | "time-trial"
  }
}
```

Uso previsto:

- la GUI aggiorna `setup`;
- `main.js` cambia fase durante setup/loading/preview;
- i sistemi futuri possono leggere `setup` per creare pista, veicolo e modalita corretta.

## Input Manager

File: `src/systems/InputManager.js`

Firma:

```js
const input = new InputManager(window);
```

Contratto:

```js
input.getHeldState() -> {
  accelerate,
  brake,
  steerLeft,
  steerRight,
  handbrake
}

input.consumeActions() -> {
  camera,
  lights,
  restart,
  pause
}

input.dispose()
```

Tasti tenuti:

- `W` / `ArrowUp`: accelerazione;
- `S` / `ArrowDown`: freno/retromarcia;
- `A` / `ArrowLeft`: sterzo sinistra;
- `D` / `ArrowRight`: sterzo destra;
- `Space`: handbrake.

Azioni one-shot:

- `C`: cambio camera;
- `L`: luci;
- `R`: restart.
- `Escape`: pausa/menu runtime.

Regole:

- `getHeldState()` non consuma input;
- `consumeActions()` consuma e svuota solo le azioni one-shot;
- i tasti gestiti devono bloccare lo scroll pagina;
- `dispose()` deve rimuovere i listener e puo essere chiamato piu volte.

## Arcade Vehicle Controller

File: `src/systems/ArcadeVehicleController.js`

Firma:

```js
const controller = new ArcadeVehicleController(vehicle.performance, track.spawn);
```

Contratto:

```js
controller.reset(spawn)
controller.setPerformance(performance)
controller.update(deltaTime, inputState, environmentState) -> VehicleState
controller.getState() -> VehicleState
controller.dispose()
```

`performance` previsto:

```js
{
  maxForwardSpeed,
  maxReverseSpeed,
  acceleration,
  brakeAcceleration,
  rollingFriction,
  idleFriction,
  handbrakeFriction,
  turnRate,
  steeringReturn,
  steeringResponsiveness
}
```

Campi mancanti devono avere default interni al controller.

`VehicleState`:

```js
{
  position,            // THREE.Vector3 clone
  heading,             // radians
  speed,
  steering,
  distanceThisFrame,
  speedRatio,
  surfaceType,
  surfaceGrip,
  boostTimer,
  boostActive,
  collided
}
```

`EnvironmentState`:

```js
{
  surfaceType: "asphalt" | "grass" | "sand",
  surfaceGrip,
  speedLimitMultiplier,
  boostFactor,
  collided
}
```

Regole:

- il controller gestisce solo fisica arcade del player;
- non deve conoscere direttamente mesh, DOM, HUD o AI;
- `update()` deve restituire uno stato adatto a `vehicle.setTransform()` e `vehicle.update()`;
- `distanceThisFrame` serve all'animazione ruote;
- `surfaceGrip`, `boostFactor` e collisioni reali verranno forniti da sistemi pista/collisione futuri;
- `reset(spawn)` deve riportare posizione, heading, velocita, sterzo e stato temporaneo allo spawn.

## Track Factory

File: `src/tracks/trackFactory.js`

Firma:

```js
createTrackById(trackId) -> Track
```

Contratto `Track`:

```js
{
  group,       // THREE.Group da aggiungere alla scena
  spawn,       // { position: THREE.Vector3, heading: number }
  trackInfo,   // dati logici pista
  dispose()    // libera geometrie, materiali, texture
}
```

`trackInfo` dovra evolvere verso:

```js
{
  id,
  name,
  spawn,
  centerline,
  checkpoints,
  barrierColliders,
  minimapBounds,
  lightingMode,
  skyboxTheme,
  particleProfile
}
```

Regole:

- non cambiare la firma di `createTrackById`;
- mantenere `group`, `spawn`, `trackInfo`, `dispose`;
- mettere dati pista in moduli separati quando le piste reali saranno implementate;
- evitare piste extra finche `vegas`, `beach`, `monaco` non sono complete.

## Race Manager

File previsto: `src/systems/RaceManager.js`

Firma prevista:

```js
const raceManager = new RaceManager({
  mode,
  totalLaps,
  countdownSeconds
});
```

Contratto previsto:

```js
raceManager.startCountdown()
raceManager.startRace()
raceManager.update(deltaTime, playerState, trackInfo)
raceManager.reset()
raceManager.getState()
```

Fasi previste:

```js
"idle" | "countdown" | "running" | "finished"
```

Modalita supportate:

- `race`: gara contro AI, giri multipli, classifica semplice;
- `time-trial`: solo player, giro veloce, best lap locale.

Stato previsto:

```js
{
  phase,
  mode,
  totalLaps,
  currentLap,
  currentCheckpoint,
  checkpointCount,
  totalTime,
  lapTime,
  bestLapTime,
  position,
  participantCount,
  aiEnabled,
  opponentCount,
  countdown,
  finished
}
```

Checkpoint previsto:

```js
{
  id,
  position,
  radius,
  order,
  isStartFinish
}
```

I checkpoint vengono letti in ordine crescente di `order`. Checkpoint senza `position.x`, `position.z` o `order` numerico vengono ignorati.

Regole:

- `RaceManager` non deve dipendere direttamente da mesh o DOM;
- deve funzionare anche con `trackInfo.checkpoints = []`;
- `race` abilita logica futura per AI;
- in `race`, `aiEnabled` indica che la scena puo creare un opponent quando centerline e veicoli finali sono disponibili;
- `time-trial` non deve richiedere AI;
- record/best lap possono usare localStorage quando i checkpoint reali saranno disponibili.

## Checkpoint Utils

File: `src/systems/checkpointUtils.js`

Contratto:

```js
getOrderedCheckpoints(trackInfo) -> Checkpoint[]
isInsideCheckpoint(position, checkpoint) -> boolean
isValidCheckpoint(checkpoint) -> boolean
```

Regole:

- `getOrderedCheckpoints()` non deve mutare `trackInfo.checkpoints`;
- i checkpoint validi devono avere `position.x`, `position.z` e `order` numerici;
- `radius` e opzionale, ma se presente deve essere positivo.

## Race Records

File: `src/systems/raceRecords.js`

Contratto:

```js
getRaceRecordKey({ trackId, vehicleId, mode }) -> string
readBestLapTime(storage, key) -> number | null
writeBestLapTime(storage, key, lapTime)
```

Chiave prevista:

```text
trackId:vehicleId:mode
```

## Vehicle Factory

File: `src/vehicles/vehicleFactory.js`

Firma:

```js
createVehicleById(vehicleId) -> Vehicle
```

Contratto `Vehicle`:

```js
{
  group,          // THREE.Group da aggiungere alla scena
  performance,    // dati fisici del veicolo
  setTransform(position, heading),
  update(deltaTime, state),
  setBodyColor(color),
  setHeadlights(enabled),
  toggleHeadlights(),
  dispose()
}
```

`performance` deve mantenere velocita massime ordinate:

```text
Porsche > Silvia > Kart
```

Regole:

- non esporre Formula 1 come veicolo selezionabile;
- il kart deve essere procedurale;
- Porsche e Silvia possono usare asset importati, ma con cache loader;
- non importare animazioni esterne;
- ruote e fari devono essere animati/gestiti in JavaScript.

## Scene Preview

File: `src/scene/startScenePreview.js`

La preview deve usare solo factory:

```js
const track = createTrackById(setup.trackId);
const vehicle = createVehicleById(setup.vehicleId);
```

Non creare direttamente piste o veicoli dentro la preview, salvo placeholder temporanei dentro le factory.

## Branch Responsibilities

- `feature/procedural-kart`: evolve `src/vehicles/vehicleFactory.js` e aggiunge classi veicolo.
- `feature/vehicle-loaders`: aggiunge loader/cache per Porsche e Silvia.
- `feature/tracks`: evolve `src/tracks/trackFactory.js` e aggiunge dati/generatori piste.
- `feature/race-systems`: usa `trackInfo`, `vehicle.performance` e `AppState`.
- `feature/hud-minimap`: usa `AppState`, `trackInfo.centerline`, `trackInfo.minimapBounds`.
