# Camera System Plan

Branch: `feature/camera-system`

Obiettivo: trasformare la camera attuale in un sistema dedicato, con piu modalita selezionabili e senza appesantire `startScenePreview.js`.

## Scope

La sezione 7 copre:

- follow camera dietro al veicolo;
- top/debug camera per vedere pista e posizione;
- driver/hood camera opzionale;
- free/orbit camera opzionale;
- cambio camera con `C`;
- camera shake leggero su collisione;
- resize corretto.

Non copre:

- minimappa;
- replay camera;
- cinematiche;
- post-processing;
- camera editor avanzato.

## Stato Attuale

`startScenePreview.js` contiene gia una follow camera:

- posizione dietro il veicolo;
- lerp della posizione camera;
- lerp del look target;
- resize prospettico.

Il problema e che la logica e dentro la scena. Per aggiungere piu camere conviene estrarla in un sistema dedicato.

## Strategia

Creare:

```text
src/systems/CameraController.js
```

Responsabilita:

- possedere la modalita camera corrente;
- aggiornare posizione e lookAt della camera;
- gestire cambio modalita;
- applicare shake quando richiesto;
- lasciare alla scena solo orchestration.

Firma prevista:

```js
const cameraController = new CameraController(camera, {
  initialMode: "follow"
});
```

Contratto previsto:

```js
cameraController.update(deltaTime, vehicleState, trackInfo, context)
cameraController.nextMode()
cameraController.setMode(mode)
cameraController.applyShake(intensity)
cameraController.resize(width, height)
cameraController.getState()
cameraController.dispose()
```

Modalita previste:

```js
"follow" | "top" | "hood" | "orbit"
```

## Milestone 1: Estrarre Follow Camera

- [x] Creare `CameraController`.
- [x] Spostare la logica follow da `startScenePreview.js`.
- [x] Mantenere comportamento visivo uguale.
- [x] Spostare resize camera nel controller.
- [x] Aggiornare `docs/contracts.md`.
- [x] Eseguire `bun run build`.
- [x] Eseguire `bun run verify:scene`.

Commit suggerito:

```text
extract follow camera controller
```

## Milestone 2: Cambio Camera Con C

- [ ] Usare `actions.camera` da `InputManager`.
- [ ] Aggiungere `nextMode()`.
- [ ] Mostrare modalita corrente nel debug/HUD solo se necessario.
- [ ] Verificare che `Esc`, `R` e `L` restino funzionanti.

Commit suggerito:

```text
add camera mode switching
```

## Milestone 3: Top Camera

- [ ] Aggiungere camera dall'alto.
- [ ] Seguire il player con altezza stabile.
- [ ] LookAt sul player.
- [ ] Utile per debug pista/checkpoint.

Commit suggerito:

```text
add top debug camera
```

## Milestone 4: Hood Camera

- [ ] Aggiungere hood/driver camera.
- [ ] Posizione davanti/sopra al veicolo.
- [ ] LookAt leggermente avanti rispetto al veicolo.
- [ ] Evitare compenetrazione evidente con il modello.

Commit suggerito:

```text
add hood camera mode
```

## Milestone 5: Orbit/Free Camera

- [ ] Aggiungere camera orbit semplificata.
- [ ] Mantenerla intorno al player.
- [ ] Non introdurre controlli mouse complessi se non necessari.
- [ ] Deve essere opzionale e non bloccare il gameplay.

Commit suggerito:

```text
add orbit camera mode
```

## Milestone 6: Camera Shake

- [ ] Usare `vehicleState.collided` o `environmentState.impact`.
- [ ] Shake leggero, breve e non fastidioso.
- [ ] Non usare shake in top camera se rende difficile testare.
- [ ] Verificare collisioni con barriere e AI.

Commit suggerito:

```text
add collision camera shake
```

## Verifica Manuale

- `C` cicla tra le modalita.
- Follow resta guidabile.
- Top mostra pista/player senza inclinazioni strane.
- Hood non e troppo bassa o dentro al veicolo.
- Orbit resta stabile.
- Collisione produce shake leggero.
- Resize finestra mantiene aspect corretto.
- Nessun errore console.

## Note

- Il cambio camera e gia previsto da `InputManager.consumeActions().camera`.
- La camera non deve conoscere DOM, HUD o logica gara.
- La scena deve passare al controller solo stato veicolo, `trackInfo` e contesto minimo.
- Camera shake e feedback visivo, non deve influenzare fisica o input.
