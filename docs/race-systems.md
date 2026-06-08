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

Dipendenze:

- [x] `trackInfo.checkpoints`;
- [x] `trackInfo.centerline`;
- [ ] veicolo AI creato con lo stesso `vehicleId` del player;
- [ ] performance AI coerenti con il veicolo scelto.

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

Dipendenze:

- [x] `trackInfo.checkpoints`;
- [x] localStorage per record;
- [ ] eventuale ghost opzionale solo se il team decide di aggiungerlo piu avanti.

## Fuori Scope Iniziale

- AI completa;
- collisione player-bot;
- record persistenti complessi;
- ghost lap;
- classifica avanzata;
- pit stop.

Questi possono arrivare dopo contromano, AI base e integrazione veicoli finali.

## Milestone 1: RaceManager Base

File previsto:

```text
src/systems/RaceManager.js
```

Responsabilita:

- [x] gestire stato gara;
- [x] conoscere modalita selezionata;
- [x] gestire countdown;
- [x] gestire tempo totale;
- [x] gestire tempo giro;
- [x] esporre snapshot leggibile per HUD e sistemi futuri.

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

- [x] creare stato countdown in `RaceManager`;
- [x] bloccare input fisico finche countdown non finisce;
- [x] mostrare countdown in overlay o componente dedicato;
- [x] aggiornare `AppState` o uno snapshot race leggibile.
- [x] aggiungere pausa con `Esc` e ritorno alla GUI iniziale.

## Milestone 3: Time Trial Base

Obiettivo:

- usare `raceMode: "time-trial"`;
- niente AI;
- cronometro attivo quando la gara e running;
- quando i checkpoint reali arriveranno, chiudere il giro e salvare best lap.

Task:

- [x] configurare `totalLaps = 1`;
- [x] esporre `lapTime`;
- [x] esporre `bestLapTime`;
- [x] predisporre chiave localStorage: `trackId:vehicleId:mode`.

## Milestone 4: Race Mode Base

Obiettivo:

- usare `raceMode: "race"`;
- predisporre giri multipli;
- predisporre AI, senza implementarla completamente se mancano pista/veicolo.

Task:

- [x] configurare `totalLaps = 3`;
- [x] esporre posizione semplice;
- [x] predisporre `aiEnabled`;
- [x] documentare che AI completa dipende da centerline e veicoli finali.

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

Formato piste spline attualmente supportato:

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

`checkpointUtils` normalizza `id -> order`, `size -> radius` e `id === 0 -> isStartFinish`.
Il giro si completa solo tornando sulla start/finish line dopo aver attraversato i checkpoint intermedi.

Task:

- [x] aggiornare `docs/contracts.md`;
- [x] `RaceManager` non deve rompersi con `trackInfo.checkpoints = []`;
- [x] quando i checkpoint esistono, richiedere ordine corretto.

## Milestone 6: Verification

Test automatici possibili:

- [x] menu -> Race -> Start -> countdown/running;
- [x] menu -> Time Trial -> Start -> countdown/running;
- [x] reset mantiene app funzionante.

La UI espone countdown e HUD in DOM stabile; `verify:scene` copre avvio scena, countdown, ritorno al menu e stato HUD base.

## Milestone 7: Prossimi Step

- [x] Implementare avviso contromano usando `trackInfo.centerline`.
- [x] Preparare controller logico AI usando `trackInfo.centerline`.
- [x] Implementare AI opponent visibile usando `trackInfo.centerline`.
- [ ] Integrare collisioni/barriere quando la sezione collisioni e pronta.
- [ ] Rifinire HUD/minimap nel branch dedicato.

## Task Breakdown

- [x] Creare `RaceManager`.
- [x] Definire fasi `idle`, `countdown`, `running`, `finished`.
- [x] Configurare modalita `race`.
- [x] Configurare modalita `time-trial`.
- [x] Implementare `startCountdown()`.
- [x] Implementare `startRace()`.
- [x] Implementare `reset()`.
- [x] Implementare `update(deltaTime, playerState, trackInfo)`.
- [x] Esportare `getState()`.
- [x] Bloccare movimento durante countdown.
- [x] Mostrare countdown in UI/overlay.
- [x] Aggiungere menu pausa con ritorno alla GUI iniziale.
- [x] Aggiungere cronometro totale.
- [x] Aggiungere cronometro giro.
- [x] Preparare supporto checkpoint.
- [x] Evidenziare checkpoint successivo.
- [x] Preparare supporto best lap time trial.
- [x] Preparare supporto race vs AI.
- [x] Aggiornare posizione player confrontando progresso player e AI.
- [x] Aggiungere finish screen con classifica lap time e gap dal best lap.
- [x] Salvare storico lap completati per pista/veicolo/modalita.
- [x] Implementare warning contromano.
- [x] Preparare controller logico AI.
- [x] Aggiungere opponent AI visibile.
- [x] Rendere velocita AI dipendente dal veicolo.
- [x] Aggiungere accelerazione progressiva e rallentamento in curva.
- [x] Aggiornare `docs/contracts.md`.
- [x] Aggiornare `README.md`.
- [x] Eseguire `bun run build`.
