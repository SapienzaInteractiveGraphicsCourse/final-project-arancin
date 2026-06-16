import { Group, Tween } from "@tweenjs/tween.js";

const runtimeTweenGroup = new Group();

export function createRuntimeTween(target) {
  return new Tween(target, runtimeTweenGroup);
}

export function updateRuntimeTweens() {
  runtimeTweenGroup.update();
}

export function clearRuntimeTweens() {
  runtimeTweenGroup.removeAll();
}
