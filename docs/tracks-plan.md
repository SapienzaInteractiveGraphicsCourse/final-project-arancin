# Tracks Plan

Piano di lavoro per `feature/tracks`.

Questa feature implementa il sistema piste del simulatore ufficiale, usando `kartprivata` solo come riferimento tecnico. Non copiare file interi: i moduli vanno riscritti in modo coerente con questa repository e con i contratti in `docs/contracts.md`.

## Direzione Artistica

Tutte le piste devono seguire un look low-poly arcade moderno, ispirato a giochi come Horizon Chase Turbo e Art of Rally.

Regole visive:

- usare geometrie semplici e leggibili;
- preferire tinte piatte a texture pesanti;
- usare `THREE.MeshStandardMaterial` o materiali simili con `flatShading: true`;
- usare roughness/metalness semplici e coerenti con il tema;
- usare emissive material per neon, tunnel, boost pad e luci pista;
- mantenere il target mentale di 60 FPS stabili;
- evitare canvas texture/noise pesanti nella prima implementazione;
- differenziare le piste tramite layout, props, luci e palette, non solo con colori diversi.

## Strategia Di Sviluppo

Le piste vanno completate una alla volta. Prima si crea la struttura comune per tutte e tre, poi si finisce una pista prima di passare alla successiva.

Ordine previsto:

1. Struttura dati/generatore comune per tutte le piste.
2. Vegas Neon completa.
3. Tropical Beach completa.
4. Monaco Formula 1 completa.
5. Rifinitura e verifica finale.

Ogni step deve essere piccolo e verificabile. Evitare un commit unico grande.

## Decisioni Tecniche

Le piste della prima versione sono planari: il percorso logico vive sul piano XZ e la quota Y della strada resta costante. Questa scelta mantiene semplici fisica arcade, collisioni 2D, AI, checkpoint e minimappa.

Regole:

- i punti dati possono restare in formato `[x, y, z]`, ma `y` deve essere `0` per la strada;
- la tangente laterale puo usare `curve.getTangentAt(t).setY(0).normalize()` perche il circuito e volutamente piatto;
- saliscendi, dune guidabili, banking e ponti sono rimandati a una fase futura;
- se in futuro si introducono saliscendi, il generatore dovra usare `curve.computeFrenetFrames()` o un sistema equivalente per calcolare normali/binormali coerenti.

Props e decorazioni possono invece usare quote Y diverse, per esempio palme, palazzi, tribune, lampioni, archi neon e yacht.

## File Previsti

Struttura proposta:

```text
src/tracks/
  centerline.js
  trackData.js
  trackFactory.js
  trackMaterials.js
  splineTrackGenerator.js
  props/
    index.js
    shared.js
    common/
      geometry.js
      instancing.js
      materials.js
      placement.js
      ribbons.js
    vegasProps.js
    vegas/
      billboards.js
      lights.js
      skyline.js
      trackside.js
      venue.js
    beachProps.js
    beach/
      clouds.js
      common.js
      ocean.js
      people.js
      plants.js
      structures.js
      vegetation.js
    monacoProps.js
    monaco/
      base.js
      buildings.js
      common.js
      constants.js
      flags.js
      grandstands.js
      harbor.js
      trackside.js
```

Responsabilita:

- `trackData.js`: definizioni pure delle piste, senza mesh Three.js complesse oltre ai punti dati.
- `centerline.js`: campionamento centerline, bounds minimappa, progress/heading helper futuri.
- `trackMaterials.js`: materiali low-poly flat condivisi.
- `splineTrackGenerator.js`: genera strada, terreno, checkpoint, boost pad, barriere e `trackInfo`.
- i builder props sono importati direttamente dalla factory, senza barrel intermedio.
- `props/`: props low-poly divisi per tema; `shared.js` contiene helper geometrici, random deterministico, shadow/dispose e ottimizzazione props.
- `props/common/`: primitive riusabili tra piste per materiali props, placement su spline, instancing, ribbon mesh e merge geometrie.
- `props/vegas/`: sotto-moduli per segnaletica, luci decorative, skyline/landmark, props trackside e venue F1 di Vegas, per evitare che `vegasProps.js` torni monolitico.
- `props/beach/`: sotto-moduli per oceano/terreno, vegetazione, persone, strutture, nuvole e helper comuni Beach.
- `props/monaco/`: sotto-moduli per base pista, edifici, tribune, porto/yacht, bandiere e dettagli trackside Monaco.
- `trackFactory.js`: entry point pubblico `createTrackById(trackId)`.

