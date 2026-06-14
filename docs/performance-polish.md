# Performance And Polish Plan

Questo branch raccoglie fix piccoli emersi dal playtest e una feature mirata per la modalita time trial.

Branch: `fix/performance-polish`

## Obiettivi

- Ridurre il lag sulle mappe piu pesanti.
- Evitare che Porsche e Silvia mostrino il veicolo placeholder prima del modello importato.
- Indagare il caricamento dei veicoli importati e decidere se mantenere, ridurre o rimuovere il tempo minimo dell'overlay.
- Migliorare leggibilita di HUD, tempi e testi runtime.
- Alzare il menu iniziale riducendo il margine verticale della grafica.
- Correggere piccoli problemi di race UX emersi dal playtest.
- Aggiungere ghost del best lap in time trial.

## Ordine Consigliato Dei Commit

### 1. Audit Prestazioni E Qualita Renderer

Scopo: alleggerire il gioco senza cambiare gameplay.

Interventi candidati:

- mostrare FPS in HUD per confrontare le piste durante il playtest;
- ridurre il pixel ratio massimo del renderer se la scena e pesante;
- rendere configurabili shadow map e antialias;
- ridurre update o animazioni non essenziali lontane dal player;
- controllare props e materiali delle mappe che generano troppi draw call;
- evitare traversal o allocazioni inutili nel frame loop.

Interventi completati:

- aggiunto indicatore FPS nel pannello HUD, campionato ogni mezzo secondo per evitare numeri instabili;
- rimosso l'update duplicato del detector contromano nel frame loop.
- aggiunti toggle diagnostici runtime:
  - `F1`: minimap on/off;
  - `F2`: shadow map/luci con ombre on/off;
  - `F3`: props decorativi della pista on/off;
  - `F4`: pannello debug con FPS, draw calls, triangoli, geometrie e texture.
- ridotti i draw call delle piste piu pesanti:
  - Tropical Beach: vegetazione ripetuta convertita in batch `InstancedMesh` low-poly;
  - Monaco Formula 1: yacht del porto convertiti da gruppi dettagliati singoli a batch istanziati;
- spostato il frame loop preview in `src/scene/preview/frameLoop.js`, lasciando `startScenePreview.js` piu concentrato sull'orchestrazione;
- migliorato il `dispose()` di piste, props e veicoli per deduplicare geometrie/materiali e liberare anche le texture collegate ai materiali.

Audit mesh/draw call dopo l'ottimizzazione:

| Pista | Mesh object | InstancedMesh | Istanze | Draw call stimate | Triangoli effettivi |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tropical Beach | ~1.612 | 12 | ~1.305 | ~1.612 | ~74k |
| Monaco Formula 1 | ~1.127 | 362 | ~31.788 | ~1.127 | ~985k |

Verifica:

- provare Vegas Neon e Tropical Beach, segnando FPS medio e microscatti percepiti;
- ripetere lo stesso tratto con `F1`, `F2` e `F3` per capire quale gruppo incide di piu;
- usare `F4` per confrontare draw calls e triangoli tra piste;
- controllare che non peggiori troppo la qualita visiva;
- verificare assenza errori console.

### 2. Loading Veicoli Importati

Scopo: eliminare il flash del placeholder con Porsche e Silvia.

Problema attuale:

- Porsche e Silvia estendono `PlaceholderVehicle`;
- il placeholder resta visibile finche il modello importato non e pronto;
- l'overlay loading copre quasi tutto, ma in alcuni casi il placeholder puo comunque apparire.

Interventi candidati:

- nascondere subito `placeholderObjects` per veicoli importati;
- mostrare il gruppo veicolo solo dopo `whenReady()`;
- usare un loading overlay breve e non artificiosamente lungo;
- mantenere il fallback placeholder solo se il modello fallisce.

Decisione implementata:

