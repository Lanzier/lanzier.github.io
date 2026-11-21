import { COTTAGE } from "./cottage-plan.js";

const schedule = ["harvest", "eat", "warm", "fish", "sleep"];
const durations = { harvest: 10, eat: 15, warm: 19, fish: 24, sleep: 23 };
const names = { harvest: "瓜田", eat: "茶几", warm: "壁炉边", fish: "码头", sleep: "床边" };
const descriptions = {
  idle: ["我在院子里歇一会儿。", "刚到屋前，准备找点事做。"],
  harvest: ["我在瓜田挑熟西瓜，看看哪颗最甜。", "在摘西瓜呢，等会儿带回屋切。"],
  eat: ["我在屋里吃西瓜，一会儿给你留一块。", "刚切了西瓜，正坐在茶几边吃呢。"],
  warm: ["我在壁炉边烤火，屋里暖和多了。", "我在看炉火跳来跳去，顺便暖暖手。"],
  fish: ["我在码头钓鱼呢，正盯着浮标。", "鱼竿已经放下去了，我在码头等鱼上钩。"],
  sleep: ["我刚爬上床，准备眯一会儿。", "在床上打盹呢，今天先歇会儿。"],
};

export function createActivities(THREE, scene, island, room, fireplace) {
  const doorX = -1.94;
  const indoorDoor = new THREE.Vector3(doorX, COTTAGE.floorY, .74);
  const threshold = new THREE.Vector3(doorX, COTTAGE.floorY, 1.34);
  const porch = new THREE.Vector3(doorX, 1.08, 2.42);
  const outsideDoor = new THREE.Vector3(doorX, island.terrainHeight(doorX, 3.03), 3.03);
  const yard = new THREE.Vector3(1.3, island.terrainHeight(1.3, 3.78), 3.78);
  const position = yard.clone();
  const heading = new THREE.Vector3(0, 0, -1);
  const furnitureBox = new THREE.Box3();
  const world = object => object.getWorldPosition(new THREE.Vector3());
  const ground = (x, z) => new THREE.Vector3(x, island.terrainHeight(x, z), z);
  const outdoorWalk = from => [ground(from.x, Math.max(3.34, from.z)), ground(doorX, 3.35), outsideDoor, porch, threshold,
    { position: indoorDoor, scene: "room" }];
  const dockDoor = ground(.67, 7.15);
  const dockStart = new THREE.Vector3(.67, .569, 7.48);
  const fishingSpot = new THREE.Vector3(.67, .569, 10.48);
  const fishingLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(.90, 1.19, 10.59), new THREE.Vector3(1.43, 1.65, 11.91),
    new THREE.Vector3(1.43, 1.65, 11.91), new THREE.Vector3(1.63, .02, 13.08),
  ]);
  const rod = new THREE.LineSegments(fishingLine, new THREE.LineBasicMaterial({ color: "#b48b62" }));
  const bobber = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 7), new THREE.MeshStandardMaterial({ color: "#f28d57" }));
  rod.visible = bobber.visible = false;
  scene.add(rod, bobber);

  let sceneMode = "island";
  let route = [];
  let activity = "idle";
  let requested;
  let restingUntil = 3;
  let arrivedAt = 0;
  let next = 0;
  let lastTime = 0;
  let previousDescription;
  let climbBase;
  let waveUntil = 0;

  function roomPath(from, destination) {
    const obstacles = [...room.furniture, fireplace].map(object => furnitureBox.setFromObject(object).clone().expandByScalar(.25));
    const safe = point => !obstacles.some(box => point.x > box.min.x && point.x < box.max.x && point.z > box.min.z && point.z < box.max.z);
    const grid = [];
    const columns = 34, rows = 22;
    for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) {
      const point = new THREE.Vector3(-3.46 + x * .21, COTTAGE.floorY, -3.65 + z * .21);
      grid.push({ point, clear: safe(point), parent: -1 });
    }
    function nearest(point) {
      let best = -1, distance = Infinity;
      grid.forEach((cell, index) => {
        const gap = cell.point.distanceToSquared(point);
        if (cell.clear && gap < distance) { best = index; distance = gap; }
      });
      return best;
    }
    const origin = nearest(from), goal = nearest(destination);
    if (origin < 0 || goal < 0) return null;
    const queue = [origin];
    grid[origin].parent = origin;
    for (let index = 0; index < queue.length && grid[goal].parent < 0; index++) {
      const current = queue[index];
      const x = current % columns;
      for (const neighbor of [x > 0 ? current - 1 : -1, x < columns - 1 ? current + 1 : -1, current - columns, current + columns]) {
        if (grid[neighbor]?.clear && grid[neighbor].parent < 0) {
          grid[neighbor].parent = current;
          queue.push(neighbor);
        }
      }
    }
    if (grid[goal].parent < 0) return null;
    const points = [];
    for (let node = goal; node !== origin; node = grid[node].parent) points.unshift(grid[node].point);
    const result = [grid[origin].point, ...points];
    if (safe(destination) && result.at(-1).distanceTo(destination) < .20) result.push(destination);
    return result;
  }

  function start(name) {
    const indoor = ["eat", "warm", "sleep"].includes(name);
    let path = [];
    const segments = [];
    if (climbBase) segments.push(position.clone().setY(climbBase.y), climbBase);
    const from = climbBase ?? position;
    if (indoor) {
      const fixture = world(name === "eat" ? room.table : name === "warm" ? fireplace : room.bed);
      const destination = fixture.clone().setY(COTTAGE.floorY);
      if (name === "eat") destination.x += 1.20;
      else if (name === "warm") destination.z += 1.12;
      else destination.x += 1.37;
      path = roomPath(sceneMode === "room" ? from : indoorDoor, destination);
      if (!path) return false;
      if (sceneMode === "island") {
        if (position.z > 7.35) segments.push(dockStart, dockDoor);
        segments.push(...outdoorWalk(position.z > 7.35 ? dockDoor : position));
      }
      segments.push(...path);
      if (name === "sleep") {
        climbBase = path.at(-1).clone();
        const bedTop = fixture.clone().setY(COTTAGE.floorY + .78);
        segments.push(climbBase.clone().setY(bedTop.y), bedTop);
      } else {
        climbBase = undefined;
      }
      heading.set(fixture.x - destination.x, 0, fixture.z - destination.z).normalize();
    } else {
      if (sceneMode === "room") {
        path = roomPath(from, indoorDoor);
        if (!path) return false;
        segments.push(...path, threshold, { position: porch, scene: "island" }, outsideDoor);
      } else if (position.z > 7.35 && name !== "fish") {
        segments.push(dockStart, dockDoor);
      }
      climbBase = undefined;
      if (name === "fish") {
        if (position.z < 7.35) segments.push(ground(.63, 5.38), dockDoor, dockStart);
        segments.push(fishingSpot);
      } else {
        segments.push(ground(2.6, 3.52), ground(4.87, 3.16), island.harvestSpot.clone().setY(island.terrainHeight(island.harvestSpot.x, island.harvestSpot.z)));
      }
    }
    activity = name;
    route = segments.map(step => step.position ? step : { position: step });
    arrivedAt = null;
    return true;
  }

  function update(time) {
    const delta = Math.min(.30, time - lastTime);
    lastTime = time;
    if (!route.length && time >= restingUntil) {
      const name = requested ?? schedule[next++ % schedule.length];
      requested = undefined;
      if (!start(name)) restingUntil = time + 3;
    }
    let doorOpen = false;
    let walk = delta * 2.05;
    while (route.length && walk > 0) {
      const step = route[0];
      const distance = position.distanceTo(step.position);
      if (step.scene || (Math.abs(position.x - doorX) < .38 && position.z < 2.50 && position.z > .65)) doorOpen = true;
      if (distance > .002) {
        heading.set(step.position.x - position.x, 0, step.position.z - position.z);
        if (heading.lengthSq() > .0001) heading.normalize();
        position.lerp(step.position, Math.min(1, walk / distance));
      }
      if (walk < distance) break;
      if (step.scene) sceneMode = step.scene;
      route.shift();
      walk -= distance;
    }
    if (!route.length && arrivedAt === null) {
      arrivedAt = time;
      restingUntil = time + durations[activity];
      if (activity === "fish") heading.set(.22, 0, 1).normalize();
      if (activity === "harvest") heading.set(0, 0, -1);
      if (activity === "warm") heading.set(0, 0, -1);
      if (activity === "eat") heading.set(-1, 0, 0);
      if (activity === "sleep") heading.set(0, 0, 1);
    }
    rod.visible = bobber.visible = activity === "fish" && !route.length;
    bobber.position.set(1.63, .025 + Math.sin(time * 3) * .038, 13.08);
    const clip = route.length ? "walk" : time < waveUntil ? "wave" : activity === "eat" || activity === "harvest" ? "eat" : "idle";
    const clipTime = clip === "walk" ? time : clip === "wave" ? time - waveUntil + 2 : time - (arrivedAt ?? time);
    return { position, heading, sceneMode, activity, moving: Boolean(route.length), arrivedAt, doorOpen, clip, clipTime };
  }

  function describe(state) {
    const options = state.moving
      ? [`我正往${names[state.activity]}走呢。`, `在去${names[state.activity]}的路上，一会儿就到。`]
      : descriptions[state.activity];
    const candidates = options.filter(text => text !== previousDescription);
    previousDescription = candidates[Math.floor(Math.random() * candidates.length)];
    return previousDescription;
  }

  function request(name) {
    if (!durations[name]) return false;
    if (activity === name || requested === name) return false;
    requested = name;
    restingUntil = lastTime;
    return true;
  }

  return { update, describe, request, greet: () => { waveUntil = lastTime + 2; } };
}
