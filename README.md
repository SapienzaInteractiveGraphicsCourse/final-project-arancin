# Kart Racing Simulator

Todo list condivisa per il progetto di Interactive Graphics.

Obiettivo: costruire una web app racing 3D in browser con Three.js, 3 veicoli, 3 piste, guida arcade, AI, collisioni, HUD/minimappa e documentazione finale.

## Regole Di Lavoro

- Usare `develop` come branch di integrazione.
- Creare branch per feature, non per persona.
- Tenere `main` stabile per consegna/GitHub Pages.
- Prima di merge in `develop`, eseguire `bun run build`.
- Non copiare meccanicamente il progetto non ufficiale: usarlo come riferimento tecnico.
- Non esporre Formula 1 come veicolo selezionabile.
- Documentare tutti gli asset esterni in `docs/asset-register.md`.

## Stato Branch

- [x] `feature/vehicle-assets`: import asset Porsche e Silvia.
- [x] `feature/project-skeleton`: struttura cartelle iniziale.
- [x] `feature/project-skeleton`: scena Three.js base.
- [ ] `feature/procedural-kart`: kart costruito da zero.
- [ ] `feature/vehicle-loaders`: loader Porsche/Silvia.
- [ ] `feature/tracks`: 3 piste principali.
- [x] `feature/race-systems`: countdown, giri, checkpoint, time trial, finish screen, AI base e contromano.
- [ ] `feature/hud-minimap`: HUD e minimappa.
- [ ] `fix/performance-polish`: alleggerimento, loading veicoli, UI polish e ghost time trial.
- [ ] `docs/project-report`: relazione/manuale finale.

## 1. Project Skeleton

- [x] Creare cartelle principali:
  - [x] `src/config/`
  - [x] `src/scene/`
  - [x] `src/vehicles/`
  - [x] `src/tracks/`
  - [x] `src/systems/`
  - [x] `src/materials/`
  - [x] `src/styles/`
- [x] Sostituire starter Vite in `src/main.js`.
- [x] Creare entry point applicativo pulito.
- [x] Creare renderer Three.js con antialias.
- [x] Abilitare shadow map.
- [x] Impostare output color space sRGB.
- [x] Creare scena base.
- [x] Creare camera prospettica.
- [x] Creare luci base:
  - [x] ambient light;
  - [x] directional light con shadow.
- [x] Creare ground temporaneo.
- [x] Gestire resize finestra.
- [x] Creare game loop base con `THREE.Timer`.
- [x] Limitare `deltaTime` a `0.05`.
- [x] Creare overlay UI minimale.
- [x] Creare GUI setup placeholder.
- [x] Esporre stato selezionato:
  - [x] `trackId`;
  - [x] `vehicleId`;
  - [x] `raceMode`.
- [x] Creare `AppState` condiviso:
  - [x] fase `setup`;
  - [x] fase `loading`;
  - [x] fase `preview`;
  - [x] fase `race`.
- [x] Caricare preview Three.js solo dopo `Start`.
- [x] Creare `src/tracks/trackFactory.js` placeholder.
- [x] Creare `src/vehicles/vehicleFactory.js` placeholder.
- [x] Far usare alla preview le factory placeholder invece di mesh dirette.
- [x] Aggiungere `docs/contracts.md` con API condivise.
- [x] Aggiungere script `verify:scene`.
- [x] Spostare CSS runtime in `src/styles/`.
- [x] Aggiornare script `dev` e `preview` con `--host 0.0.0.0`.
- [x] Aggiungere documentazione skeleton in `docs/project-skeleton.md`.
- [x] Verificare `bun run build`.

## 2. Veicoli

### Interfaccia Comune

- [x] Definire interfaccia/base class veicolo.
- [x] Ogni veicolo deve esporre:
  - [x] `group`;
  - [x] `performance`;
  - [x] `setTransform(position, heading)`;
  - [x] `update(deltaTime, state)`;
  - [x] `setBodyColor(color)`;
  - [x] `setHeadlights(enabled)`;
  - [x] `toggleHeadlights()`;
  - [x] `dispose()`.
- [x] Creare `vehicleFactory`.
- [x] Separare dati performance da logica fisica.
- [x] Ordinare velocita massime: Porsche > Silvia > Kart.

### Kart Procedurale

- [x] Costruire kart da zero con primitive Three.js.
- [x] Creare gerarchia:
  - [x] root group;
  - [x] telaio;
  - [x] carrozzeria;
  - [x] sedile;
  - [x] volante;
  - [x] pilota opzionale;
  - [x] assi;
  - [x] quattro ruote;
  - [x] fari.
- [x] Ruote anteriori sterzanti con pivot separati.
- [x] Ruote animate in base a distanza percorsa.
- [x] Colore carrozzeria modificabile.
- [x] Headlights toggle.
- [x] Materiali con roughness/metalness coerenti.
- [x] Piccole animazioni gerarchiche JS:
  - [x] volante;
  - [x] ruote;
  - [x] possibile oscillazione telaio/sospensioni.

### Porsche

- [x] Importare asset GLB.
- [x] Creare loader dedicato.
- [x] Usare cache del modello caricato.
- [x] Clonare modello per player e AI.
- [x] Verificare scala.
- [x] Verificare orientamento.
- [x] Verificare origine/pivot.
- [x] Correggere luci anteriori.
- [x] Identificare o ricreare ruote animate.
- [x] Applicare colore carrozzeria se possibile.
- [x] Documentare fonte/licenza asset.

### Nissan Silvia

- [x] Importare asset FBX.
- [x] Creare loader dedicato.
- [x] Usare cache del modello caricato.
- [x] Clonare modello per player e AI.
- [x] Verificare scala.
- [x] Verificare orientamento.
- [x] Verificare origine/pivot.
- [x] Correggere luci anteriori.
- [x] Identificare o ricreare ruote animate.
- [x] Applicare colore carrozzeria se possibile.
- [ ] Documentare fonte/licenza asset.

## 3. Fisica E Input

- [x] Creare documentazione `docs/physics-input.md`.
- [x] Creare `InputManager`.
- [x] Gestire tasti tenuti premuti:
  - [x] W / freccia su;
  - [x] S / freccia giu;
  - [x] A / freccia sinistra;
  - [x] D / freccia destra;
  - [x] Space handbrake.
- [x] Gestire tasti one-shot:
  - [x] C cambio camera;
  - [x] L luci;
  - [x] R restart.
  - [x] Esc pausa/menu.
- [x] Consumare one-shot una sola volta per frame.
- [x] Bloccare scroll pagina per i tasti di gioco.
- [x] Aggiungere `dispose()` a `InputManager`.
- [x] Creare `ArcadeVehicleController`.
- [x] Accettare `vehicle.performance` dal veicolo selezionato.
- [x] Accettare `track.spawn` dalla pista selezionata.
- [x] Stato fisico:
  - [x] position;
  - [x] heading;
  - [x] speed;
  - [x] steering;
  - [x] boostTimer;
  - [x] surfaceGrip;
  - [x] surfaceType.
- [x] Implementare `reset(spawn)`.
- [x] Implementare `setPerformance(performance)`.
- [x] Accelerazione/freno/retromarcia.
- [x] Sterzo dipendente da velocita e grip.
- [x] Ritorno graduale dello sterzo a zero.
- [x] Attrito differenziato.
- [x] Handbrake.
- [x] Supporto placeholder per off-road/sabbia/erba tramite `environmentState`.
- [x] Supporto placeholder per boost tramite `environmentState`.
- [x] Calcolare `distanceThisFrame` per animazione ruote.
- [x] Calcolare `speedRatio`.
- [x] Collegare controller alla preview.
- [x] Applicare `vehicle.setTransform(state.position, state.heading)`.
- [x] Passare stato fisico a `vehicle.update(deltaTime, state)`.
- [x] Implementare reset con `R` nella preview.
- [x] Aggiornare `docs/contracts.md` con contratti input/controller.
- [x] Verificare `bun run build`.

## 4. Piste

### Sistema Tracciati

- [ ] Definire dati pista separati dalla generazione.
- [ ] Usare `THREE.CatmullRomCurve3` chiuse.
- [ ] Generare road mesh campionando spline.
- [ ] Creare UV strada.
- [ ] Creare materiali strada/terreno.
- [ ] Salvare centerline.
- [ ] Salvare minimap bounds.
- [ ] Salvare checkpoint.
- [ ] Salvare boost pads.
- [ ] Salvare barrier colliders.
- [ ] Creare `trackFactory`.

### Vegas Neon

- [ ] Layout non ovale.
- [ ] Curve a destra e sinistra.
- [ ] Chicane.
- [ ] Rettilineo veloce.
- [ ] Tema notturno.
- [ ] Neon rosa/cyan/giallo/verde.
- [ ] Tunnel colorati.
- [ ] Palazzi laterali.
- [ ] Bordi strada luminosi.
- [ ] Luci coerenti con notte.

### Tropical Beach

- [ ] Layout non ovale.
- [ ] Curve a destra e sinistra.
- [ ] S veloci/chicane.
- [ ] Tornante o curva lenta.
- [ ] Sabbia e mare.
- [ ] Palme e props tropicali.
- [ ] Cielo diurno.
- [ ] Particelle sabbia in off-road.