- Porsche e Silvia costruiscono ancora il placeholder come fallback tecnico;
- il placeholder viene nascosto subito nel costruttore;
- se il modello importato fallisce, il placeholder viene riattivato;
- il caricamento normale non mostra piu il veicolo provvisorio.

Verifica:

- selezionare Porsche e Silvia;
- controllare che non appaia il veicolo placeholder;
- controllare che in caso di errore loader esista ancora un fallback leggibile.

### 3. Caricamento E Cache Veicoli

Scopo: capire se il caricamento attuale e corretto o se produce attese/flash inutili.

Nota su `VEHICLE_LOADING_MIN_MS`:

- non velocizza il caricamento;
- impone solo una durata minima dell'overlay di loading;
- puo rendere la transizione piu stabile se il modello carica quasi subito;
- puo pero far sembrare piu lento il gioco se il modello e gia pronto;
- va tenuto solo se evita un effetto visivo brutto, non come soluzione al caricamento.

Interventi candidati:

- misurare se `VEHICLE_LOADING_MIN_MS` serve davvero;
- rimuovere o abbassare `VEHICLE_LOADING_MIN_MS` solo se migliora la percezione;
- pre-caricare il modello scelto durante la fase menu se non appesantisce troppo;
- assicurarsi che player e AI riusino lo stesso template caricato;
- non duplicare caricamenti identici.

Verifica:

- selezionare race con Porsche/Silvia, dove servono player e AI;
- controllare network/performance nel browser;
- verificare che restart e ritorno al menu non rompano la cache.

### 4. UI Runtime Piu Pulita

Scopo: rendere tempi e scritte piu leggibili.

Interventi candidati:

- ridurre gradienti neon sui testi dei tempi;
- preferire testo pieno con ombra leggera;
- rendere HUD e finish screen piu sobri;
- conservare `font-variant-numeric: tabular-nums` per evitare layout shift;
- controllare mobile e desktop.

Verifica:

- controllare HUD in movimento;
- verificare che posizione, lap, checkpoint, grip e best time siano nello stesso pannello;
- controllare countdown, pausa e finish screen;
- verificare che i tempi non spostino pannelli o colonne.

### 5. Menu Setup Piu Alto

Scopo: ridurre spazio morto sopra al menu e rendere la scelta piu immediata.

Interventi candidati:

- ridurre i margini verticali senza ridimensionare il logo;
- avvicinare pannello e carosello al centro alto;
- verificare viewport desktop e mobile.

Verifica:

- aprire menu su desktop;
- ridimensionare finestra;
- verificare che testo e immagini non si sovrappongano.

### 6. Checkpoint E Race UX

Scopo: sistemare problemi piccoli ma visibili emersi giocando.

Interventi completati:

- mantenere dinamico il numero totale di checkpoint in base alla pista;
- evitare che la start/finish line venga consumata subito come primo checkpoint alla partenza;
- mostrare checkpoint come rapporto semplice, per esempio `Checkpoint 1/5`;
- non mostrare label speciali tipo `Finish`, perche nelle gare a piu giri il traguardo e comunque un checkpoint della sequenza.

Verifica:

- Vegas Neon parte con `Checkpoint 1/5`;
- tagliare il traguardo iniziale non deve avanzare subito a `2/5`;
- dopo i checkpoint intermedi il traguardo deve essere mostrato come ultimo checkpoint;
- completare il giro deve incrementare il lap correttamente.

### 7. Ghost Best Lap Time Trial

Scopo: in time trial mostrare un ghost del miglior giro salvato per pista e veicolo.

Comportamento atteso:

- il ghost appare solo in modalita `time-trial`;
- il ghost appare solo se esiste gia un best lap salvato per quella combinazione pista/veicolo;
- durante il primo giro senza best salvato non si vede nessun ghost;
- dopo un nuovo best lap, al restart successivo il ghost usa il giro appena salvato;
- il ghost non ha collisioni, non influenza AI, checkpoint, contromano o posizione;
- il ghost deve essere visivamente riconoscibile ma non fastidioso:
  - materiale semi-trasparente;
  - colore freddo/azzurro o bianco;
  - opacita bassa;
  - niente luci, audio o effetti collisione.

