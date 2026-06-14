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
    raceMode: "race" | "time-trial",
    bodyColor: "#d6332f" // colore carrozzeria scelto nel passaggio pre-gara
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
- `R`: restart;
- `Escape`: pausa/menu runtime.
- `F1`: toggle diagnostico minimap;
- `F2`: toggle diagnostico ombre;
- `F3`: toggle diagnostico props decorativi;
- `F4`: toggle diagnostico pannello renderer info.

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
- `surfaceGrip` influenza trazione e sterzata;
- `boostFactor` e collisioni reali vengono forniti da sistemi pista/collisione;
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

`checkpoints` mantiene l'ordine logico di gara tramite `order`, non tramite il valore numerico di `progress`. Il checkpoint con `order: 0` / `isStartFinish: true` e' la partenza-arrivo e puo trovarsi su qualunque `progress` della spline, cosi la linea di partenza puo essere posizionata a meta rettilineo.

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
  lapTimes,
  bestLapTime,
  position,
  participantCount,
  aiEnabled,
  opponentCount,
  countdown,
  finished
}
```

`lapTimes` contiene i giri completati:

```js
[
  {
    lap,
    time
  }
]
```

La classifica non viene calcolata automaticamente da `RaceManager.update()`: la scena confronta il progresso del player con gli opponent e aggiorna `position` tramite:

```js
raceManager.setPlayerPosition(position, participantCount)
```

Checkpoint previsto:

```js
{
  id,
  position,
  radius,        // opzionale se esiste size
  order,         // opzionale se esiste id numerico
  isStartFinish
}
```

Formato checkpoint generato dalle piste spline:

```js
{
  id,
  name,
  position,
  rotationY,
  size,
  tangent
}
```

I checkpoint vengono normalizzati prima dell'uso:

- `order` usa `checkpoint.order`, oppure `checkpoint.id`;
- `radius` usa `checkpoint.radius`, oppure viene derivato da `checkpoint.size`;
- `isStartFinish` usa `checkpoint.isStartFinish`, oppure `checkpoint.id === 0`.

Checkpoint senza `position.x`, `position.z` o un ordine numerico vengono ignorati.

Regole:

- `RaceManager` non deve dipendere direttamente da mesh o DOM;
- deve funzionare anche con `trackInfo.checkpoints = []`;
- un giro completo si chiude sulla start/finish line dopo aver attraversato i checkpoint intermedi;
- la start/finish line resta nel conteggio totale dei checkpoint della pista;
- alla partenza la start/finish line non deve essere consumata come primo checkpoint appena il veicolo passa sul traguardo;
- l'HUD puo mostrare il checkpoint come rapporto dinamico `current/total`, usando `checkpointCount` dalla pista;
- `race` abilita logica futura per AI;
- in `race`, `aiEnabled` indica che la scena puo creare un opponent quando centerline e veicoli finali sono disponibili;
- `time-trial` non deve richiedere AI;
- record, best lap e storico lap usano localStorage quando i checkpoint reali sono presenti.

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
- i checkpoint validi devono avere `position.x`, `position.z` e `order`/`id` numerici;
- `radius` e opzionale se e presente `size`.

## Track Interaction System

File: `src/systems/TrackInteractionSystem.js`

Firma:

```js
const trackInteraction = new TrackInteractionSystem();
```

Contratto:

```js
trackInteraction.update(playerState, trackInfo, options) -> EnvironmentState
trackInteraction.reset()
```

`EnvironmentState` prodotto:

```js
{
  surfaceType,
  surfaceGrip,
  speedLimitMultiplier,
  boostFactor,
  collided,
  correction,
  impact
}
```

Regole:

- legge `trackInfo.centerline`, `trackInfo.roadHalfWidth`, `trackInfo.boostPads` e `trackInfo.barrierColliders`;
- restituisce default asfaltati quando i dati pista mancano;
- usa distanza da `centerline` e `roadHalfWidth` per distinguere asphalt/off-road;
- fuori strada riduce `surfaceGrip` e `speedLimitMultiplier`;
- usa `trackInfo.boostPads` per applicare un boost temporaneo con cooldown breve;
- usa `trackInfo.barrierColliders` per produrre `collided`, `correction` e `impact`;
- puo ricevere `options.opponentStates` per collisione player-opponent semplificata;
- un impatto `opponent` applica separazione minima al player e rallenta temporaneamente l'AI, ma non implica avoidance intelligente;
- non deve conoscere mesh, DOM, HUD o classi veicolo;
- non deve modificare direttamente la mesh del player;
- la scena usa l'output per aggiornare `ArcadeVehicleController`;
- la risposta fisica a una barriera deve essere continua ogni frame di intersezione;
- eventuali cooldown servono solo per feedback futuri, non per bloccare la correzione fisica.

## Race Records

File: `src/systems/raceRecords.js`

Contratto:

```js
getRaceRecordKey({ trackId, vehicleId, mode }) -> string
getRaceLapRecordsKey(recordKey) -> string
readBestLapTime(storage, key) -> number | null
writeBestLapTime(storage, key, lapTime)
readLapRecords(storage, key) -> LapRecord[]
appendLapRecord(storage, key, lapRecord) -> LapRecord[]
ensureBestLapInRecords(storage, key, bestLapTime) -> LapRecord[]
```

Chiave prevista:

```text
trackId:vehicleId:mode
```

Chiave storico lap:

```text
trackId:vehicleId:mode:laps
```

`LapRecord`:

```js
{
  lap,
  time,
  completedAt,
  migrated
}
```

`ensureBestLapInRecords()` serve a migrare i best lap salvati prima dello storico lap persistente.

## Ghost Lap Records

File: `src/systems/ghostLapRecords.js`

Contratto:

```js
getRaceGhostKey(recordKey) -> string
readGhostLap(storage, key) -> GhostLap | null
writeGhostLap(storage, key, ghostLap) -> GhostLap | null
createGhostLapRecorder({ enabled, sampleRate }) -> GhostLapRecorder
sampleGhostLap(ghostLap, lapTime) -> GhostSample | null
```

Chiave ghost:

```text
trackId:vehicleId:mode:ghost
```

`GhostLap`:

```js
{
  version,
  trackId,
  vehicleId,
  lapTime,
  sampleRate,
  createdAt,
  samples: [{ t, x, y, z, heading, speed }]
}
```

Regole:

- usato solo in `time-trial`;
- non entra in collisioni, AI, checkpoint o posizione gara;
- salva solo campioni numerici serializzabili in localStorage;
- ignora dati corrotti o versioni non compatibili;
- il ghost visuale interpola i campioni sul `lapTime` corrente.

## Wrong Way Detector

File: `src/systems/WrongWayDetector.js`

Firma:

```js
const detector = new WrongWayDetector();
```

Contratto:

```js
detector.update(deltaTime, vehicleState, trackInfo) -> {
  warning,
  wrongWayTime,
  progress,
  headingDot
}

