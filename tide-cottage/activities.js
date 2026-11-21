import { COTTAGE, DOORWAY } from "./cottage-plan.js";
import { createRoomNavigation } from "./room-navigation.js";

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
  const doorX = DOORWAY.centerX;
  const indoorDoor = new THREE.Vector3(doorX, COTTAGE.floorY, DOORWAY.interiorWaitZ);
  const threshold = new THREE.Vector3(doorX, 1.185, DOORWAY.hingeZ);
  const porch = new THREE.Vector3(doorX, 1.08, 2.42);
  const outsideDoor = new THREE.Vector3(doorX, island.terrainHeight(doorX, DOORWAY.exteriorWaitZ), DOORWAY.exteriorWaitZ);
  const yard = new THREE.Vector3(1.3, island.terrainHeight(1.3, 3.78), 3.78);
  const position = yard.clone();
  const heading = new THREE.Vector3(0, 0, -1);
  function doorPassage(entering) {
    const points = entering ? [outsideDoor, porch, threshold, indoorDoor] : [indoorDoor, threshold, porch, outsideDoor];
    return points.map((position, index) => ({
      position,
      gate: index > 0,
      scene: position === threshold ? (entering ? "room" : "island") : undefined,
    }));
  }
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

  const roomNav = createRoomNavigation(THREE, room, fireplace);
  let layoutChanged = false;
  let onBed = false;
  let approachTarget = null;
  let retry = null;
  const stepEnd = new THREE.Vector3();

  function start(name) {
    roomNav.refresh();
    const indoor = ["eat", "warm", "sleep"].includes(name);
    const segments = [];
    let from = position;
    if (onBed) {
      // Leave at bed height first, then put both feet on the clear floor beside the frame.
      segments.push({ position: climbBase.clone().setY(position.y), kind: "bed" }, { position: climbBase, kind: "bed", dismount: true });
      from = climbBase;
    }
    let approach;
    const append = (path, kind) => {
      if (!path) return false;
      for (const point of path) segments.push({ position: point, kind });
      return true;
    };
    if (sceneMode === "island" && indoor) {
      if (!append(island.outdoorRoute(from, outsideDoor), "outside")) return false;
      segments.push(...doorPassage(true).slice(1));
      from = indoorDoor;
    } else if (sceneMode === "room" && !indoor) {
      if (!append(roomNav.route(from, indoorDoor), "room")) return false;
      segments.push(...doorPassage(false).slice(1));
      from = outsideDoor;
    }
    if (indoor) {
      approach = roomNav.approach(from, name);
      if (!approach) return false;
      append(approach.path, "room");
      if (name === "sleep") {
        segments.push({ position: approach.stop.clone().setY(approach.rest.y), kind: "bed" },
          { position: approach.rest, kind: "bed", mount: true });
      }
    } else {
      const stop = name === "fish" ? fishingSpot : island.harvestSpot;
      if (!append(island.outdoorRoute(from, stop), "outside")) return false;
    }
    if (name === "sleep") climbBase = approach.stop;
    approachTarget = approach?.lookAt;
    activity = name;
    route = segments;
    arrivedAt = null;
    retry = null;
    return true;
  }

  function acceptsLayout(item) {
    roomNav.refresh();
    const usingBed = onBed || route[0]?.kind === "bed";
    if (usingBed && item === room.bed) return false;
    if (sceneMode === "room" && !route[0]?.gate &&
        !roomNav.canWalk(position,position,usingBed ? room.bed : undefined)) return false;
    if (usingBed && climbBase && !roomNav.canWalk(climbBase,climbBase)) return false;
    // Every permitted layout keeps the door, an eating position, a place by the fire
    // and a way onto the bed accessible. The tests use the actual rotated furniture.
    if (!["eat","warm","sleep"].every(name => roomNav.approach(indoorDoor, name))) return false;
    layoutChanged = true;
    return true;
  }

  function update(time, hingeAngle = 0) {
    const delta = Math.min(.30, time - lastTime);
    lastTime = time;
    if (layoutChanged && !route[0]?.gate && route[0]?.kind !== "bed") {
      layoutChanged = false;
      if (activity !== "idle" && !onBed && (route.some(step => step.kind === "room") || sceneMode === "room")) {
        route = [];
        retry = activity;
        restingUntil = time;
      }
    }
    if (!route.length && time >= restingUntil) {
      const name = requested ?? retry ?? schedule[next++ % schedule.length];
      requested = undefined;
      if (!start(name)) {
        retry = name;
        restingUntil = time + 1;
      }
    }
    let doorOpen = Boolean(route[0]?.gate);
    let waitingAtDoor = false;
    let walk = delta * 2.05;
    while (route.length && walk > 0) {
      const step = route[0];
      const distance = position.distanceTo(step.position);
      if (step.gate) {
        doorOpen = true;
        if (hingeAngle > -DOORWAY.passAngle) {
          waitingAtDoor = true;
          break;
        }
      }
      if (distance > .002) {
        stepEnd.copy(position).lerp(step.position, Math.min(1, walk / distance));
        if (step.kind === "outside") stepEnd.y = island.outdoorHeight(stepEnd.x,stepEnd.z);
        const blocked = step.kind === "outside" ? !island.outdoorCanWalk(position,stepEnd)
          : !step.gate && !roomNav.canWalk(position,stepEnd,step.kind === "bed" ? room.bed : undefined);
        if (blocked) {
          route = [];
          retry = activity;
          restingUntil = time + .1;
          break;
        }
        heading.set(step.position.x - position.x, 0, step.position.z - position.z);
        if (heading.lengthSq() > .0001) heading.normalize();
        position.copy(stepEnd);
      }
      if (walk < distance) break;
      if (step.scene) sceneMode = step.scene;
      if (step.mount) onBed = true;
      if (step.dismount) onBed = false;
      route.shift();
      walk -= distance;
    }
    if (!route.length && !retry && arrivedAt === null) {
      arrivedAt = time;
      restingUntil = time + durations[activity];
      if (activity === "fish") heading.set(.22, 0, 1).normalize();
      if (activity === "harvest") heading.set(0, 0, -1);
      if (approachTarget) heading.set(approachTarget.x-position.x,0,approachTarget.z-position.z).normalize();
    }
    rod.visible = bobber.visible = activity === "fish" && !route.length && !retry;
    bobber.position.set(1.63, .025 + Math.sin(time * 3) * .038, 13.08);
    const clip = waitingAtDoor || retry ? "idle" : route.length ? "walk" : time < waveUntil ? "wave" : activity === "eat" || activity === "harvest" ? "eat" : "idle";
    const clipTime = clip === "walk" ? time : clip === "wave" ? time - waveUntil + 2 : time - (arrivedAt ?? time);
    return { position, heading, sceneMode, activity, moving: Boolean(route.length || retry), waitingAtDoor,
      retry, onBed, bedYaw: room.bed.rotation.y, arrivedAt, doorOpen, clip, clipTime };
  }

  function describe(state) {
    if (state.waitingAtDoor) return "我在门口等门打开，马上就过去。";
    if (state.retry) return "前面有东西挡着，我在找一条能过去的路。";
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

  return { update, describe, request, acceptsLayout, refreshLayout: roomNav.refresh, greet: () => { waveUntil = lastTime + 2; } };
}
