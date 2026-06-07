# Physics And Input Plan

Branch: `feature/physics-input`

Obiettivo: implementare input e fisica arcade in modo indipendente da veicoli e piste finali. Il branch deve lavorare contro i contratti placeholder gia presenti nello skeleton.

## Dipendenze

Disponibili ora:

- `AppState` con `setup` e `phase`;
- `createVehicleById(vehicleId)` placeholder;
- `createTrackById(trackId)` placeholder;
- preview scene caricata dopo `Start`;
- `Vehicle` contract con `setTransform()` e `update()`;
- `Track` contract con `spawn` e `trackInfo`.

Non disponibili ancora:

- piste reali con bounds/off-road/barriere;
- veicoli finali con ruote vere;
- HUD completo;
- collisioni con bot;
- checkpoint reali.

Quindi il controller deve accettare dati ambiente placeholder e non dipendere da una pista finale.

## Milestone 1: InputManager

File previsto:

```text
src/systems/InputManager.js
```

Responsabilita:

- registrare `keydown` e `keyup`;
- distinguere tasti tenuti premuti da tasti one-shot;
- bloccare scroll pagina per i tasti di gioco;
- esporre snapshot input stabile per frame.

Tasti tenuti:

- `W` / `ArrowUp`: accelerazione;
- `S` / `ArrowDown`: freno/retromarcia;
- `A` / `ArrowLeft`: sterzo sinistra;
- `D` / `ArrowRight`: sterzo destra;
- `Space`: handbrake.

Tasti one-shot:

- `C`: cambio camera;
- `L`: luci;
- `R`: restart.

Contratto proposto:

```js
const input = new InputManager(window);

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
  restart
}

input.dispose()
```

Note:

- `consumeActions()` deve svuotare solo le azioni one-shot;
- i tasti tenuti devono restare veri finche `keyup` non arriva.

## Milestone 2: ArcadeVehicleController

File previsto:

```text
src/systems/ArcadeVehicleController.js
```

Responsabilita:

- mantenere lo stato fisico del player;
- aggiornare velocita, sterzo, heading e posizione;
- calcolare `distanceThisFrame`;
- accettare performance dal veicolo selezionato;
- accettare dati ambiente placeholder;
- restituire stato adatto a `vehicle.setTransform()` e `vehicle.update()`.

Stato fisico minimo:

```js
{
  position,
  heading,
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

Contratto proposto:

```js
const controller = new ArcadeVehicleController(performance, spawn);

controller.reset(spawn)
controller.setPerformance(performance)
controller.update(deltaTime, inputState, environmentState)
controller.getState()
controller.dispose()
```

`environmentState` placeholder:

```js
{
  surfaceType: "asphalt",
  surfaceGrip: 1,
  speedLimitMultiplier: 1,
  boostFactor: 1,
  collided: false
}
```

Formula base:

```js
speed += acceleration * boostFactor * deltaTime
speed *= Math.exp(-friction * deltaTime)
heading += steering * turnRate * grip * speedRatio * reverseFactor * deltaTime
position.x += Math.sin(heading) * speed * deltaTime
position.z += Math.cos(heading) * speed * deltaTime
```

## Milestone 3: Preview Integration

Obiettivo: rendere guidabile il placeholder senza dipendere da piste reali.

In `startScenePreview.js`:

- creare `InputManager`;
- creare `ArcadeVehicleController` usando `vehicle.performance` e `track.spawn`;
- nel loop:
  - leggere input held;
  - aggiornare controller;
  - applicare `vehicle.setTransform(state.position, state.heading)`;
  - chiamare `vehicle.update(deltaTime, state)`;
  - consumare azioni one-shot.

Per ora:

- `C`, `L`, `R` possono aggiornare solo console/overlay o restare no-op documentati;
- `R` dovrebbe gia poter fare reset allo spawn;
- niente collisioni reali;
- niente off-road reale;
- niente boost pad reale.

## Milestone 4: Contracts Update

Aggiornare `docs/contracts.md` con:

- contratto `InputManager`;
- contratto `ArcadeVehicleController`;
- forma di `VehicleState`;
- forma di `EnvironmentState`.

## Milestone 5: Verification

Aggiornare `scripts/verify-scene.mjs` solo se possiamo testare comportamento stabile senza fragilita.

Test possibili:

- menu -> Start genera canvas;
- premere `W` per alcuni frame cambia posizione/overlay debug se esposto;
- premere `R` resetta posizione se abbiamo un indicatore testabile.

Se non c'e un indicatore DOM stabile, per ora basta `bun run build` e test manuale.

## Fuori Scope Per Questo Branch

- collisioni con barriere;
- checkpoint;
- lap timing;
- AI;
- minimappa;
- tuning finale per Porsche/Silvia/Kart;
- surface detection reale;
- boost pad reali.

Queste feature arriveranno con branch piste, race systems e veicoli.

## Task Breakdown

- [x] Creare `InputManager`.
- [x] Gestire tasti tenuti.
- [ ] Gestire azioni one-shot.
- [ ] Bloccare scroll per tasti di gioco.
- [ ] Aggiungere `dispose()` a `InputManager`.
- [ ] Creare `ArcadeVehicleController`.
- [ ] Implementare `reset(spawn)`.
- [ ] Implementare `setPerformance(performance)`.
- [ ] Implementare accelerazione.
- [ ] Implementare freno.
- [ ] Implementare retromarcia.
- [ ] Implementare sterzo.
- [ ] Implementare ritorno sterzo a zero.
- [ ] Implementare attrito.
- [ ] Implementare handbrake.
- [ ] Calcolare `speedRatio`.
- [ ] Calcolare `distanceThisFrame`.
- [ ] Gestire `surfaceGrip` placeholder.
- [ ] Gestire `boostFactor` placeholder.
- [ ] Integrare controller nella preview.
- [ ] Collegare stato fisico a `vehicle.setTransform()`.
- [ ] Passare stato fisico a `vehicle.update()`.
- [ ] Implementare reset con `R`.
- [ ] Aggiornare `docs/contracts.md`.
- [ ] Aggiornare `README.md`.
- [ ] Eseguire `bun run build`.