detector.reset()
detector.getState()
```

Regole:

- usa `trackInfo.centerline`;
- calcola il progresso piu vicino al player;
- confronta heading veicolo e heading pista con prodotto scalare;
- mostra warning solo dopo una soglia temporale;
- non segnala contromano a veicolo quasi fermo.

## AI Vehicle Controller

File: `src/systems/AiVehicleController.js`

Firma:

```js
const aiController = new AiVehicleController(vehicle.performance, track.trackInfo);
```

Contratto:

```js
aiController.reset(trackInfo)
aiController.update(deltaTime, trackInfo) -> AiVehicleState
aiController.getState() -> AiVehicleState
```

`AiVehicleState`:

```js
{
  position,
  heading,
  progress,
  lap,
  speed
}
```

Regole:

- usa `trackInfo.centerline`;
- per ora non gestisce mesh;
- usa la performance del veicolo selezionato per derivare velocita base;
- serve come base per opponent visibile e classifica player vs AI.
- la scena puo usare `createVehicleById(setup.vehicleId)` per renderizzare l'opponent con lo stesso veicolo del player.
- non deve viaggiare sempre alla velocita massima: accelera gradualmente e riduce il target speed in base alla curva davanti.
- `progress` resta sulla centerline, mentre `position` puo applicare un offset laterale per la mesh dell'opponent.

## Vehicle Factory

File: `src/vehicles/vehicleFactory.js`

Classe base: `src/vehicles/BaseVehicle.js`

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

I dati performance condivisi sono definiti in `src/config/vehiclePerformance.js`, separati dal controller fisico e dalla factory visuale. I valori di base sono:

```text
Porsche maxForwardSpeed 44
Silvia maxForwardSpeed 39
Kart maxForwardSpeed 32
```

Regole:

- non esporre Formula 1 come veicolo selezionabile;
- i veicoli concreti devono estendere o rispettare `BaseVehicle`;
- il kart deve essere procedurale;
- i veicoli con ruote animabili possono esporre `wheelRollGroups`, `frontSteeringPivots` e `wheelRadius`;
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

## Race HUD

File: `src/ui/RaceHud.js`

Firma:

```js
createRaceHud() -> {
  element,
  update({ raceState, vehicleState, wrongWayState, trackId, trackName, performanceState }),
  remove()
}
```

Campi DOM stabili:

```text
speed
lap
totalTime
checkpoint
track
surface
position
gap
fps
```

Regole:

- il componente crea il DOM una sola volta;
- `update()` aggiorna solo i valori testuali dei campi;
- deve tollerare checkpoint mancanti e dati AI/gap non ancora disponibili;
- `performanceState.fps` e opzionale e serve solo come diagnostica di playtest;
- il warning contromano e gli stati di partenza devono usare overlay dedicati, non chip persistenti nell'HUD.

## Minimap System

File: `src/systems/MinimapSystem.js`

Firma:

```js
const minimap = new MinimapSystem(canvas);
minimap.setTrack(trackInfo);
minimap.resize();
minimap.update({ playerState, aiState });
```

Contratto:

- usa `trackInfo.centerline` per disegnare il percorso;
- usa `trackInfo.minimapBounds` per calcolare la scala;
- ruota la mappa in base a `playerState.heading`;
- usa `playerState.position` come centro quando disponibile;
- gestisce `devicePixelRatio` in `resize()`;
- puo ricevere `aiState` per mostrare il marker AI quando disponibile;
- disegna il marker AI solo se `aiState.position` esiste e `aiState.visible === true` oppure `aiState.hasVisibleModel === true`;
- mostra marker start/finish e checkpoint usando `trackInfo.checkpoints`;
- deve mostrare un fallback leggibile se centerline o bounds mancano.
const cameraController = new CameraController(camera, options)
```