Cosa segue:

- segue il percorso reale fatto dal player nel miglior giro salvato;
- non ricalcola fisica e non ripete input;
- interpola posizione e heading tra campioni temporali;
- se il player va piu forte, il ghost resta indietro;
- se il player va piu lento, il ghost scappa avanti;
- se il giro corrente supera la durata del ghost, il ghost resta sull'ultimo campione o viene nascosto fino al prossimo restart.

Dati da registrare:

- registrare campioni leggeri durante ogni giro valido:
  - tempo;
  - posizione;
  - heading;
- opzionale: speed, solo se serve per animazioni ruote;
- non salvare mesh, input o oggetti Three.js.

Formato candidato:

```js
{
  version: 1,
  trackId: "vegas",
  vehicleId: "kart",
  lapTime: 72.34,
  sampleRate: 10,
  samples: [
    { t: 0.0, x: 0, y: 0, z: 0, heading: 0 },
    { t: 0.1, x: 0.4, y: 0, z: 1.2, heading: 0.02 }
  ]
}
```

Chiave storage:

- usare una chiave separata dal best lap testuale, per esempio `${trackId}:${vehicleId}:time-trial:ghost`;
- non legarla al colore veicolo, cosi il ghost resta disponibile anche se si cambia colore;
- se cambia formato, incrementare `version` e ignorare ghost vecchi non compatibili.

Sampling:

- campionare a frequenza fissa, per esempio 10 Hz;
- non registrare ogni frame, per evitare localStorage troppo grande;
- registrare solo quando `RaceManager` e in fase `RUNNING`;
- iniziare dal passaggio valido sullo start;
- chiudere la registrazione quando il giro viene completato;
- salvare il ghost solo se il giro appena completato e anche nuovo best lap.

Rendering:

- creare un veicolo ghost separato dal player;
- usare lo stesso `vehicleId` del player per silhouette coerente;
- disattivare collisioni e input;
- nascondere il ghost se il modello non e ancora pronto;
- applicare materiali trasparenti clonati, senza modificare il veicolo reale;
- aggiornare transform del ghost in base al tempo del giro corrente.

Interpolazione:

- trovare i due campioni attorno al tempo corrente;
- interpolare posizione con lerp lineare;
- interpolare heading scegliendo la rotazione piu breve;
- se mancano campioni validi, nascondere il ghost invece di rompere la preview.

Divisione consigliata dei commit:

1. `add ghost lap storage helpers`
   - nuovo modulo per chiavi storage, read/write, validazione formato e versioning.
2. `record time trial ghost samples`
   - recorder leggero che campiona il player durante il giro e salva solo il nuovo best.
3. `render time trial ghost vehicle`
   - creazione veicolo ghost, materiali trasparenti, update interpolato.
4. `document and polish ghost behavior`
   - docs, piccoli ritocchi visivi, test manuali e cleanup.

Non obiettivi:

- ghost perfettamente fisico;
- replay completo di input;
- ghost per race mode.
- ghost multiplayer o confronto tra veicoli diversi;
- compressione avanzata dei campioni.

Verifica:

- fare un giro time trial e salvare il best;
- restartare sulla stessa pista e veicolo;
- vedere il ghost seguire il giro migliore;
- migliorare il best e verificare che il ghost venga aggiornato.
- cambiare veicolo e verificare che il ghost precedente non venga caricato;
- cambiare pista e verificare che il ghost precedente non venga caricato;
- race mode non deve mostrare nessun ghost;
- nessun errore console se localStorage contiene dati corrotti o vecchi.

## Note Di Playtest

- [ ] Pista:
- [ ] Veicolo:
- [ ] Modalita:
- [ ] Problema osservato:
- [ ] Console errors:
- [ ] FPS HUD:
- [ ] Percezione scatti:
