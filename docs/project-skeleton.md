# Project Skeleton

Questo documento descrive lo stato iniziale del branch `feature/project-skeleton`.

## Obiettivo Dello Skeleton

Lo skeleton deve dare al gruppo una base condivisa senza anticipare gameplay, piste o veicoli completi.

In questa fase il progetto contiene:

- GUI iniziale per scegliere pista, veicolo e modalita;
- stato selezionato esposto con `trackId`, `vehicleId`, `raceMode`;
- stato applicativo condiviso con fase `setup`, `loading`, `preview`, `race`;
- scena Three.js preview caricata solo dopo `Start`;
- struttura cartelle per dividere responsabilita future;
- asset importati Porsche/Silvia gia organizzati ma non ancora caricati in scena.

## Flusso Attuale

1. `src/main.js` carica solo CSS, opzioni e GUI.
2. La pagina mostra il menu setup senza inizializzare Three.js.
3. Al click su `Start`, `src/main.js` importa dinamicamente `src/scene/startScenePreview.js`.
4. Solo a quel punto vengono creati renderer, scena, camera, luci e preview temporanea.
5. L'overlay mostra la selezione corrente.

Questo evita di caricare subito la scena 3D prima che l'utente abbia scelto impostazioni.

## File Principali

- `src/config/raceOptions.js`: opzioni disponibili per piste, veicoli e modalita gara.
- `src/ui/setupMenu.js`: creazione DOM della GUI setup e gestione selezione.
- `src/main.js`: entry point leggero e orchestrazione dello start.
- `src/systems/AppState.js`: stato condiviso per fase corrente e setup selezionato.
- `src/scene/startScenePreview.js`: preview Three.js temporanea, caricata lazy.
- `src/scene/createRenderer.js`: configurazione renderer.
- `src/scene/createScene.js`: scena base.
- `src/scene/createMainCamera.js`: camera base.
- `src/scene/createSceneLights.js`: luci base.
- `src/tracks/trackFactory.js`: factory placeholder per selezione piste.
- `src/vehicles/vehicleFactory.js`: factory placeholder per selezione veicoli.
- `src/styles/main.css`: stile del menu, overlay e preview.

## Punti Di Integrazione Per I Colleghi

### Veicoli

Chi lavora sui veicoli puo partire da `setup.vehicleId`.

Valori previsti:

- `kart`
- `porsche`
- `silvia`

Il branch veicoli deve evolvere `src/vehicles/vehicleFactory.js` senza cambiare il contratto di base usato dalla preview.

### Piste E Ambiente

Chi lavora su piste e ambiente puo partire da `setup.trackId`.

Valori previsti:

- `vegas`
- `beach`
- `monaco`

Il branch piste deve evolvere `src/tracks/trackFactory.js` senza cambiare il contratto di base usato dalla preview.

### Modalita Gara

Chi lavora su gara e sistemi runtime puo partire da `setup.raceMode`.

Valori previsti:

- `race`
- `time-trial`

Per ora questi valori aggiornano solo lo stato e l'overlay.

## Cosa Non E Ancora Implementato

- caricamento reale Porsche/Silvia;
- kart procedurale;
- generazione piste;
- fisica di guida;
- AI;
- collisioni;
- HUD completo;
- minimappa;
- audio.

## Coerenza Con La Guida

Lo skeleton segue la guida greenfield per questi punti:

- codice diviso per responsabilita;
- `main.js` come orchestratore leggero;
- dati di setup separati in `src/config`;
- UI separata in `src/ui`;
- scena Three.js in `src/scene`;
- Three.js usato con renderer, camera, luci e shadow map;
- nessuna copia meccanica del progetto non ufficiale.

La guida completa resta il riferimento per i branch successivi.
