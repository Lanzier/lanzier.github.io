import { islandRadius, shorePoint, terrainHeight } from './topography.js';
import { findWalkingPath } from './walking-grid.js';
import { CAT_REST } from './cottage-plan.js';

const FOOTPRINT = .54;
const HEADROOM = 1.36;
const PIER = { x: .67, half: .72, start: 7.244, end: 11.066, floor: .5675 };
const cellSize = 2;

function pointSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx*dx + dz*dz || 1)));
  return (px - ax - t * dx) ** 2 + (pz - az - t * dz) ** 2;
}

function segmentDistance(ax, az, bx, bz, cx, cz, dx, dz) {
  const x = bx - ax, z = bz - az, u = dx - cx, v = dz - cz;
  const cross = x*v - z*u;
  if (Math.abs(cross) > 1e-8) {
    const t = ((cx - ax)*v - (cz - az)*u) / cross;
    const s = ((cx - ax)*z - (cz - az)*x) / cross;
    if (t >= 0 && t <= 1 && s >= 0 && s <= 1) return 0;
  }
  return Math.min(pointSegment(ax,az,cx,cz,dx,dz), pointSegment(bx,bz,cx,cz,dx,dz),
    pointSegment(cx,cz,ax,az,bx,bz), pointSegment(dx,dz,ax,az,bx,bz));
}

export function createOutdoorNavigation(THREE) {
  const buckets = new Map();
  const surfaces = new Map();
  let serial = 0;
  const cell = value => Math.floor(value / cellSize);
  const key = (x,z) => x*128 + z;
  function add(minX, minZ, maxX, maxZ, hit) {
    const shape = { hit, seen: -1 };
    for (let x = cell(minX); x <= cell(maxX); x++) for (let z = cell(minZ); z <= cell(maxZ); z++) {
      const id = key(x,z);
      if (!buckets.has(id)) buckets.set(id, []);
      buckets.get(id).push(shape);
    }
  }
  function barrier(ax,az,bx,bz,radius = 0) {
    const safe = radius + FOOTPRINT + .002;
    add(Math.min(ax,bx)-safe, Math.min(az,bz)-safe, Math.max(ax,bx)+safe, Math.max(az,bz)+safe,
      (x,z,u,v) => segmentDistance(x,z,u,v,ax,az,bx,bz) <= safe*safe);
  }
  function block(minX,minZ,maxX,maxZ) {
    // Rounded corners retain the full physical width of narrow passages.
    barrier(minX,minZ,maxX,minZ);
    barrier(maxX,minZ,maxX,maxZ);
    barrier(maxX,maxZ,minX,maxZ);
    barrier(minX,maxZ,minX,minZ);
    add(minX,minZ,maxX,maxZ,(x,z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ);
  }
  function blockInstances(mesh) {
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const matrix = new THREE.Matrix4(), box = new THREE.Box3();
    mesh.updateWorldMatrix(true,false);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i,matrix);
      matrix.premultiply(mesh.matrixWorld);
      box.copy(geometry.boundingBox).applyMatrix4(matrix);
      const cx = (box.min.x+box.max.x)/2, cz = (box.min.z+box.max.z)/2;
      const floors = [terrainHeight(cx,cz), terrainHeight(box.min.x,box.min.z),
        terrainHeight(box.max.x,box.min.z), terrainHeight(box.min.x,box.max.z), terrainHeight(box.max.x,box.max.z)];
      if (box.max.y < Math.min(...floors) || box.min.y > Math.max(...floors)+HEADROOM+.12) continue;
      block(box.min.x,box.min.z,box.max.x,box.max.z);
    }
  }
  const cat = CAT_REST.island;
  barrier(cat.x,cat.z,cat.x,cat.z,CAT_REST.radius);

  // Record the real transformed triangles of walkable props. This lets the feet
  // follow each stepping stone without doing a scene-wide raycast every frame.
  function support(mesh) {
    mesh.updateWorldMatrix(true,false);
    const geo = mesh.geometry, pos = geo.attributes.position;
    const indices = geo.index, n = indices?.count ?? pos.count;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      if (mesh.isInstancedMesh) {
        mesh.getMatrixAt(i,matrix);
        matrix.premultiply(mesh.matrixWorld);
      } else matrix.copy(mesh.matrixWorld);
      for (let k = 0; k < n; k += 3) {
        a.fromBufferAttribute(pos,indices ? indices.getX(k) : k).applyMatrix4(matrix);
        b.fromBufferAttribute(pos,indices ? indices.getX(k+1) : k+1).applyMatrix4(matrix);
        c.fromBufferAttribute(pos,indices ? indices.getX(k+2) : k+2).applyMatrix4(matrix);
        const ux = b.x-a.x, uz = b.z-a.z, vx = c.x-a.x, vz = c.z-a.z;
        const det = ux*vz - uz*vx;
        if (Math.abs(det) < 1e-8) continue;
        const tri = { x: a.x, y: a.y, z: a.z, ux, uz, vx, vz, uy: b.y-a.y, vy: c.y-a.y, det };
        for (let x=cell(Math.min(a.x,b.x,c.x)); x<=cell(Math.max(a.x,b.x,c.x)); x++) {
          for (let z=cell(Math.min(a.z,b.z,c.z)); z<=cell(Math.max(a.z,b.z,c.z)); z++) {
            const id=key(x,z);
            if (!surfaces.has(id)) surfaces.set(id,[]);
            surfaces.get(id).push(tri);
          }
        }
      }
    }
  }

  // Boundaries of the walkable union. Remove the piece of shore under the pier
  // so the disc can cross from sand to boards without colliding with a fake edge.
  const left = PIER.x - PIER.half, right = PIER.x + PIER.half;
  // Leave two centimetres between the footprint and the sampled shoreline
  // for the curved bank between successive points.
  const bank = (ax,az,bx,bz) => barrier(ax,az,bx,bz,.02);
  let last = shorePoint(0);
  for (let i = 1; i <= 256; i++) {
    const next = shorePoint(i * Math.PI/128);
    if (last.z > PIER.start && next.z > PIER.start && last.x > next.x && last.x >= left && next.x <= right) {
      const at = x => last.z + (next.z-last.z) * (x-last.x)/(next.x-last.x);
      if (last.x >= right) {
        const edge = at(right);
        bank(last.x,last.z,right,edge);
        barrier(right,edge,right,PIER.end);
      }
      if (next.x <= left) {
        const edge = at(left);
        bank(left,edge,next.x,next.z);
        barrier(left,edge,left,PIER.end);
      }
    } else bank(last.x,last.z,next.x,next.z);
    last = next;
  }
  barrier(left,PIER.end,right,PIER.end);

  function supported(x,z) {
    return (x >= left && x <= right && z >= PIER.start && z <= PIER.end) || islandRadius(x,z) < 1;
  }
  function clear(ax,az,bx,bz) {
    if (!supported(ax,az) || !supported(bx,bz)) return false;
    const stamp = ++serial;
    for (let x = cell(Math.min(ax,bx)); x <= cell(Math.max(ax,bx)); x++) {
      for (let z = cell(Math.min(az,bz)); z <= cell(Math.max(az,bz)); z++) {
        const shapes = buckets.get(key(x,z));
        if (!shapes) continue;
        for (const shape of shapes) {
          if (shape.seen === stamp) continue;
          shape.seen = stamp;
          if (shape.hit(ax,az,bx,bz)) return false;
        }
      }
    }
    return true;
  }
  const canStand = (x,z) => clear(x,z,x,z);
  const canWalk = (a,b) => clear(a.x,a.z,b.x,b.z);
  function baseHeight(x,z) {
    const ground = terrainHeight(x,z);
    if (x >= left && x <= right && z >= PIER.start && z <= PIER.end) return Math.max(ground,PIER.floor);
    if (x >= -4.13 && x <= 4.165 && z >= 1.275 && z <= 2.502) {
      return Math.abs(x + 1.94) < .56 && z <= 1.43 ? 1.135 : 1.076;
    }
    if (Math.abs(x + 1.94) < .90 && z >= 1.15 && z <= 2.91) {
      if (z <= 1.43) return 1.135;
      if (z <= 2.502) return 1.076;
      if (z <= 2.72) return Math.max(ground,.9725);
      return Math.max(ground,.8625);
    }
    return ground;
  }
  function heightAt(x,z) {
    let height = baseHeight(x,z);
    const nearby = surfaces.get(key(cell(x),cell(z)));
    if (!nearby) return height;
    for (const tri of nearby) {
      const dx=x-tri.x, dz=z-tri.z;
      const u=(dx*tri.vz-dz*tri.vx)/tri.det, v=(tri.ux*dz-tri.uz*dx)/tri.det;
      if (u>=0 && v>=0 && u+v<=1) height = Math.max(height,tri.y+u*tri.uy+v*tri.vy);
    }
    return height;
  }
  const grid = { minX: PIER.x-80*.22, maxX: 17.2, minZ: -11.9, maxZ: 11.1,
    step: .22, heightAt, canStand, canWalk };
  function route(from,to) {
    const path = findWalkingPath(THREE,from,to,grid);
    if (!path) return null;
    // Smoothing in plan view must not flatten the curved island into a chord.
    const sampled = [];
    let prev = from;
    for (const end of path) {
      const count = Math.max(1, Math.ceil(Math.hypot(end.x-prev.x,end.z-prev.z)/.14));
      for (let i = 1; i <= count; i++) {
        const x = prev.x + (end.x-prev.x)*i/count, z = prev.z + (end.z-prev.z)*i/count;
        sampled.push(new THREE.Vector3(x,heightAt(x,z),z));
      }
      prev = end;
    }
    return sampled;
  }
  return { block, barrier, blockInstances, support, route, canStand, canWalk, heightAt };
}
