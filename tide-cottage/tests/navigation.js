// Browser-only test entry. Construct the same geometry, pivots and activity system as the website.
import * as THREE from 'three';
import { COTTAGE, DOORWAY, advanceDoor } from '../cottage-plan.js';
import { createIsland } from '../island.js';
import { createRoom } from '../room.js';
import { createFireplace } from '../fireplace.js';
import { createActivities } from '../activities.js';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function cottage() {
  const scene = new THREE.Scene();
  const island = createIsland(THREE, scene, { snow: { value: 0 }, wet: { value: 0 } });
  const room = createRoom(THREE, island.roomMount);
  const hearth = createFireplace(THREE, { flueHeight: COTTAGE.chimneyBaseY - COTTAGE.floorY + .08 }).group;
  hearth.position.set(COTTAGE.chimneyX, 0, COTTAGE.chimneyZ - COTTAGE.centerZ);
  room.contents.add(hearth);
  scene.updateMatrixWorld(true);
  return { island, room, hearth, scene };
}

function simulation({ scene, island, room, hearth }, dt = .05) {
  const activities = createActivities(THREE, scene, island, room, hearth);
  let time = 0, angle = 0, state = activities.update(0, angle);
  return {
    activities,
    get state() { return state; },
    get angle() { return angle; },
    step(cameraRequest = false) {
      time += dt;
      state = activities.update(time, angle);
      angle = advanceDoor(angle, state.doorOpen || cameraRequest, Math.min(.25, dt));
      return state;
    },
    until(match) {
      const end = time + 80;
      while (time < end) if (match(this.step())) return;
      throw new Error('Unreachable activity: ' + JSON.stringify([state.activity, state.retry, state.position.toArray()]));
    },
  };
}

function dailyActivities() {
  const sim = simulation(cottage());
  const arrived = new Set();
  for (let i = 0; i < 6000; i++) {
    const state = sim.step();
    check(!state.retry, 'Default layout cannot reach ' + state.retry);
    if (!state.moving && state.activity !== 'idle') arrived.add(state.activity);
  }
  check(['eat', 'warm', 'sleep', 'harvest', 'fish'].every(name => arrived.has(name)), 'Incomplete daily schedule');
  return [...arrived];
}

function doorClearance() {
  const model = cottage();
  const { island } = model;
  const shapes = [];
  island.door.traverse(part => {
    if (!part.isMesh) return;
    part.geometry.computeBoundingBox();
    for (let i = 0; i < (part.isInstancedMesh ? part.count : 1); i++) {
      const matrix = new THREE.Matrix4();
      if (part.isInstancedMesh) part.getMatrixAt(i, matrix);
      const box = part.geometry.boundingBox.clone().applyMatrix4(matrix.premultiply(part.matrixWorld));
      if (box.max.y > COTTAGE.floorY + .07 && box.min.y < COTTAGE.floorY + 1.30) {
        shapes.push({ box, swings: part.parent === island.doorHinge });
      }
    }
  });
  check(shapes.some(p => p.swings) && shapes.some(p => !p.swings), 'Missing moving or fixed doorway geometry');
  // Measured walking-atlas half-width 0.5407m, with an extra texel for filtering.
  const radius = .548, hinge = island.doorHinge.position;
  function margin(x, z, angle) {
    const dx = x - hinge.x, dz = z - hinge.z;
    const localX = hinge.x + dx * Math.cos(angle) - dz * Math.sin(angle);
    const localZ = hinge.z + dx * Math.sin(angle) + dz * Math.cos(angle);
    let nearest = Infinity;
    for (const { box, swings } of shapes) {
      const px = swings ? localX : x, pz = swings ? localZ : z;
      nearest = Math.min(nearest, Math.hypot(Math.max(0, box.min.x - px, px - box.max.x),
        Math.max(0, box.min.z - pz, pz - box.max.z)));
    }
    return nearest - radius;
  }
  let clear = Infinity;
  for (let i = 0; i <= 120; i++) {
    const angle = -DOORWAY.openAngle * i / 120;
    for (const z of [DOORWAY.interiorWaitZ, DOORWAY.exteriorWaitZ]) {
      check(margin(DOORWAY.centerX, z, angle) > .05, 'Swing intersects waiting character');
    }
  }
  for (const dt of [1 / 60, .10, .30, .75]) {
    const sim = simulation(model, dt);
    sim.activities.request('eat');
    let crossings = 0, waits = 0;
    for (let frame = 0; frame * dt < 180 && crossings < 6; frame++) {
      const previous = sim.state.position.clone(), before = sim.angle, mode = sim.state.sceneMode;
      const state = sim.step(frame * dt % 4.9 < .72);
      if (state.waitingAtDoor) waits++;
      if (state.sceneMode !== mode) {
        check(before <= -DOORWAY.passAngle, 'Character crossed before door opened');
        crossings++;
      }
      for (let k = 0; k <= 10; k++) {
        const f = k / 10;
        const x = THREE.MathUtils.lerp(previous.x, state.position.x, f);
        const z = THREE.MathUtils.lerp(previous.z, state.position.z, f);
        if (Math.abs(x - DOORWAY.centerX) < .95 && z > -.2 && z < 3.4) {
          clear = Math.min(clear, margin(x, z, THREE.MathUtils.lerp(before, sim.angle, f)));
        }
      }
      if (!state.moving) sim.activities.request(state.activity === 'eat' ? 'fish' : 'eat');
    }
    check(crossings === 6 && waits > 0, 'Missing entrance, exit or closed-door wait at frame interval ' + dt);
  }
  check(clear > .01, 'Door sweep clips the walking silhouette: ' + clear);
  return { crossings: 24, minimumMarginMetres: +clear.toFixed(4) };
}

function furnitureChanges() {
  const model = cottage(), { table, bed } = model.room;
  const sim = simulation(model);
  function place(item, x, z, yaw = item.rotation.y) {
    const old = item.position.clone(), oldYaw = item.rotation.y;
    item.position.set(x, old.y, z);
    item.rotation.y = yaw;
    if (sim.activities.acceptsLayout(item)) return true;
    item.position.copy(old);
    item.rotation.y = oldYaw;
    sim.activities.refreshLayout();
    return false;
  }
  sim.activities.request('warm');
  sim.until(s => s.moving && s.sceneMode === 'room' && s.position.z < .55 && s.position.x > -.9);
  check(place(table, -.44, .58), 'Valid mid-walk table move rejected');
  sim.until(s => s.activity === 'warm' && !s.moving);
  sim.activities.request('eat');
  sim.until(s => s.activity === 'eat' && !s.moving);
  const facing = table.getWorldPosition(new THREE.Vector3()).sub(sim.state.position).setY(0).normalize();
  check(sim.state.heading.dot(facing) > .99, 'Eating at stale table position');
  check(!place(table, DOORWAY.centerX, DOORWAY.interiorWaitZ - COTTAGE.centerZ), 'Door-blocking layout accepted');
  check(place(bed, -.5, -1.49, Math.PI / 2), 'Rotated bed approach rejected');
  sim.activities.request('sleep');
  sim.until(s => s.activity === 'sleep' && !s.moving);
  const local = bed.worldToLocal(sim.state.position.clone());
  check(sim.state.onBed && sim.state.bedYaw === bed.rotation.y && Math.abs(local.x) < .1 && local.y > .70,
    'Resting position or orientation did not follow the rotated bed');
  check(!place(bed, -.40, -1.49), 'Occupied bed can move under the character');
  const rest = sim.state.position.clone();
  let walkedAtBedHeight = false, descended = false;
  sim.activities.request('warm');
  sim.until(s => {
    if (Math.abs(s.position.y - rest.y) < .001 && s.position.distanceTo(rest) > .05) walkedAtBedHeight = true;
    if (!descended && s.position.y < rest.y - .08) {
      const feet = bed.worldToLocal(s.position.clone());
      check(walkedAtBedHeight && (Math.abs(feet.x) > 1.14 || Math.abs(feet.z) > 1.33), 'Descended through bed');
      descended = true;
    }
    return s.activity === 'warm' && !s.moving;
  });
  check(descended, 'No dismount observed');
  return { movedTable: true, blockedDoorRejected: true, rotatedBedDismount: true };
}

window.navigationTests = { dailyActivities, doorClearance, furnitureChanges };
