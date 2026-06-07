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

