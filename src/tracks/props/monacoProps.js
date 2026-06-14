import * as THREE from "three";
import { attachPropsDisposer } from "./shared.js";
import { addMonacoLampPosts, addMonacoKerbs } from "./monaco/base.js";
import { addMonacoHillsideBuildings } from "./monaco/buildings.js";
import { addMonacoContinuousInnerGrandstands } from "./monaco/grandstands.js";
import { addMonacoOuterPort } from "./monaco/harbor.js";
import { addMonacoTracksideVisuals } from "./monaco/trackside.js";

function addMonacoLoopScenery(group, curve, definition) {
  addMonacoTracksideVisuals(group, curve, definition);
  addMonacoContinuousInnerGrandstands(group, curve, definition);
  addMonacoHillsideBuildings(group, curve, definition);
  addMonacoOuterPort(group, curve, definition);
}

export function buildMonacoProps(group, curve, definition) {
  const propsGroup = new THREE.Group();
  propsGroup.name = "MonacoProps";

  addMonacoLampPosts(propsGroup, curve, definition);
  addMonacoKerbs(propsGroup, curve, definition);
  addMonacoLoopScenery(propsGroup, curve, definition);

  group.add(propsGroup);
  attachPropsDisposer(group, propsGroup);
}
