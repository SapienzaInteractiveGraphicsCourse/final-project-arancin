# Audio System Commit Plan

Questa nota serve come riferimento operativo per dividere la sezione audio in commit piccoli, verificabili e facili da spiegare.

L'obiettivo e' aggiungere feedback sonoro senza rendere il gioco invasivo o fragile: audio sintetico tramite Web Audio API, volume basso, avvio solo dopo gesto utente e integrazione graduale con eventi gia presenti.

## Regole Generali

- Fare commit solo dopo verifica locale e approvazione del team.
- Non introdurre asset audio esterni finche' i suoni procedurali Web Audio sono sufficienti.
- Tenere separati sistema audio, integrazione runtime, UI toggle e documentazione quando possibile.
- Audio sempre disattivabile e con volume master basso di default.
- AudioContext creato o ripreso solo dopo gesto utente.
- Prima di ogni commit controllare `git status --short`.
- Prima di chiedere review o merge eseguire almeno `bun run build`.
- Se viene introdotto comportamento browser-only, eseguire una verifica manuale o Playwright quando disponibile.

## Scope Completo Della Sezione

Questa pianificazione copre la sezione 9 del README:

- Web Audio API;
- motore continuo non invasivo;
- volume master basso;
- audio abilitato solo dopo gesto utente;
- suono checkpoint;
- suono countdown;
- suono collisione;
- suono boost;
- toggle audio.

## Dati E Contratti Da Usare

- `ArcadeVehicleController.getState()`: speed, speedRatio, boostActive e collided.
- `RaceManager.getState()`: phase, countdown, currentCheckpoint e lap.
- `TrackInteractionSystem.update()`: impatti con barriere, bot e boost pad tramite `environmentState`.
- `InputManager.consumeActions()`: eventuale azione one-shot per toggle audio, se aggiunta al contratto.
- `startScenePreview`: punto di orchestrazione runtime per collegare audio, gara e dispose.

## Decisioni Di Prodotto

- L'audio deve essere percepibile ma secondario rispetto a guida e HUD.
- Il motore deve essere continuo, basso e morbido, non un rumore aggressivo.
- L'audio deve partire solo dopo un gesto utente gia naturale, per esempio `Start Race` o toggle audio.
- Il toggle audio deve essere chiaro ma non occupare spazio importante nell'HUD.
- I suoni evento devono essere brevi e distinguibili:
  - countdown: beep breve;
  - checkpoint: conferma chiara;
  - collisione: thump corto;
  - boost: sweep rapido.

## Ordine Consigliato Per La Sezione

### 1. Audio Plan And Current Runtime Audit

Scopo: fissare il piano e controllare dove agganciare eventi audio senza cambiare gameplay.

Possibili file:

- `docs/audio-system.md`

Contenuto atteso:

- piano commit audio;
- nessun cambio funzionale.

Verifica:

- `git status --short`;
- nessun build obbligatorio se cambia solo documentazione.

Commit suggerito:

```text
add audio system commit plan
```

### 2. Web Audio Service

Scopo: introdurre un sistema audio isolato e sicuro rispetto alle policy browser.

Possibili file:

- `src/systems/AudioManager.js`
- `docs/contracts.md` se viene esposto un contratto condiviso.

Contenuto atteso:

- uso Web Audio API;
- `AudioContext` lazy/resume dopo gesto utente;
- master gain basso;
- `setEnabled(enabled)`;
- `toggle()`;
- `update(deltaTime, vehicleState)`;
- `playCountdown()`;
- `playCheckpoint()`;
- `playCollision()`;
- `playBoost()`;
- `dispose()`.

Verifica:

- `bun run build`;
- prova manuale che il browser non blocchi errori audio prima del gesto utente.

Commit suggerito:

```text
add web audio manager
```

### 3. Engine Loop Sound

Scopo: aggiungere un motore continuo legato allo stato del veicolo, ma non invasivo.

Possibili file:

- `src/systems/AudioManager.js`
- `src/scene/startScenePreview.js`

Contenuto atteso:

- oscillatori o noise leggero per motore;
- volume molto basso;
- pitch/filtri dipendenti da speedRatio;
- smooth ramp per evitare click;
- stop pulito in `dispose()`.

Verifica:

- `bun run build`;
- prova manuale con Kart, Porsche e Silvia;
- controllo che audio non parta prima di `Start Race` o toggle.

Commit suggerito:

```text
add subtle engine audio loop
```

### 4. Race Event Sounds

Scopo: collegare suoni brevi agli eventi gia esistenti senza duplicarli ogni frame.

Possibili file:

- `src/systems/AudioManager.js`
- `src/scene/startScenePreview.js`

Contenuto atteso:

- countdown beep una volta per step;
- checkpoint sound una volta per checkpoint attraversato;
- collision sound con cooldown;
- boost sound all'attivazione del boost;
- nessun suono ripetuto ogni frame per lo stesso evento.

Verifica:

- `bun run build`;
- prova manuale countdown, checkpoint, collisione e boost;
- verifica che restart resetti lo stato eventi audio.

Commit suggerito:

```text
wire audio to race events
```

### 5. Audio Toggle UI And Input

Scopo: permettere di attivare/disattivare l'audio in modo chiaro.

Possibili file:

- `src/scene/startScenePreview.js`
- `src/systems/InputManager.js`
- `src/styles/main.css`
- `docs/contracts.md` se viene aggiunta una nuova azione input.

Contenuto atteso:

- toggle audio visibile in HUD o controllo compatto;
- opzionale scorciatoia tastiera se approvata;
- stato toggle sincronizzato con `AudioManager`;
- audio spento in modo pulito quando disabilitato.

Verifica:

- `bun run build`;
- prova manuale mouse/touch;
- prova manuale eventuale scorciatoia.

Commit suggerito:

```text
add audio toggle control
```

### 6. Checklist And Documentation Update

Scopo: aggiornare README e documentazione solo quando la sezione e' verificata.

Possibili file:

- `README.md`
- `docs/contracts.md`
- `docs/audio-system.md`

Contenuto atteso:

- checklist audio flaggata solo per funzioni realmente completate;
- note su Web Audio API e scelta di audio procedurale;
- eventuale contratto aggiornato per input/toggle.

Verifica:

- `bun run build`;
- controllo manuale finale sezione 9.

Commit suggerito:

```text
document audio system completion
```
