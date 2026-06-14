# Vehicle Feature Commit Plan

Questa nota serve come riferimento operativo per dividere la sezione veicoli in commit piccoli, leggibili e facili da verificare.

L'obiettivo non e' produrre una storia artificiale, ma rendere ogni passaggio comprensibile durante revisione, debug e discussione con il professore. Ogni commit dovrebbe rappresentare una scelta tecnica precisa che il team sa spiegare.

## Regole Generali

- Fare commit solo quando la milestone e' stata provata localmente e approvata dal team.
- Non mischiare refactor, documentazione, asset e gameplay nello stesso commit se possono stare separati.
- Tenere i messaggi di commit concreti, per esempio `add shared vehicle performance config`.
- Evitare commit enormi che introducono base class, factory, kart, loader e documentazione insieme.
- Prima di ogni commit controllare `git status --short` e verificare quali file verranno inclusi.
- Prima di chiedere merge o review eseguire almeno `bun run build`.
- Se una verifica browser non puo essere eseguita, annotare chiaramente il motivo.

## Scope Completo Della Sezione Veicoli

Questa pianificazione copre tutto il lavoro assegnato sulla sezione 2 del README:

- interfaccia comune dei veicoli;
- factory veicoli;
- dati performance separati dalla fisica;
- kart procedurale completo;
- loader Porsche GLB;
- loader Nissan Silvia FBX;
- verifica scala, orientamento, pivot, fari, ruote e colore;
- aggiornamento documentazione asset.

Gli asset Porsche e Nissan Silvia sono gia stati importati. Questa feature deve usarli correttamente, non reimportarli.

## Ordine Consigliato Per La Sezione Veicoli

### 1. Performance Data

Scopo: separare i dati fisici dei veicoli dalla logica del controller.

Possibili file:

- `src/config/vehiclePerformance.js`
- `docs/contracts.md`

Contenuto atteso:

- performance per `kart`, `porsche`, `silvia`;
- valori completi compatibili con `ArcadeVehicleController`;
- ordine velocita massima `Porsche > Silvia > Kart`;
- nessun cambio visivo importante.

Verifica:

- `bun run build`;
- controllo manuale che la preview parta ancora con tutti e tre i veicoli.

Commit suggerito:

```text
add shared vehicle performance config
```

### 2. Base Vehicle Contract

Scopo: introdurre una classe comune che renda esplicita l'interfaccia richiesta dalla guida.

Possibili file:

- `src/vehicles/BaseVehicle.js`
- `docs/contracts.md`

Contenuto atteso:

- `group`;
- `performance`;
- `setTransform(position, heading)`;
- `update(deltaTime, state)`;
- `setBodyColor(color)`;
- `setHeadlights(enabled)`;
- `toggleHeadlights()`;
- `dispose()`.

Verifica:

- `bun run build`;
- controllo che il contratto non cambi la firma di `createVehicleById(vehicleId)`.

Commit suggerito:

```text
add base vehicle contract
```

### 3. Factory Cleanup

Scopo: far usare alla factory la nuova base class senza introdurre ancora modelli completi.

Possibili file:

- `src/vehicles/vehicleFactory.js`
- eventuali classi placeholder in `src/vehicles/`

Contenuto atteso:

- `createVehicleById(vehicleId)` resta stabile;
- i tre veicoli sono ancora selezionabili;
- i placeholder espongono tutti i metodi del contratto;
- la preview continua a usare solo la factory.

Verifica:

- `bun run build`;
- selezione manuale di Kart, Porsche e Silvia dal menu.

Commit suggerito:

```text
wire vehicle factory to shared contract
```

### 4. Placeholder Vehicles Split

Scopo: preparare tre classi leggere, una per veicolo, mantenendo ancora geometrie semplici.

Possibili file:

- `src/vehicles/KartVehicle.js`
- `src/vehicles/PorscheVehicle.js`
- `src/vehicles/SilviaVehicle.js`
- `src/vehicles/vehicleFactory.js`

Contenuto atteso:

