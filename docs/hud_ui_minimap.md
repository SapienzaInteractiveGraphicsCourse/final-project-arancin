# HUD, UI And Minimap Commit Plan

Questa nota serve come riferimento operativo per dividere la sezione HUD, UI e minimappa in commit piccoli, verificabili e facili da spiegare.

L'obiettivo non e' creare una storia artificiale, ma rendere ogni milestone chiara durante sviluppo, test e revisione. I commit vanno fatti solo quando la milestone e' stata provata localmente e approvata dal team.

## Regole Generali

- Fare commit solo dopo verifica locale e approvazione del team.
- Tenere separati DOM/HUD, minimappa, integrazione dati runtime, responsive UI e documentazione quando possibile.
- Non cambiare contratti condivisi senza aggiornare `docs/contracts.md`.
- Non copiare il simulatore non ufficiale: usarlo solo come riferimento concettuale.
- Prima di ogni commit controllare `git status --short`.
- Prima di chiedere review o merge eseguire almeno `bun run build`.
- Se viene introdotto comportamento browser-only, aggiungere o aggiornare una verifica browser quando disponibile.

## Scope Completo Della Sezione

Questa pianificazione copre la sezione 8 del README:

- menu selezione pista;
- menu selezione veicolo;
- selezione colore veicolo;
- pulsante start;
- HUD speed;
- HUD lap;
- HUD time;
- HUD checkpoint;
- HUD surface;
- HUD countdown/wrong way overlay;
- HUD posizione/gap;
- minimap canvas;
- centerline su minimap;
- marker player;
- marker AI;
- marker checkpoint/start;
- UI responsive;
- prevenzione testo sovrapposto su mobile.

Il menu setup base, il pulsante Start, countdown, giri, tempi, finish screen e warning contromano sono gia presenti in forma iniziale. Questa feature deve rifinirli e collegarli in modo piu completo, senza stravolgere il flusso esistente.

## Dati E Contratti Da Usare

- `AppState.setup`: pista, veicolo e modalita selezionati.
- `ArcadeVehicleController.getState()`: speed, surface, boost e stato fisico player.
- `RaceManager.getState()`: lap, tempi, checkpoint, posizione, partecipanti e stato gara.
- `WrongWayDetector.update()`: warning contromano.
- `trackInfo.centerline`: tracciato logico per minimappa.
- `trackInfo.minimapBounds`: bounds della minimappa.
- `trackInfo.checkpoints`: checkpoint e start/finish.
- `AiVehicleController.getState()`: posizione AI quando disponibile.

## Decisioni Di Prodotto

- La selezione colore deve essere in stile gioco, con preset/swatch visivi in basso al centro dopo `Start` e subito prima del countdown.
- La minimappa deve restare sempre visibile durante la guida.
- La minimappa deve ruotare in base alla direzione del veicolo, mantenendo il player come riferimento centrale quando possibile.
- Il marker AI va mostrato solo quando esiste anche un bot 3D visibile; non deve rappresentare un avversario solo logico.
- Posizione e gap devono restare visibili anche in `time-trial`, con fallback o valori coerenti in stile Formula 1.

## Ordine Consigliato Per La Sezione

### 1. HUD Plan And Current UI Audit

Scopo: fissare il piano di lavoro e controllare cosa e' gia implementato.

Possibili file:

- `docs/hud_ui_minimap.md`
- eventuale aggiornamento mirato a `README.md` solo quando una voce viene completata.

Contenuto atteso:

- piano commit per HUD/UI/minimappa;
- checklist condivisa;
- nessun cambio funzionale.

Verifica:

- `git status --short`;
- nessun build obbligatorio se cambia solo documentazione.

Commit suggerito:

```text
add hud ui minimap commit plan
```

### 2. Setup UI Refinement And Pre-Race Color

Scopo: rendere piu completo e coerente il menu iniziale e spostare la scelta colore nel passaggio pre-gara, senza cambiare il flusso `setup -> loading -> preview/race`.

Possibili file:

- `src/ui/setupMenu.js`
- `src/config/raceOptions.js`
- `src/main.js`
- `src/scene/startScenePreview.js`
- `src/styles/main.css`

Contenuto atteso:

- menu pista leggibile;
- menu veicolo leggibile;
- selezione modalita invariata;
- selezione colore con preset/swatch in stile gioco dopo Start;
- countdown avviato solo dopo conferma colore;
- pulsante Start sempre chiaro e accessibile;
- stato scelto mostrato in modo compatto.

Verifica:

- `bun run build`;
- prova manuale menu con tutte le piste e tutti i veicoli.

Commit suggerito:

```text
refine setup menu controls
```

### 3. Race HUD Structure

Scopo: sostituire l'HUD runtime generato con `innerHTML` ogni frame con una struttura DOM stabile e aggiornata per campi.

Possibili file:

- `src/ui/RaceHud.js`
- `src/scene/startScenePreview.js`
- `src/styles/main.css`

Contenuto atteso:

- HUD speed;
- HUD lap;
- HUD total time;
- HUD lap time;
- HUD checkpoint;
- HUD status;
- campi DOM stabili per test e aggiornamenti mirati.

Verifica:

- `bun run build`;
- prova manuale countdown, guida e restart.

Commit suggerito:

```text
add stable race hud component
```

### 4. HUD Runtime Data

Scopo: collegare l'HUD ai dati runtime disponibili senza introdurre nuove logiche di gara.

Possibili file:

- `src/ui/RaceHud.js`
- `src/scene/startScenePreview.js`
- `src/systems/RaceManager.js` solo se serve esporre dati gia calcolati.

Contenuto atteso:

- velocita in km/h;
- surface;
- countdown e wrong way in overlay dedicati;
- posizione/gap quando `race` o AI sono disponibili;
- fallback leggibili quando checkpoint, AI o bounds non esistono.

Verifica:

- `bun run build`;
- prova manuale in `race` e `time-trial`;
- verifica che HUD non si rompa con piste senza checkpoint.

Commit suggerito:

```text
wire hud to runtime race state
```

### 5. Minimap System

Scopo: introdurre un sistema minimappa separato dal loop principale e basato sui dati pista.

Possibili file:

- `src/systems/MinimapSystem.js`
- `src/scene/startScenePreview.js`
- `src/styles/main.css`

Contenuto atteso:

- canvas minimappa;
- proiezione XZ usando `trackInfo.minimapBounds`;
- disegno centerline;
- rotazione minimappa in base a heading player;
- player come riferimento centrale quando i dati lo permettono;
- gestione resize canvas/device pixel ratio;
- fallback se mancano centerline o bounds.

Verifica:

- `bun run build`;
- prova manuale sulle tre piste;
- controllo visivo che la centerline sia leggibile.

Commit suggerito:

```text
add track minimap canvas
```

### 6. Minimap Markers

Scopo: aggiungere marker dinamici e leggibili senza dipendere da AI completa.

Possibili file:

- `src/systems/MinimapSystem.js`
- `src/scene/startScenePreview.js`

Contenuto atteso:

- marker player;
- marker AI automatico solo quando lo stato AI corrisponde a un bot 3D visibile (`visible` o `hasVisibleModel`);
- marker checkpoint;
- marker start/finish distinto;
- possibile orientamento del marker player.

Verifica:

- `bun run build`;
- prova manuale movimento player;
- prova con modalita race e time-trial.

Commit suggerito:

```text
add minimap race markers
```

### 7. Responsive HUD And Mobile Pass

Scopo: evitare sovrapposizioni e rendere HUD/minimappa usabili anche su viewport stretti.

Possibili file:

- `src/styles/main.css`
- eventuali componenti UI se servono classi o attributi dedicati.

Contenuto atteso:

- HUD compatto su desktop;
- layout mobile senza testo sovrapposto;
- minimappa ridimensionata;
- bottoni setup con testo contenuto;
- z-index coerenti con countdown, pausa e finish screen.

Verifica:

- `bun run build`;
- prova manuale desktop e mobile;
- browser verification/screenshot se disponibile.

Commit suggerito:

```text
make hud and minimap responsive
```

### 8. Verification And Documentation Update

Scopo: chiudere la feature aggiornando test e documentazione.

Possibili file:

- `scripts/verify-scene.mjs`
- `docs/contracts.md`
- `docs/race-systems.md`
- `README.md`

Contenuto atteso:

- verifica browser aggiornata per DOM HUD/minimappa stabile;
- contratti aggiornati solo se sono state introdotte nuove API;
- README aggiornato spuntando solo le voci effettivamente completate.

Verifica:

- `bun run build`;
- script browser disponibile, se aggiornato;
- `git status --short`.

Commit suggerito:

```text
verify hud minimap integration
```

## Note Per I Commit

Il primo commit puo contenere solo questo piano se serve condividere subito il branch con il team. In alternativa si puo aspettare la prima milestone funzionale, cosi il primo push mostra gia una parte visibile della feature.