Il contratto di `trackFactory.js` non deve cambiare:

```js
createTrackById(trackId) -> {
  group,
  spawn,
  trackInfo,
  dispose()
}
```

## Dati Minimi Pista

Ogni pista deve definire:

```js
{
  id,
  name,
  themeId,
  controlPoints,
  curveType,
  tension,
  roadWidth,
  segments,
  groundSize,
  checkpointTs,
  boostTs,
  spawnOffsetMeters,
  lightingMode,
  skyboxTheme,
  particleProfile,
  palette
}
```

`controlPoints` usa coordinate `[x, y, z]` e genera una `THREE.CatmullRomCurve3` chiusa.

Per la prima versione, `y` deve restare `0` su tutti i punti della strada.

## TrackInfo Atteso

Il generatore deve salvare:

```js
{
  id,
  name,
  spawn,
  roadSegments,
  roadHalfWidth,
  centerline,
  checkpoints,
  boostPads,
  barrierColliders,
  minimapBounds,
  lightingMode,
  skyboxTheme,
  particleProfile
}
```

Campi per integrazioni future:

- `roadSegments`: fisica/off-road e clamp futuro.
- `centerline`: minimappa, AI e contromano.
- `checkpoints`: race manager.
- `boostPads`: collision/boost system.
- `barrierColliders`: collisioni player-barriere.
- `minimapBounds`: HUD/minimappa.

## Generazione Strada

La strada viene generata campionando la spline:

1. campionare `segments + 1` punti con `curve.getPointAt(t)`;
2. calcolare tangente orizzontale con `curve.getTangentAt(t).setY(0).normalize()`, coerentemente con piste planari;
3. calcolare vettore laterale destro;
4. generare due vertici per sample, left/right;
5. triangolare la strip;
6. salvare UV basate sulla distanza cumulativa lungo la curva;
7. calcolare normali;
8. generare `roadSegments` logici.

Le coordinate UV devono usare la lunghezza reale del tratto campionato, non solo `t` o l'indice del segmento. Questo evita stretching nelle zone con punti di controllo piu densi:

```js
v = cumulativeDistance / uvScale
```

La strada deve chiudersi senza buchi nel loop:

- il sample finale deve combaciare con quello iniziale;
- indici, tangenti e normali al seam devono restare coerenti;
- il segmento logico finale deve collegare correttamente l'ultimo sample al primo;
- le barriere devono chiudersi senza lasciare aperture involontarie.

Materiale strada:

- flat shading obbligatorio;
- asfalto scuro o tema-specifico;
- niente texture pesanti nel primo passaggio;
- eventuali linee o curbs come mesh geometriche, non texture.

## Terreno

Il terreno base viene generato come piano orizzontale sotto la strada:

```js
new THREE.PlaneGeometry(groundSize, groundSize)
```

Regole:

- il piano va ruotato su X per stare nel piano XZ;
- il materiale deve essere flat, a tinta piatta e specifico per tema;
- Vegas usa un ground scuro urbano;
- Tropical usa sabbia dorata, con eventuale mare turchese come geometria separata;
- Monaco usa un ground urbano chiaro/grigio;
- il terreno non deve sostituire la logica della strada: off-road, minimappa e AI devono usare `roadSegments` e `centerline`.

## Barriere

Le barriere devono seguire entrambi i bordi della strada.

Ogni segmento barriera deve produrre un collider:

```js
{
  center,
  rotationY,
  halfLength,
  halfThickness
}
```