### Monaco Formula 1

- [ ] Layout cittadino stretto.
- [ ] Curve lente a 90 gradi.
- [ ] Chicane.
- [ ] Tornante.
- [ ] Rettilineo breve.
- [ ] Barriere vicine.
- [ ] Props urbani/eleganti.
- [ ] Look tecnico da pista cittadina.

## 5. Collisioni

- [x] Documentare `docs/collisions.md`.

### Track Interaction System

- [x] Creare `TrackInteractionSystem`.
- [x] Sostituire `environmentState` hardcoded nella scena.
- [x] Gestire default robusti se la pista non espone dati completi.
- [x] Aggiornare `docs/contracts.md`.

### Off-road

- [x] Rilevamento off-road tramite `centerline` e `roadHalfWidth`.
- [x] Ridurre `surfaceGrip` fuori strada.
- [x] Ridurre `speedLimitMultiplier` fuori strada.
- [x] Esporre `surfaceType` per HUD futuro.

### Boost Pad

- [x] Rilevamento boost pad.
- [x] Applicare `boostFactor`.
- [x] Cooldown breve boost.
- [x] Annullare boost su impatto importante.

### Barriere

- [x] Collisione player-barriere.
- [x] Test punto/veicolo contro collider oriented box 2D.
- [x] Applicare correzione fisica ogni frame di intersezione.
- [ ] Cooldown solo per audio/penalita, non per risposta fisica.
- [x] Spingere fuori dalla barriera lungo la normale.
- [x] Ridurre/invertire velocita su impatto frontale.

### Player Vs AI

- [x] Collisione player-bot.
- [x] Separare posizioni player/bot.
- [x] Penalita o feedback collisione.

## 6. Gara E AI

### Modalita

- [x] Documentare `docs/race-systems.md`.
- [x] Supportare modalita `race`:
  - [x] gara contro AI;
  - [x] giri multipli;
  - [x] checkpoint in ordine;
  - [x] classifica semplice player predisposta.
- [x] Supportare modalita `time-trial`:
  - [x] solo player;
  - [x] giro veloce;
  - [x] cronometro;
  - [x] best lap locale.

### Race Manager

- [x] Creare `RaceManager`.
- [x] Definire fasi:
  - [x] `idle`;
  - [x] `countdown`;
  - [x] `running`;
  - [x] `finished`.
- [x] Configurare `totalLaps` in base alla modalita:
  - [x] `race`: 3 giri;
  - [x] `time-trial`: 1 giro.
- [x] Implementare `startCountdown()`.
- [x] Implementare `startRace()`.
- [x] Implementare `reset()`.
- [x] Implementare `update(deltaTime, playerState, trackInfo)`.
- [x] Esportare `getState()`.
- [x] Non rompersi con `trackInfo.checkpoints = []`.

### Countdown E Start Flow

- [x] Countdown iniziale.
- [x] Bloccare movimento durante countdown.
- [x] Mostrare countdown in UI/overlay.
- [x] Passare a gara running dopo `GO`.
- [x] Menu pausa con `Esc`.
- [x] Ritorno alla GUI iniziale dal menu pausa.

### Tempi E Giri

- [x] Cronometro totale.
- [x] Cronometro giro.
- [x] Checkpoint in ordine predisposti.
- [x] Evidenziare checkpoint successivo.
- [x] Giri.
- [x] Best lap predisposto per time trial.
- [x] Finish screen con classifica lap time.
- [x] Storico lap completati in localStorage.
- [x] Restart gara.

### AI E Race Mode

- [x] Predisporre stato `aiEnabled`.
- [x] Esporre posizione semplice player.
- [x] Aggiornare posizione player rispetto all'AI.
- [x] Preparare controller logico AI su centerline.
- [x] AI opponent visibile.
- [x] AI usa stesso veicolo selezionato dal player.
- [x] Velocita AI dipendente dal veicolo.
- [x] AI frena prima delle curve.
- [x] AI accelera in uscita.
- [x] AI segue traiettoria con offset laterale.
- [ ] AI competitiva ma battibile in tuning finale dedicato.

### Contromano

- [x] Avviso contromano:
  - [x] progresso piu vicino su centerline;
  - [x] heading pista da lookahead;
  - [x] prodotto scalare con forward veicolo;
  - [x] soglia temporale per evitare falsi positivi.

### Contratti E Verifiche

- [x] Aggiornare `docs/contracts.md` con contratto `RaceManager`.
- [x] Aggiornare `docs/contracts.md` con contratto checkpoint.
- [x] Aggiornare `verify:scene` se il countdown ha DOM stabile.
- [x] Verificare `bun run build`.

