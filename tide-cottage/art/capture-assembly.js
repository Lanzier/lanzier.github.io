// Offline authoring entry only. The website never imports this module.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createIsland } from '../island.js';
import { createRoom } from '../room.js';
import { createFireplace } from '../fireplace.js';
import { COTTAGE } from '../cottage-plan.js';

function section(parent, name) {
  const group = new THREE.Group();
  group.name = name;
  parent.add(group);
  return group;
}

function groomScene(root, island, room, hearth) {
  const parts = root.children.slice();
  const terrain = section(root, 'Terrain and reefs');
  const meadow = section(root, 'Meadow and footpath');
  const woodland = section(root, 'Coastal trees and shrubs');
  const shore = section(root, 'Dock and rowboat');
  const outside = section(root, 'Garden and grounds');
  const house = island.roomMount.parent;
  house.name = 'Cottage shell';
  island.roomMount.name = 'Room foundation';
  island.door.name = 'Porch door';
  island.doorHinge.name = 'Door pivot';
  island.garden.name = 'Melon garden';
  room.contents.name = 'Cottage furnishings';
  hearth.name = 'Stone fireplace';
  const crownIndex = parts.findIndex(p => p.geometry?.name === 'Crown');
  const stem = parts[crownIndex - 1];
  for (const part of parts) {
    if (part === house) continue;
    if (part.material?.isMeshBasicMaterial && part.material.transparent) {
      root.remove(part);  // the chimney's animated smoke particles
    } else if (part.name === 'tidal-landscape' || part.material?.customProgramCacheKey() === 'coated-tidal-stone') {
      part.name = part.name || 'Reef formations';
      terrain.add(part);
    } else if (part === stem || ['Crown', 'Shrub'].includes(part.geometry?.name)) {
      part.name = part.geometry.name || 'Trunks and branches';
      woodland.add(part);
    } else if (part === island.garden) {
      outside.add(part);
    } else if (part.isGroup) {
      const bounds = new THREE.Box3().setFromObject(part);
      if (bounds.min.z > 6) {
        part.name = part.position.z > 8 ? 'Rowboat' : 'Timber dock';
        shore.add(part);
      } else {
        part.name = 'Laundry';
        outside.add(part);
      }
    } else if (part.geometry?.getAttribute('bladeHeight') || part.isInstancedMesh || part.material?.vertexColors) {
      meadow.add(part);
    } else {
      outside.add(part);
    }
  }

  for (const [index, fruit] of island.melons.entries()) fruit.name = 'Watermelon ' + (index + 1);
  return meadow;
}

function replaceBatch(batch, meadow, paints) {
  const basis = new THREE.Matrix4();
  const tint = new THREE.Color();
  const parent = batch.parent;
  const mergedFlowers = parent === meadow && batch.count > 120;
  const pieces = [];
  const group = section(parent, batch.name || batch.geometry.name || 'Linked parts');
  group.position.copy(batch.position);
  group.quaternion.copy(batch.quaternion);
  group.scale.copy(batch.scale);
  parent.remove(batch);
  for (let i = 0; i < batch.count; i++) {
    batch.getMatrixAt(i, basis);
    if (batch.instanceColor) batch.getColorAt(i, tint);
    else tint.setRGB(1, 1, 1);
    if (mergedFlowers) {
      const geo = batch.geometry.clone().applyMatrix4(basis);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let j = 0; j < colors.length; j += 3) tint.toArray(colors, j);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      pieces.push(geo);
    } else {
      const key = batch.material.uuid + '/' + tint.getHexString();
      if (!paints.has(key)) {
        const paint = batch.material.clone();
        paint.color.multiply(tint);
        paints.set(key, paint);
      }
      const copy = new THREE.Mesh(batch.geometry, paints.get(key));
      basis.decompose(copy.position, copy.quaternion, copy.scale);
      group.add(copy);
    }
  }
  if (pieces.length) {
    const material = batch.material.clone();
    material.vertexColors = true;
    group.add(new THREE.Mesh(mergeGeometries(pieces, false), material));
  }
}

window.saveAssembly = async () => {
  const scene = new THREE.Scene();
  const island = createIsland(THREE, scene, { wet: { value: 0 }, snow: { value: 0 } });
  const root = scene.children[0];
  root.name = 'Tide Cottage';
  const room = createRoom(THREE, island.roomMount);
  const fireplace = createFireplace(THREE, { flueHeight: COTTAGE.chimneyBaseY - COTTAGE.floorY + .08 });
  fireplace.group.position.set(COTTAGE.chimneyX, 0, COTTAGE.chimneyZ - COTTAGE.centerZ);
  room.contents.add(fireplace.group);
  fireplace.update(0, 1);
  const ground = root.getObjectByName('tidal-landscape');
  const timeout = performance.now() + 15000;
  while (!ground.userData.blenderMesh) {
    if (performance.now() > timeout) throw new Error('Detailed seabed was not available');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  scene.updateMatrixWorld(true);
  const meadow = groomScene(root, island, room, fireplace.group);
  const batches = [], lights = [];
  root.traverse(object => {
    if (object.isInstancedMesh) batches.push(object);
    if (object.isLight) lights.push(object);
    object.userData = {};
  });
  for (const light of lights) light.removeFromParent();
  const paints = new Map();
  for (const batch of batches) replaceBatch(batch, meadow, paints);
  const bytes = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
  const blob = new Blob([bytes], { type: 'model/gltf-binary' });
  const link = document.createElement('a');
  link.download = 'tide-cottage.glb';
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
