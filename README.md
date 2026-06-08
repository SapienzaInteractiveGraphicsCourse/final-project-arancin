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
- [ ] `feature/race-systems`: fisica, checkpoint, collisioni, AI.
- [ ] `feature/hud-minimap`: HUD e minimappa.
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
O
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
- [ ] Creare loader dedicato.
- [ ] Usare cache del modello caricato.
- [ ] Clonare modello per player e AI.
- [ ] Verificare scala.
- [ ] Verificare orientamento.
- [ ] Verificare origine/pivot.
- [ ] Correggere luci anteriori.
- [ ] Identificare o ricreare ruote animate.
- [ ] Applicare colore carrozzeria se possibile.
- [ ] Documentare fonte/licenza asset.

### Nissan Silvia

- [x] Importare asset FBX.
- [ ] Creare loader dedicato.
- [ ] Usare cache del modello caricato.
- [ ] Clonare modello per player e AI.
- [ ] Verificare scala.
- [ ] Verificare orientamento.
- [ ] Verificare origine/pivot.
- [ ] Correggere luci anteriori.
- [ ] Identificare o ricreare ruote animate.
- [ ] Applicare colore carrozzeria se possibile.
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

- [ ] Collisione player-barriere.
- [ ] Applicare correzione fisica ogni frame di intersezione.
- [ ] Cooldown solo per audio/penalita, non per risposta fisica.
- [ ] Spingere fuori dalla barriera lungo la normale.
- [ ] Ridurre/invertire velocita su impatto frontale.
- [ ] Annullare boost su impatto importante.
- [ ] Collisione player-bot.
- [ ] Separare posizioni player/bot.
- [ ] Penalita o feedback collisione.
- [ ] Rilevamento off-road.
- [ ] Rilevamento boost pad.

## 6. Gara E AI

- [ ] Race manager.
- [ ] Countdown iniziale.
- [ ] Checkpoint in ordine.
- [ ] Giri.
- [ ] Cronometro.
- [ ] Best lap.
- [ ] Classifica semplice player vs AI.
- [ ] Finish screen minimale.
- [ ] Restart gara.
- [ ] Avviso contromano:
  - [ ] progresso piu vicino su centerline;
  - [ ] heading pista da lookahead;
  - [ ] prodotto scalare con forward veicolo;
  - [ ] soglia temporale per evitare falsi positivi.
- [ ] AI opponent visibile.
- [ ] AI usa stesso veicolo selezionato dal player.
- [ ] Velocita AI dipendente dal veicolo.
- [ ] AI frena prima delle curve.
- [ ] AI accelera in uscita.
- [ ] AI segue traiettoria con offset laterale.
- [ ] AI competitiva ma battibile.

## 7. Camera

- [ ] Follow camera.
- [ ] Top/debug camera.
- [ ] Driver/hood camera opzionale.
- [ ] Free/orbit camera opzionale.
- [ ] Cambio camera con `C`.
- [ ] Camera shake leggero su collisione.
- [ ] Resize camera su finestra.

## 8. HUD, UI E Minimap

- [ ] Menu selezione pista.
- [ ] Menu selezione veicolo.
- [ ] Selezione colore veicolo.
- [ ] Pulsante start.
- [ ] HUD speed.
- [ ] HUD lap.
- [ ] HUD time.
- [ ] HUD checkpoint.
- [ ] HUD surface.
- [ ] HUD status/wrong way.
- [ ] HUD posizione/gap.
- [ ] Minimap canvas.
- [ ] Disegnare centerline su minimap.
- [ ] Marker player.
- [ ] Marker AI.
- [ ] Marker checkpoint/start.
- [ ] UI responsive.
- [ ] Evitare testo sovrapposto su mobile.

## 9. Audio

- [ ] Web Audio API.
- [ ] Motore continuo non invasivo.
- [ ] Volume master basso.
- [ ] Audio abilitato solo dopo gesto utente.
- [ ] Suono checkpoint.
- [ ] Suono countdown.
- [ ] Suono collisione.
- [ ] Suono boost.
- [ ] Toggle audio.

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
