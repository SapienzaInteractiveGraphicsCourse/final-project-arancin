# Race Systems Plan

Branch: `feature/race-systems`

Obiettivo: implementare il flusso gara e le modalita senza invadere i branch veicoli e piste.

## Modalita Supportate

Il gioco deve supportare esattamente due modalita iniziali.

### Race

ID:

```js
"race"
```

Obiettivo:

- gara contro un avversario AI;
- giri multipli;
- checkpoint in ordine;
- classifica semplice player vs AI;
- finish quando il player completa i giri richiesti.

Dipendenze future:

- `trackInfo.checkpoints`;
- `trackInfo.centerline`;
- veicolo AI creato con lo stesso `vehicleId` del player;
- performance AI coerenti con il veicolo scelto.

### Time Trial

ID:

```js
"time-trial"
```

Obiettivo:

- un solo player;
- giro veloce;
- cronometro;
- best lap locale;
- nessun bot obbligatorio;
- utile per testare piste e veicoli.

Dipendenze future:

- `trackInfo.checkpoints`;
- localStorage per record;
- eventuale ghost opzionale solo se il team decide di aggiungerlo piu avanti.

## Fuori Scope Iniziale

- AI completa;
- collisione player-bot;
- record persistenti complessi;
- ghost lap;
- classifica avanzata;
- pit stop.

Questi possono arrivare dopo checkpoint e piste reali.

## Milestone 1: RaceManager Base

File previsto:

```text
src/systems/RaceManager.js
```

Responsabilita:

- gestire stato gara;
- conoscere modalita selezionata;
- gestire countdown;
- gestire tempo totale;
- gestire tempo giro;
- esporre snapshot leggibile per HUD e sistemi futuri.

Fasi:

```js
"idle" | "countdown" | "running" | "finished"
```

Contratto proposto:

```js
const raceManager = new RaceManager({
  mode,
  totalLaps,
  countdownSeconds
});

raceManager.startCountdown()
raceManager.startRace()
raceManager.update(deltaTime, playerState, trackInfo)
raceManager.reset()
raceManager.getState()
```

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
  countdown,
  finished
}
```

## Milestone 2: Countdown

Obiettivo:

- dopo Start la preview entra in countdown;
- il veicolo non deve muoversi prima della fine countdown;
- overlay o UI mostra `3`, `2`, `1`, `GO`;
- finito il countdown la fase diventa `running`.

Task:

- [ ] creare stato countdown in `RaceManager`;
- [ ] bloccare input fisico finche countdown non finisce;
- [ ] mostrare countdown in overlay o componente dedicato;
- [ ] aggiornare `AppState` o uno snapshot race leggibile.

## Milestone 3: Time Trial Base

Obiettivo:

- usare `raceMode: "time-trial"`;
- niente AI;
- cronometro attivo quando la gara e running;
- quando i checkpoint reali arriveranno, chiudere il giro e salvare best lap.

Task:

- [ ] configurare `totalLaps = 1`;
- [ ] esporre `lapTime`;
- [ ] esporre `bestLapTime`;
- [ ] predisporre chiave localStorage: `trackId:vehicleId:mode`.

## Milestone 4: Race Mode Base

Obiettivo:

- usare `raceMode: "race"`;
- predisporre giri multipli;
- predisporre AI, senza implementarla completamente se mancano pista/veicolo.

Task:

- [ ] configurare `totalLaps = 3`;
- [ ] esporre posizione semplice;
- [ ] predisporre `aiEnabled`;
- [ ] documentare che AI completa dipende da centerline e veicoli finali.

## Milestone 5: Checkpoint Contract

Obiettivo:

- definire contratto checkpoint per il branch piste;
- permettere a `RaceManager` di funzionare anche se i checkpoint non ci sono ancora.

Forma proposta:

```js
{
  id,
  position,
  radius,
  order,
  isStartFinish
}
```

Task:

- [ ] aggiornare `docs/contracts.md`;
- [ ] `RaceManager` non deve rompersi con `trackInfo.checkpoints = []`;
- [ ] quando i checkpoint esistono, richiedere ordine corretto.

## Milestone 6: Verification

Test automatici possibili:

- menu -> Race -> Start -> countdown/running;
- menu -> Time Trial -> Start -> countdown/running;
- reset mantiene app funzionante.

Se la UI non espone ancora countdown in DOM stabile, lasciare verifica manuale e `bun run build`.

## Task Breakdown

- [ ] Creare `RaceManager`.
- [ ] Definire fasi `idle`, `countdown`, `running`, `finished`.
- [ ] Configurare modalita `race`.
- [ ] Configurare modalita `time-trial`.
- [ ] Implementare `startCountdown()`.
- [ ] Implementare `startRace()`.
- [ ] Implementare `reset()`.
- [ ] Implementare `update(deltaTime, playerState, trackInfo)`.
- [ ] Esportare `getState()`.
- [ ] Bloccare movimento durante countdown.
- [ ] Mostrare countdown in UI/overlay.
- [ ] Aggiungere cronometro totale.
- [ ] Aggiungere cronometro giro.
- [ ] Preparare supporto checkpoint.
- [ ] Preparare supporto best lap time trial.
- [ ] Preparare supporto race vs AI.
- [ ] Aggiornare `docs/contracts.md`.
- [ ] Aggiornare `README.md`.
- [ ] Eseguire `bun run build`.

