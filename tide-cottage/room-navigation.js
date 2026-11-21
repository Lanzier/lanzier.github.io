import { COTTAGE, CAT_REST } from './cottage-plan.js';
import { findWalkingPath } from './walking-grid.js';

// Covers the opaque pixels of the widest walking frame, with either facing direction.
export const WALKER_RADIUS = .542;

function crossesBox(ax, az, bx, bz, left, right, back, front) {
  let enter = 0, leave = 1;
  for (const [a, d, low, high] of [[ax,bx-ax,left,right],[az,bz-az,back,front]]) {
    if (Math.abs(d) < 1e-8) {
      if (a < low || a > high) return false;
    } else {
      const t = (low-a)/d, u = (high-a)/d;
      enter = Math.max(enter, Math.min(t,u));
      leave = Math.min(leave, Math.max(t,u));
      if (enter > leave) return false;
    }
  }
  return true;
}

function sweptFootprint(ax, az, bx, bz, box, radius) {
  const { min, max } = box;
  if (!crossesBox(ax,az,bx,bz,min.x-radius,max.x+radius,min.z-radius,max.z+radius)) return false;
  if (crossesBox(ax,az,bx,bz,min.x,max.x,min.z-radius,max.z+radius) ||
      crossesBox(ax,az,bx,bz,min.x-radius,max.x+radius,min.z,max.z)) return true;
  const dx = bx-ax, dz = bz-az, length = dx*dx + dz*dz;
  for (const x of [min.x,max.x]) for (const z of [min.z,max.z]) {
    const t = length ? Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/length)) : 0;
    if ((ax+t*dx-x)**2 + (az+t*dz-z)**2 <= radius*radius) return true;
  }
  return false;
}

export function createRoomNavigation(THREE, room, hearth) {
  const radius = WALKER_RADIUS;
  const minX = -COTTAGE.halfWidth + radius, maxX = COTTAGE.halfWidth - radius;
  const minZ = COTTAGE.centerZ + COTTAGE.back + radius, maxZ = COTTAGE.centerZ + COTTAGE.front - radius;
  const fixtures = new Map();
  const tmp = new THREE.Box3(), matrix = new THREE.Matrix4();
  for (const item of [...room.furniture, hearth]) {
    item.updateWorldMatrix(true,true);
    const inverse = item.matrixWorld.clone().invert(), box = new THREE.Box3();
    item.traverse(part => {
      if (!part.isMesh) return;
      let bounds;
      if (part.isInstancedMesh) {
        part.computeBoundingBox();
        bounds = part.boundingBox;
      } else {
        part.geometry.computeBoundingBox();
        bounds = part.geometry.boundingBox;
      }
      matrix.multiplyMatrices(inverse,part.matrixWorld);
      box.union(tmp.copy(bounds).applyMatrix4(matrix));
    });
    fixtures.set(item,{ box, inverse, factor:1 });
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const cat = new THREE.Vector3(CAT_REST.room.x,COTTAGE.floorY,CAT_REST.room.z+COTTAGE.centerZ);
  const catBounds = new THREE.Box3(cat,cat);
  function refresh() {
    for (const [item, shape] of fixtures) {
      item.updateWorldMatrix(true,false);
      shape.inverse.copy(item.matrixWorld).invert();
      shape.factor = Math.hypot(shape.inverse.elements[0],shape.inverse.elements[2]);
    }
  }
  refresh();
  function canWalk(from, to, ignore) {
    if (from.x < minX || from.x > maxX || from.z < minZ || from.z > maxZ ||
        to.x < minX || to.x > maxX || to.z < minZ || to.z > maxZ) return false;
    if (sweptFootprint(from.x,from.z,to.x,to.z,catBounds,radius+CAT_REST.radius)) return false;
    for (const [item, shape] of fixtures) {
      if (item === ignore) continue;
      a.copy(from).applyMatrix4(shape.inverse);
      b.copy(to).applyMatrix4(shape.inverse);
      if (sweptFootprint(a.x,a.z,b.x,b.z,shape.box,radius*shape.factor)) return false;
    }
    return true;
  }
  const probe = new THREE.Vector3();
  const planner = { minX,maxX,minZ,maxZ,step:.16, heightAt:() => COTTAGE.floorY,canWalk,
    canStand(x,z) { probe.set(x,COTTAGE.floorY,z); return canWalk(probe,probe); } };
  const route = (from,to) => findWalkingPath(THREE,from,to,planner);

  function approach(from, activity) {
    const item = activity === 'sleep' ? room.bed : activity === 'eat' ? room.table : hearth;
    const shape = fixtures.get(item), { min, max } = shape.box;
    const gap = (radius + .045)*shape.factor;
    const xCenter = (min.x+max.x)*.5, zCenter = (min.z+max.z)*.5;
    const world = (x,z) => item.localToWorld(new THREE.Vector3(x,0,z)).setY(COTTAGE.floorY);
    const localStops = activity === 'warm'
      ? [[xCenter, max.z+gap+.13],[min.x*.45,max.z+gap+.13],[max.x*.45,max.z+gap+.13]]
      : [[max.x+gap,zCenter+.22],[min.x-gap,zCenter+.22],[xCenter,max.z+gap]];
    if (activity === 'eat') localStops.push([xCenter,min.z-gap]);
    const stops = localStops.map(([x,z]) => world(x,z));
    stops.sort((p,q) => p.distanceToSquared(from)-q.distanceToSquared(from));
    for (const stop of stops) {
      const path = route(from,stop);
      if (!path) continue;
      const rest = item.localToWorld(new THREE.Vector3(0,.81,.54));
      if (activity === 'sleep' && !canWalk(stop,rest,item)) continue;
      return {path,stop,rest,lookAt:world(xCenter,zCenter)};
    }
    return null;
  }
  return { route, approach, canWalk, refresh };
}