- Kart, Porsche e Silvia hanno classi separate;
- ogni classe estende o usa la base comune;
- i tre veicoli usano performance corrette;
- nessun loader importato ancora;
- la factory resta il punto unico di creazione.

Verifica:

- `bun run build`;
- prova manuale della selezione dei tre veicoli.

Commit suggerito:

```text
split placeholder vehicle classes
```

### 5. Procedural Kart Chassis

Scopo: iniziare il kart procedurale con gerarchia minima, senza completare tutte le animazioni.

Possibili file:

- `src/vehicles/KartVehicle.js`
- eventuali helper materiali/geometrie in `src/vehicles/` o `src/materials/`

Contenuto atteso:

- root group;
- telaio;
- carrozzeria;
- sedile;
- assi;
- quattro ruote;
- materiali coerenti;
- nessun loader esterno.

Verifica:

- `bun run build`;
- prova manuale in preview con `kart`.

Commit suggerito:

```text
add procedural kart hierarchy
```

### 6. Procedural Kart Details

Scopo: completare le parti visive richieste per il kart team-authored.

Possibili file:

- `src/vehicles/KartVehicle.js`

Contenuto atteso:

- volante;
- pilota opzionale, se il tempo lo permette;
- fari;
- mozzi o dettagli ruote;
- materiali con roughness/metalness coerenti;
- colore carrozzeria modificabile.

Verifica:

- `bun run build`;
- ispezione manuale del kart nella preview.

Commit suggerito:

```text
add procedural kart details
```

### 7. Kart Controls And Animation

Scopo: collegare il kart allo stato fisico gia esistente.

Possibili file:

- `src/vehicles/KartVehicle.js`

Contenuto atteso:

- ruote animate con `distanceThisFrame`;
- ruote anteriori sterzanti;
- volante animato;
- possibile oscillazione telaio/sospensioni;
- `setHeadlights` e `toggleHeadlights`.

Verifica:

- `bun run build`;
- guida manuale con accelerazione, sterzo, freno e toggle luci.

Commit suggerito:

```text
animate procedural kart controls
```

### 8. Porsche Loader Preparation

Scopo: introdurre il loader dedicato Porsche senza chiudere subito tutti i dettagli visivi.

Possibili file:

- `src/vehicles/PorscheVehicle.js`
- `src/vehicles/loaders/loadPorscheModel.js`
- eventuali helper condivisi in `src/vehicles/loaders/`

Contenuto atteso:

- caricamento GLB con `GLTFLoader`;
- cache loader-level del modello caricato;
- clone del template per ogni istanza;
- fallback semplice se il modello e' in caricamento o fallisce;
- niente animation clip importate.

Verifica:

- `bun run build`;
- prova manuale selezionando Porsche.

Commit suggerito:

```text
add cached Porsche model loader
```

### 9. Porsche Model Fit And Controls

Scopo: rendere il modello Porsche utilizzabile in preview e pronto per player/AI.

Possibili file:

- `src/vehicles/PorscheVehicle.js`
- eventuali helper in `src/vehicles/`

Contenuto atteso:

- scala verificata;
- orientamento verificato;
- origine/pivot coerente con `setTransform`;
- fari anteriori JavaScript o materiale emissive gestito;
- ruote identificate o ricreate proceduralmente;
- colore carrozzeria applicabile se il materiale lo consente;
- clone indipendente per player e istanze future AI.

Verifica:

- `bun run build`;
- prova manuale con accelerazione, sterzo, reset e luci;
- controllo visivo di scala rispetto a ground/camera.

Commit suggerito:

```text
fit Porsche model and controls
```

### 10. Silvia Loader Preparation

Scopo: introdurre il loader dedicato Nissan Silvia senza chiudere subito tutti i dettagli visivi.

Possibili file:

- `src/vehicles/SilviaVehicle.js`
- `src/vehicles/loaders/loadSilviaModel.js`
- eventuali helper condivisi in `src/vehicles/loaders/`

Contenuto atteso:

- caricamento FBX con `FBXLoader`;
- resource path per texture;
- cache loader-level del modello caricato;
- clone del template per ogni istanza;
- fallback semplice se il modello e' in caricamento o fallisce;
- niente animation clip importate.

