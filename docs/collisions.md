# Collisions And Track Interaction Plan

Branch: `feature/collisions`

Obiettivo: collegare il controller arcade ai dati logici della pista, senza cambiare le factory e senza inserire logica di collisione dentro i veicoli.

## Scope

La sezione 5 copre:

- collisione player-barriere;
- correzione posizione fuori dalle barriere;
- riduzione velocita dopo impatto;
- rilevamento off-road;
- rilevamento boost pad;
- stato ambiente passato a `ArcadeVehicleController.update()`;
- predisposizione collisione player-AI.

Non copre ancora:

- audio collisione/boost;
- particelle;
- minimappa;
- fisica realistica avanzata;
- danni persistenti;
- AI avoidance, sorpassi e cambio traiettoria dinamico.

## Confine Con Fisica E AI

Il progetto usa una guida arcade. In questo branch non serve simulare una fisica realistica con massa, inerzia completa, gomme, sospensioni o risposta rigid-body. La collisione deve essere credibile e giocabile: il player non deve attraversare barriere o bot, deve essere spinto fuori dall'intersezione e deve perdere velocita quando urta.

Questa sezione quindi implementa:

- rilevamento intersezioni;
- correzione posizione;
- riduzione velocita dopo impatto;
- stato `collided` per HUD/audio/particelle future;
- separazione semplice tra player e AI se si sovrappongono.

Non implementa:

- modello fisico realistico;
- danni;
- rimbalzi accurati;
- traiettorie AI intelligenti;
- AI che frena, sterza o cambia linea per evitare fisicamente il player.

L'AI avoidance appartiene a un branch futuro di comportamento/tuning AI, ad esempio `feature/ai-tuning` o `feature/ai-behavior`. In `feature/collisions` possiamo solo predisporre lo stato necessario: se player e AI si toccano, il sistema segnala collisione e separa le posizioni in modo semplice. La decisione dell'AI di evitare il player prima dell'impatto resta fuori scope.

## Dati Disponibili

Le piste spline espongono gia:

```js
trackInfo.roadSegments
trackInfo.roadHalfWidth
trackInfo.centerline
trackInfo.boostPads
trackInfo.barrierColliders
```

I collider barriera hanno formato:

```js
{
  center,
  rotationY,
  halfLength,
  halfThickness
}
```

I boost pad hanno formato:

```js
{
  position,
  radius,
  heading
}
```

Il controller player accetta gia:

```js
{
  surfaceType,
  surfaceGrip,
  speedLimitMultiplier,
  boostFactor,
  collided
}
```

## Strategia

Creare un sistema dedicato:

```text
src/systems/TrackInteractionSystem.js
```

Il sistema riceve stato player, stato AI opzionale e `trackInfo`, poi restituisce un environment state per il frame corrente.

Firma prevista:

```js
trackInteraction.update(playerState, trackInfo, options) -> EnvironmentState
trackInteraction.reset()
```

Output previsto:

```js
{
  surfaceType,
  surfaceGrip,
  speedLimitMultiplier,
  boostFactor,
  collided,
  correction,
  impact
}
```

`correction` serve alla scena/controller per correggere la posizione quando il player entra in una barriera.

## Milestone 1: Sistema Base

- [x] Creare `TrackInteractionSystem`.
- [x] Gestire default robusti se `trackInfo` e incompleto.
- [x] Restituire asphalt/no collision quando mancano dati pista.
- [x] Collegare la scena sostituendo l'`environmentState` hardcoded.
- [x] Aggiornare `docs/contracts.md`.
- [x] Eseguire `bun run build`.

Commit suggerito:

```text
add track interaction system shell
```

## Milestone 2: Off-road

- [x] Calcolare progresso piu vicino su `centerline`.
- [x] Stimare distanza laterale dalla centerline.
- [x] Se distanza > `roadHalfWidth`, impostare `surfaceType` off-road.
- [x] Ridurre grip e speed limit fuori strada.
- [x] Esporre `surfaceType` utile per HUD futuro.
- [x] Verificare Vegas/Beach/Monaco.

Commit suggerito:

```text
detect off road surface
```

## Milestone 3: Boost Pad

- [x] Controllare distanza player-boost pad.
- [x] Applicare `boostFactor` solo quando il player entra nel raggio.
- [x] Aggiungere cooldown breve per evitare boost continuo troppo forte.
- [x] Annullare boost se il frame segnala impatto importante.
- [x] Verificare Beach e Monaco, dove i boost pad sono presenti.

Commit suggerito:

```text
apply track boost pads
```

## Milestone 4: Barriere

- [x] Implementare test punto vs oriented box 2D nel piano XZ.
- [x] Calcolare normale di espulsione dalla barriera.
- [x] Applicare correzione posizione ogni frame di intersezione.
- [x] Segnalare `collided`.
- [x] Ridurre velocita quando l'impatto e frontale o laterale forte.
- [x] Evitare cooldown sulla risposta fisica.
- [ ] Usare cooldown solo per eventuali feedback futuri.

Commit suggerito:

```text
resolve player barrier collisions
```

## Milestone 5: Player vs AI

- [x] Aggiungere collisione semplificata sfera player-AI.
- [x] Separare player e AI quando si sovrappongono.
- [x] Segnalare impatto nello stato ambiente.
- [x] Mantenere la classifica race invariata.
- [x] Non rendere l'AI instabile o bloccata dal player.

Commit suggerito:

```text
prepare player ai collision response
```

## Verifica Manuale

- Vegas: urtare barriere e controllare che il player venga spinto fuori.
- Beach: uscire strada e verificare grip ridotto.
- Beach/Monaco: attraversare boost pad e verificare accelerazione.
- Race: urtare AI senza rompere lap/checkpoint/position.
- Time Trial: collisioni e boost devono funzionare anche senza AI.
- Console: nessun errore.

## Note Di Integrazione

- La scena deve restare l'orchestratore: legge sistemi, aggiorna controller, renderizza.
- `ArcadeVehicleController` non deve conoscere direttamente `trackInfo`.
- I veicoli non devono conoscere collisioni.
- Le piste devono continuare a esporre dati logici, non sistemi runtime.
- Se serve una correzione posizione, meglio introdurre un metodo piccolo nel controller invece di manipolare mesh e stato fisico in punti diversi.