## Camera Controller

File: `src/systems/CameraController.js`

Contratto:

```js
cameraController.update(deltaTime, vehicleState, trackInfo, context)
cameraController.nextMode()
cameraController.setMode(mode)
cameraController.applyShake(intensity)
cameraController.resize(width, height)
cameraController.getState()
cameraController.dispose()
```

Modalita supportate ora:

```js
"follow" | "top" | "hood" | "orbit"
```

Regole:

- gestisce posizione e lookAt della camera;
- non deve conoscere DOM, HUD, RaceManager o classi veicolo;
- usa `vehicleState.position` e `vehicleState.heading` come input principale;
- la scena resta responsabile di chiamare `update()`, `nextMode()` e `resize()`;
- camera shake e solo feedback visivo e non deve influenzare fisica/input.
- la modalita `top` non applica camera shake per restare leggibile in debug.

## Audio Manager

File: `src/systems/AudioManager.js`

Firma:

```js
const audioManager = new AudioManager({ masterVolume, vehicleId, trackId });
audioManager.enable() -> Promise<boolean>
audioManager.disable()
audioManager.toggle() -> Promise<boolean>
audioManager.setMasterVolume(volume)
audioManager.setMuted(muted)
audioManager.setGameVolume(volume)
audioManager.setAmbienceVolume(volume)
audioManager.getSettings()
audioManager.update(deltaTime, vehicleState, inputState) -> { enginePop }
audioManager.playUiSelect()
audioManager.playUiConfirm()
audioManager.playCountdown(step)
audioManager.playCheckpoint()
audioManager.playLapComplete({ bestLap })
audioManager.playCollision()
audioManager.playBoost()
audioManager.playFinish()
audioManager.playCrowdCheer()
audioManager.playCrowdDisappointment()
audioManager.dispose()
```

Regole:

- usa Web Audio API;
- usa un motore procedurale morbido per veicolo, con oscillatori, filtro e rumore leggero;
- usa ambience discreta per pista, avviata insieme all'audio dopo gesto utente;
- separa volume game e volume ambience tramite gain dedicati;
- crea o riprende `AudioContext` solo dopo gesto utente;
- mantiene volume master basso di default;
- `update()` puo usare `vehicleState.speed`, `speedRatio` e input tenuti per modulare motore, filtro e volume;
- `update()` puo restituire eventi audio/visivi brevi, per esempio `enginePop`, se un profilo veicolo li supporta;
- i metodi evento devono essere brevi, non invasivi e sicuri se l'audio non e' ancora abilitato;
- `dispose()` deve fermare oscillatori, chiudere il context e poter essere chiamato durante uscita scena.

## Branch Responsibilities

- `feature/procedural-kart`: evolve `src/vehicles/vehicleFactory.js` e aggiunge classi veicolo.
- `feature/vehicle-loaders`: aggiunge loader/cache per Porsche e Silvia.
- `feature/tracks`: evolve `src/tracks/trackFactory.js` e aggiunge dati/generatori piste.
- `feature/race-systems`: usa `trackInfo`, `vehicle.performance` e `AppState`.
- `feature/hud-minimap`: usa `AppState`, `trackInfo.centerline`, `trackInfo.minimapBounds`.
