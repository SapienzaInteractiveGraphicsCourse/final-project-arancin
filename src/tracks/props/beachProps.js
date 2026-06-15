import * as THREE from "three";
import { attachPropsDisposer, optimizeStaticDecorativeProps } from "./shared.js";
import { addBeachSeagullFlock } from "./beach/birds.js";
import { addBeachClouds } from "./beach/clouds.js";
import { addBeachGround, addBeachOceanPlane } from "./beach/ocean.js";
import { addBeachPeople } from "./beach/people.js";
import { addBeachHutsStrict, addBeachUmbrellasStrict } from "./beach/structures.js";
import { addBeachTropicalPlants } from "./beach/vegetation.js";

export function buildBeachProps(group, curve, trackDef) {
  const propsGroup = new THREE.Group();
  propsGroup.name = "TropicalBeachProps";

  addBeachGround(propsGroup);
  addBeachOceanPlane(propsGroup, curve, trackDef);
  addBeachClouds(propsGroup);
  addBeachSeagullFlock(propsGroup);
  addBeachTropicalPlants(propsGroup, curve, trackDef);
  addBeachHutsStrict(propsGroup, curve, trackDef);
  addBeachUmbrellasStrict(propsGroup, curve, trackDef);
  addBeachPeople(propsGroup, curve, trackDef);

  optimizeStaticDecorativeProps(propsGroup, [
    "TropicalBeachPropsGround",
    "TropicalBeachOceanShore",
    "TropicalBeachOceanSurf"
  ]);

  group.add(propsGroup);
  attachPropsDisposer(group, propsGroup);
}