Verifica:

- `bun run build`;
- prova manuale selezionando Silvia.

Commit suggerito:

```text
add cached Silvia model loader
```

### 11. Silvia Model Fit And Controls

Scopo: rendere il modello Silvia utilizzabile in preview e pronto per player/AI.

Possibili file:

- `src/vehicles/SilviaVehicle.js`
- eventuali helper in `src/vehicles/`

Contenuto atteso:

- scala verificata;
- orientamento verificato;
- origine/pivot coerente con `setTransform`;
- fari anteriori JavaScript o materiale emissive gestito;
- ruote identificate o ricreate proceduralmente;
- colore carrozzeria applicabile se il materiale lo consente;
- clone indipendente per player e istanze future AI.

Verifica:

- `bun run build`;
- prova manuale con accelerazione, sterzo, reset e luci;
- controllo visivo di scala rispetto a ground/camera.

Commit suggerito:

```text
fit Silvia model and controls
```

### 12. Shared Imported Vehicle Helpers

Scopo: estrarre duplicazioni reali emerse dopo Porsche e Silvia, senza anticipare astrazioni inutili.

Possibili file:

- `src/vehicles/importedVehicleUtils.js`
- `src/vehicles/PorscheVehicle.js`
- `src/vehicles/SilviaVehicle.js`

Contenuto atteso:

- helper comuni per dispose sicuro;
- helper comuni per shadow/material traversal;
- helper comuni per wheel pivots solo se entrambi i modelli ne beneficiano;
- nessun cambio di comportamento previsto.

Verifica:

- `bun run build`;
- prova rapida Porsche e Silvia.

Commit suggerito:

```text
extract imported vehicle helpers
```

### 13. Asset Documentation

Scopo: aggiornare la documentazione degli asset esterni usati dai veicoli.

Possibili file:

- `docs/asset-register.md`
- eventuali note in `src/assets/models/vehicles/README.md`

Contenuto atteso:

- fonte e licenza Porsche, se disponibili;
- fonte e licenza Silvia, se disponibili;
- stato integrazione aggiornato;
- note su texture, modelli e limiti conosciuti;
- kart indicato come asset team-authored/procedurale.

Verifica:

- revisione manuale della documentazione;
- nessun build necessario se cambia solo documentazione, salvo richiesta del team.

Commit suggerito:

```text
document vehicle assets
```

### 14. README And Contracts Update

Scopo: segnare le checkbox completate e aggiornare i contratti pubblici solo quando il comportamento e' stabile.

Possibili file:

- `README.md`
- `docs/contracts.md`
- `docs/vehicle-commit-plan.md`, se il piano cambia durante il lavoro

Contenuto atteso:

- checkbox completate solo per funzionalita realmente verificate;
- contratto vehicle aggiornato con eventuali campi aggiuntivi come `wheelRollGroups`, `frontSteeringPivots`, `wheelRadius`;
- note chiare su cio che resta futuro.

Verifica:

- `bun run build` se nello stesso passaggio ci sono modifiche codice;
- revisione manuale delle checkbox.

Commit suggerito:

```text
update vehicle documentation status
```

## Criteri Per Decidere Quando Committare

Un commit e' pronto quando:

- ha uno scopo descrivibile in una frase;
- non contiene file non collegati alla milestone;
- il progetto compila;
- il comportamento modificato e' stato provato almeno manualmente;
- il team sa spiegare perche' quei file sono cambiati insieme.

Un commit e' troppo grande quando:

- cambia molti sistemi contemporaneamente;
- corregge bug non collegati senza separarli;
- aggiorna documentazione e gameplay in modo difficile da distinguere;
- richiede una lunga spiegazione per capire il filo logico.

## Note Per La Revisione

Durante la revisione conviene descrivere:

- quale requisito della guida viene coperto;
- quali file sono stati toccati;
- come e' stata verificata la modifica;
- quali parti restano intenzionalmente future.

Per la sezione veicoli, e' normale lasciare placeholder intermedi se il contratto resta stabile e il passaggio successivo e' chiaro.