Regole:

- usare segmenti corti abbastanza da seguire le curve;
- barriere visuali low-poly con box/prismi;
- su Monaco posizionarle molto vicine alla pista;
- su Vegas aggiungere bordi emissivi;
- su Beach usare barriere leggere o cordoli bassi dove coerente.

## Checkpoint

Requisiti:

- checkpoint `0` = start/finish;
- checkpoint successivi dividono il giro in settori;
- attraversano tutta la larghezza strada;
- hanno dato logico e indicatore visivo.

Formato previsto:

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

## Boost Pad

Requisiti:

- posizionati tramite `boostTs`;
- brevi e controllabili;
- visual low-poly/emissive;
- dato logico con posizione, raggio e heading.

Formato previsto:

```js
{
  position,
  radius,
  heading
}
```

## Vegas Neon

Stato finale richiesto:

- layout non ovale;
- curve a destra e sinistra;
- chicane;
- rettilineo veloce;
- atmosfera notturna cyberpunk;
- asfalto scuro flat;
- neon rosa, cyan, giallo e verde;
- bordi strada emissivi;
- tunnel con archi/anelli geometrici animabili;
- grattacieli stilizzati ai lati;
- finestre olografiche o pannelli emissivi;
- luci coerenti con notte.

Checklist prima di passare a Tropical:

- `bun run build` passa;
- pista selezionabile dal menu;
- preview mostra strada non ovale;
- `trackInfo.centerline` popolata;
- `trackInfo.minimapBounds` sensato;
- checkpoint e boost presenti;
- `barrierColliders` presenti;
- nessun materiale 3D nuovo senza `flatShading: true`, salvo materiali emissive/linee dove tecnicamente non rilevante.

## Tropical Beach

Stato finale richiesto:

- layout non ovale;
- curve a destra e sinistra;
- S veloci o chicane;
- almeno un tornante/curva lenta;
- cielo diurno;
- illuminazione calda;
- sabbia dorata e mare turchese a blocchi;
- palme geometriche low-poly;
- props essenziali coerenti;
- dati per particelle sabbia off-road tramite `particleProfile: "sand"`.

Checklist prima di passare a Monaco:

- build passa;
- pista distinguibile da Vegas per layout e atmosfera;
- palme e mare non invadono la strada;
- `trackInfo` completo;
- curve lente e veloci presenti.

## Monaco Formula 1

Stato finale richiesto:

- circuito cittadino molto stretto;
- curve lente a 90 gradi;
- chicane;
- tornante iconico;
- rettilineo breve;
- look tecnico e soleggiato;
- cordoli tridimensionali bianchi e rossi;
- barriere vicine alla carreggiata;
- tribune a gradoni low-poly;
- lampioni poligonali;
- forme base che richiamano yacht ormeggiati.

Checklist finale:

- build passa;
- pista riconoscibile come cittadina stretta;
- non sembra una pista larga generica;
- `trackInfo` completo;
- barriere vicine ma non impossibili da guidare.

## Commit Piccoli Consigliati

Commit suggeriti:

1. `docs: document track implementation plan`
2. `add track data and centerline helpers`
3. `add low poly spline road generator`
4. `add track barriers checkpoints and boosts`
5. `build complete vegas neon track`
6. `build complete tropical beach track`
7. `build complete monaco track`
8. `polish track factory disposal and verification`

Ogni commit di runtime deve essere accompagnato almeno da:

```bash
bun run build
```

Quando possibile:

```bash
bun run verify:scene
```

## Decisioni Aperte

Prima di scrivere codice runtime, decidere:

- se nel primo commit tecnico inserire solo dati vuoti/struttura o anche layout reali delle tre piste;
- quanti checkpoint usare per ogni pista, oltre allo start;
- quanti boost pad usare nella prima versione;
- se introdurre subito props animabili o lasciare `animatedObjects` per un secondo passaggio;
- se aggiornare lo script `verify:scene` per evitare blocchi su porta fissa `4177`.