## 7. Camera

- [x] Documentare `docs/camera-system.md`.

### Camera Controller

- [x] Creare `CameraController`.
- [x] Estrarre follow camera da `startScenePreview.js`.
- [x] Mantenere comportamento follow attuale.
- [x] Gestire resize camera nel controller.
- [x] Aggiornare `docs/contracts.md`.

### Modalita Camera

- [x] Follow camera dietro il veicolo.
- [x] Top/debug camera.
- [x] Driver/hood camera opzionale.
- [x] Free/orbit camera opzionale.
- [x] Cambio camera con `C`.

### Feedback

- [x] Camera shake leggero su collisione.
- [x] Evitare shake fastidioso in modalita debug/top.

## 8. HUD, UI E Minimap

- [x] Menu selezione pista.
- [x] Menu selezione veicolo.
- [x] Selezione colore veicolo.
- [x] Pulsante start.
- [x] HUD speed.
- [x] HUD lap.
- [x] HUD time.
- [x] HUD checkpoint.
- [x] HUD surface.
- [x] HUD countdown/wrong way overlay.
- [x] HUD posizione/gap.
- [x] Minimap canvas.
- [x] Disegnare centerline su minimap.
- [x] Marker player.
- [x] Marker AI.
- [x] Marker checkpoint/start.
- [x] UI responsive.
- [x] Evitare testo sovrapposto su mobile.

## 9. Audio

- [x] Web Audio API.
- [x] Motore continuo non invasivo.
- [x] Volume master basso.
- [x] Audio abilitato solo dopo gesto utente.
- [x] Suono checkpoint.
- [x] Suono countdown.
- [x] Suono collisione.
- [x] Suono boost.
- [x] Toggle audio.

## 10. Ambiente E Animazioni

- [ ] Skybox/colore cielo per tema.
- [ ] Luci diverse per tema.
- [ ] Nuvole animate.
- [ ] Spalti appoggiati al terreno.
- [ ] Bandiere animate.
- [ ] Pubblico/props leggeri.
- [ ] Particelle:
  - [ ] sabbia;
  - [ ] boost;
  - [ ] collisione/scintille leggere.
- [ ] Texture procedurali:
  - [ ] color map;
  - [ ] normal map;
  - [ ] roughness/specular map dove utile.
- [ ] Almeno uno shader/materiale custom se utile e spiegabile.

## 11. Verifica

- [ ] `bun run build` passa.
- [ ] Dev server avviabile.
- [ ] Preview avviabile.
- [ ] Script `verify:scene` con Playwright.
- [ ] Verifica canvas non vuoto.
- [ ] Verifica nessun errore console grave.
- [ ] Verifica desktop.
- [ ] Verifica mobile.
- [ ] Verifica asset caricati.
- [ ] Verifica FPS accettabile.

## 12. Documentazione Finale

- [ ] README finale con:
  - [ ] descrizione progetto;
  - [ ] comandi install/build/run;
  - [ ] link GitHub Pages;
  - [ ] controlli;
  - [ ] feature principali.
- [ ] Relazione/manuale 5-10 pagine.
- [ ] Ambiente usato.
- [ ] Librerie usate.
- [ ] Asset esterni e licenze.
- [ ] Modelli gerarchici.
- [ ] Texture e materiali.
- [ ] Luci.
- [ ] Animazioni JS.
- [ ] Interazioni utente.
- [ ] AI e collisioni.
- [ ] Limitazioni note.
- [ ] Screenshot finali.

## 13. Performance, Polish E Ghost

- [ ] Documentare `docs/performance-polish.md`.
- [ ] Alleggerire mappe pesanti senza cambiare gameplay.
- [x] Aggiungere FPS in HUD per confrontare gli scatti tra piste.
- [x] Aggiungere toggle diagnostici `F1`-`F4` per minimap, ombre, props e renderer info.
- [x] Eliminare flash del placeholder su Porsche/Silvia.
- [ ] Indagare caricamento e tempo minimo overlay dei veicoli importati.
- [x] Migliorare leggibilita HUD, tempi e testi runtime.
- [x] Unificare HUD sinistra/destra in un pannello runtime piu pulito.
- [x] Alzare menu setup riducendo margine verticale senza ridurre il logo.
- [x] Correggere avanzamento checkpoint iniziale sul traguardo.
- [x] Aggiungere ghost del best lap in time trial.
  - [x] Storage/versioning dati ghost.
  - [x] Recorder campioni giro valido.
  - [x] Rendering veicolo ghost semi-trasparente.
  - [x] Interpolazione ghost sul tempo giro corrente.
