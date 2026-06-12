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

- ridurre il pixel ratio massimo del renderer se la scena e pesante;
- rendere configurabili shadow map e antialias;
- ridurre update o animazioni non essenziali lontane dal player;
- controllare props e materiali delle mappe che generano troppi draw call;
- evitare traversal o allocazioni inutili nel frame loop.

Verifica:

- provare Vegas Neon, Beach e Monaco;
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

Approccio pragmatico:

- registrare campioni leggeri durante il giro migliore:
  - tempo;
  - posizione;
  - heading;
- salvare il ghost in localStorage insieme alla chiave `trackId:vehicleId:mode`;
- caricare il ghost solo in `time-trial`;
- renderizzare un veicolo ghost semi-trasparente;
- interpolare il ghost in base al lap time corrente.

Non obiettivi:

- ghost perfettamente fisico;
- replay completo di input;
- ghost per race mode.

Verifica:

- fare un giro time trial e salvare il best;
- restartare sulla stessa pista e veicolo;
- vedere il ghost seguire il giro migliore;
- migliorare il best e verificare che il ghost venga aggiornato.

## Note Di Playtest

- [ ] Pista:
- [ ] Veicolo:
- [ ] Modalita:
- [ ] Problema osservato:
- [ ] Console errors:
- [ ] FPS/percezione:
