// The exact endpoints and every shortcut must clear the same swept footprint as the grid edges.
export function findWalkingPath(THREE, from, to, { minX, maxX, minZ, maxZ, step, heightAt, canStand, canWalk }) {
  if (!canStand(from.x, from.z) || !canStand(to.x, to.z)) return null;
  if (canWalk(from, to)) return [to.clone()];
  const cols = 1 + Math.floor((maxX - minX) / step), rows = 1 + Math.floor((maxZ - minZ) / step);
  const cells = new Map(), open = [];
  const cost = new Map(), parent = new Map();
  function cell(x, z) {
    if (x < 0 || x >= cols || z < 0 || z >= rows) return null;
    const id = x + z * cols;
    if (!cells.has(id)) {
      const px = minX + x * step, pz = minZ + z * step;
      cells.set(id, canStand(px, pz) ? new THREE.Vector3(px, heightAt(px, pz), pz) : null);
    }
    return cells.get(id);
  }
  function enqueue(id, score) {
    let i = open.length;
    open.push(null);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (open[up].score <= score) break;
      open[i] = open[up];
      i = up;
    }
    open[i] = { id, score };
  }
  function dequeue() {
    const first = open[0], last = open.pop();
    if (!open.length) return first.id;
    let i = 0;
    while (2*i+1 < open.length) {
      let child = 2*i+1;
      if (child+1 < open.length && open[child+1].score < open[child].score) child++;
      if (last.score <= open[child].score) break;
      open[i] = open[child];
      i = child;
    }
    open[i] = last;
    return first.id;
  }
  const sx = Math.round((from.x-minX)/step), sz = Math.round((from.z-minZ)/step);
  for (let z = sz-2; z <= sz+2; z++) for (let x = sx-2; x <= sx+2; x++) {
    const point = cell(x,z);
    if (!point || !canWalk(from,point)) continue;
    const id = x+z*cols, distance = from.distanceTo(point);
    parent.set(id,-1); cost.set(id,distance);
    enqueue(id,distance + point.distanceTo(to));
  }
  const visited = new Set();
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  while (open.length) {
    const id = dequeue();
    if (visited.has(id)) continue;
    visited.add(id);
    const point = cells.get(id);
    if (canWalk(point,to)) {
      const reverse = [to.clone()];
      for (let node = id; node >= 0; node = parent.get(node)) reverse.push(cells.get(node));
      const points = reverse.reverse(), path = [];
      let anchor = from;
      for (let i = 0; i < points.length;) {
        let j = i;
        while (j+1 < points.length && canWalk(anchor,points[j+1])) j++;
        anchor = points[j];
        path.push(anchor);
        i = j+1;
      }
      return path;
    }
    const x = id % cols, z = Math.floor(id / cols);
    for (const [dx,dz] of directions) {
      const nx = x+dx, nz=z+dz, neighbor=nx+nz*cols;
      const next = cell(nx,nz);
      if (!next || visited.has(neighbor)) continue;
      const score = cost.get(id) + point.distanceTo(next);
      if (score >= (cost.get(neighbor) ?? Infinity) || !canWalk(point,next)) continue;
      cost.set(neighbor,score); parent.set(neighbor,id);
      enqueue(neighbor,score + next.distanceTo(to));
    }
  }
  return null;
}
