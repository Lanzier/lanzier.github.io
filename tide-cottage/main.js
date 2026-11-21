import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCoast } from "./coast.js";
import { COTTAGE } from "./cottage-plan.js";
import { createFireplace } from "./fireplace.js";
import { createIsland } from "./island.js";
import { createRoom } from "./room.js";
import { createCompanions } from "./companions.js";
import { createChat, createSurf, readStorage, writeStorage } from "./interaction.js";

const byId = id => document.getElementById(id);
const loading = byId("loading");
const canvas = byId("world");
const experience = byId("experience");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const ease = amount => amount * amount * (3 - 2 * amount);

try {
  launch();
} catch (error) {
  console.error(error);
  loading.textContent = "三维场景暂时无法打开。请使用支持 WebGL 2 的浏览器，并开启图形加速。";
}

function launch() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor("#142c31");
  const maxPixelRatio = matchMedia("(pointer: coarse)").matches ? 1.5 : 1.65;
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxPixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(42, 1, .075, 700);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduceMotion.matches;
  controls.dampingFactor = .08;
  controls.enablePan = false;
  controls.rotateSpeed = .58;
  controls.zoomSpeed = .73;

  const islandScene = new THREE.Scene();
  const island = createIsland(THREE, islandScene);
  const room = createRoom(THREE, island.roomMount);
  const fireplace = createFireplace(THREE, {
    flueHeight: COTTAGE.chimneyBaseY - COTTAGE.floorY + .08,
  });
  const fireplaceZ = COTTAGE.chimneyZ - COTTAGE.centerZ;
  fireplace.group.position.set(COTTAGE.chimneyX, 0, fireplaceZ);
  room.contents.add(fireplace.group);
  const companions = createCompanions(THREE, island.roomMount, islandScene);
  companions.island.userData.groundHeight = island.terrainHeight;
  companions.island.userData.harvestTarget = island.garden.position.clone();
  const coast = createCoast(THREE, islandScene, island.shorePoint, island.shoreSize);

  const skyFill = new THREE.HemisphereLight("#d3e9dd", "#a18757", 2.05);
  const sunlight = new THREE.DirectionalLight("#ffce87", 3.3);
  sunlight.position.set(-13, 16, 10);
  sunlight.castShadow = true;
  const shadowSize = maxPixelRatio < 1.6 ? 1024 : 2048;
  sunlight.shadow.mapSize.set(shadowSize, shadowSize);
  sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -18;
  sunlight.shadow.camera.right = sunlight.shadow.camera.top = 18;
  sunlight.shadow.camera.near = .5;
  sunlight.shadow.camera.far = 55;
  sunlight.shadow.normalBias = .045;
  sunlight.shadow.bias = -.00022;
  sunlight.shadow.radius = 2;
  const rim = new THREE.DirectionalLight("#ffe2a4", .75);
  rim.position.set(-13, 8, -11);
  islandScene.add(skyFill, sunlight, rim);

  const modes = ["dusk", "night", "day"];
  const lightLabels = { dusk: "日落", night: "夜晚", day: "白天" };
  let light = readStorage("light", "dusk");
  if (!modes.includes(light)) light = "dusk";
  let day = Number(light === "day");
  let night = Number(light === "night");
  const duskTint = new THREE.Color("#ffcf91");
  const dayTint = new THREE.Color("#fff0d4");
  const nightTint = new THREE.Color("#91b9fe");

  const islandTarget = new THREE.Vector3(0, 1.96, -1.35);
  const roomOrigin = island.roomMount.position;
  const roomTarget = new THREE.Vector3(.58, 1.01, -.84).add(roomOrigin);
  const doorAnchor = island.doorAnchor || new THREE.Vector3(-1.94, 2.65, 1.5);
  const gardenAnchor = island.gardenAnchor || new THREE.Vector3(-4.85, 1.6, 4.3);
  const doorMarker = byId("door-marker");
  const gardenMarker = byId("garden-marker");
  const showIsland = byId("show-island");
  const showRoom = byId("show-room");
  const editRoom = byId("edit-room");
  const tools = byId("furniture-tools");
  const rotateButton = byId("rotate-furniture");

  let mode = "island";
  let transition = null;
  let savedOrbit = null;
  let edit = false;
  let selected = null;
  let gesture = null;
  let harvestStarted = null;
  let pickedMelon = null;
  let melonRegrowth = 0;
  let toastTimer;
  let ready = false;
  let currentTime = 0;
  let rafId = 0;

  const savedFurniture = readStorage("furniture", {});
  const legacyLayout = savedFurniture.version !== 2;
  const savedPositions = legacyLayout ? savedFurniture : savedFurniture.items;
  const furnitureLayout = {};
  const extentsBox = new THREE.Box3();
  const cameraObstacle = new THREE.Box3();
  const lastRoomPosition = new THREE.Vector3();
  const roomObstacles = [...room.furniture, fireplace.group];
  const furnitureExtents = new WeakMap();
  for (const item of room.furniture) {
    const label = item.userData.label;
    const placement = savedPositions?.[label];
    if (Array.isArray(placement) && placement.length === 3 && placement.every(Number.isFinite)) {
      const originalRotation = item.rotation.y;
      item.rotation.y = placement[2] % (Math.PI * 2);
      const x = legacyLayout ? placement[0] * .74 : placement[0];
      const z = legacyLayout ? placement[1] * .62 : placement[1];
      if (!setFurniturePosition(item, x, z)) item.rotation.y = originalRotation;
      furnitureLayout[label] = [item.position.x, item.position.z, item.rotation.y];
    }
  }
  if (legacyLayout && Object.keys(furnitureLayout).length) writeFurniture();

  const outline = new THREE.BoxHelper(new THREE.Object3D(), "#f6cb87");
  outline.material.depthTest = false;
  outline.material.transparent = true;
  outline.material.opacity = .82;
  outline.renderOrder = 5;
  outline.visible = false;
  islandScene.add(outline);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -COTTAGE.floorY);
  const floorPoint = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const surf = createSurf();
  const chat = createChat({
    panel: byId("chat-panel"),
    launch: byId("chat-launch"),
    close: byId("chat-close"),
    messages: byId("messages"),
    form: byId("chat-form"),
    input: byId("chat-input"),
  }, { harvest, animate, getView: () => mode, getLight: () => light });

  function notify(text) {
    const toast = byId("toast");
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2950);
  }

  function updateLightButton() {
    const button = byId("light-toggle");
    button.querySelector("span").textContent = lightLabels[light];
    button.querySelector("use").setAttribute("href", light === "night" ? "#i-moon" : "#i-sun");
    button.setAttribute("aria-label", `切换昼夜，当前${lightLabels[light]}`);
    experience.dataset.light = light;
  }

  function updateInterface() {
    experience.dataset.view = mode;
    experience.dataset.editing = String(edit);
    showIsland.setAttribute("aria-pressed", String(mode === "island"));
    showRoom.setAttribute("aria-pressed", String(mode === "room"));
    editRoom.hidden = mode !== "room";
    editRoom.setAttribute("aria-pressed", String(edit));
    tools.hidden = !edit;
    const location = byId("location-label");
    location.lastChild.textContent = mode === "island" ? " 海岛" : " 小屋";
    const hint = byId("scene-hint");
    hint.textContent = edit ? "拖动家具 · R 键旋转" :
      matchMedia("(pointer: coarse)").matches ? "滑动环顾 · 双指缩放" : "拖动环顾 · 滚轮缩放";
    controls.enabled = ready && !transition && !edit;
  }

  function photoPose(view) {
    const portrait = camera.aspect < .85;
    if (view === "room") {
      const target = roomTarget.clone();
      if (portrait) target.x = 1.18;
      return {
        target,
        position: new THREE.Vector3(portrait ? 1.15 : 1.55, 1.91, 2.31).add(roomOrigin),
        fov: portrait ? 92 : 74,
      };
    }
    const size = Math.max(1, (1.39 / camera.aspect) ** .87);
    return {
      target: islandTarget.clone(),
      position: new THREE.Vector3(-9.04, 14.1, 29.6).multiplyScalar(size).add(islandTarget),
      fov: 42,
    };
  }

  function applyPose(pose, view) {
    controls.enableDamping = false;
    controls.minDistance = view === "island" ? 9 : 1.25;
    controls.maxDistance = view === "island" ? 112 : 4.8;
    controls.minPolarAngle = view === "island" ? .45 : .78;
    controls.maxPolarAngle = view === "island" ? 1.47 : 1.38;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.update();
    camera.position.copy(pose.position);
    if (view === "room") lastRoomPosition.copy(pose.position);
    controls.target.copy(pose.target);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    controls.update();
    controls.enableDamping = !reduceMotion.matches;
  }

  let viewportWidth = 0;
  let viewportHeight = 0;
  function resize() {
    const previous = camera.aspect;
    const { width, height } = experience.getBoundingClientRect();
    if (!width || !height || (width === viewportWidth && height === viewportHeight)) return;
    const widthChanged = width !== viewportWidth;
    viewportWidth = width;
    viewportHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    if (!ready || (!transition && (widthChanged || (previous < .85) !== (camera.aspect < .85)))) {
      applyPose(photoPose(mode), mode);
      savedOrbit = null;
    }
    camera.updateProjectionMatrix();
  }

  function switchScene(next, onArrival) {
    if (!ready || transition) return false;
    if (next === mode) {
      onArrival?.();
      return true;
    }
    if (edit) setEditing(false);
    if (mode === "island") {
      savedOrbit = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
    }
    const quick = reduceMotion.matches;
    transition = {
      next, onArrival, start: performance.now(), quick, changed: false,
      position: camera.position.clone(), target: controls.target.clone(),
    };
    controls.enabled = false;
    return true;
  }

  function moveThroughDoor(now) {
    if (!transition) return;
    const flight = transition;
    const elapsed = now - flight.start;
    const inward = flight.next === "room";
    const flyTime = flight.quick ? 0 : inward ? 780 : 110;
    const changeTime = flyTime + (flight.quick ? 10 : 220);
    const finishTime = changeTime + (flight.quick ? 12 : 265);
    const fade = byId("scene-fade");

    if (inward && !flight.changed && !flight.quick) {
      const progress = ease(Math.min(1, elapsed / flyTime));
      doorApproach.set(doorAnchor.x + .78, 3.35, doorAnchor.z + 6.6);
      doorFocus.set(doorAnchor.x + .34, doorAnchor.y - .33, doorAnchor.z);
      camera.position.lerpVectors(flight.position, doorApproach, progress);
      flightLook.lerpVectors(flight.target, doorFocus, progress);
      camera.lookAt(flightLook);
      if (island.doorHinge) {
        island.doorHinge.rotation.y = -1.04 * ease(THREE.MathUtils.clamp((progress - .40) / .60, 0, 1));
      }
    }
    if (elapsed >= flyTime && elapsed < changeTime) fade.classList.add("covered");
    if (elapsed >= changeTime && !flight.changed) {
      mode = flight.next;
      flight.changed = true;
      if (island.doorHinge) island.doorHinge.rotation.y = 0;
      applyPose(mode === "island" && savedOrbit ? savedOrbit : photoPose(mode), mode);
      updateInterface();
      fade.classList.remove("covered");
    }
    if (elapsed >= finishTime) {
      transition = null;
      updateInterface();
      flight.onArrival?.();
    }
  }

  const doorApproach = new THREE.Vector3();
  const doorFocus = new THREE.Vector3();
  const flightLook = new THREE.Vector3();

  function mark(button, anchor, isVisible) {
    projected.copy(anchor).project(camera);
    const inBounds = Math.abs(projected.x) < .94 && Math.abs(projected.y) < .82 && projected.z >= -1 && projected.z < 1;
    button.hidden = !isVisible || !inBounds;
    if (!button.hidden) {
      button.style.left = `clamp(44px, ${(projected.x * .5 + .5) * 100}%, calc(100% - 44px))`;
      button.style.top = `${(.5 - projected.y * .5) * 100}%`;
    }
  }

  function updateHotspots() {
    const outside = mode === "island" && !transition;
    mark(doorMarker, doorAnchor, outside && camera.position.z > doorAnchor.z + 1);
    mark(gardenMarker, gardenAnchor, outside && (camera.position.z > 2 || camera.position.x < -4));
  }

  function animate(action) {
    if (mode === "island" && harvestStarted !== null && action !== "harvest") return;
    companions.trigger(action, mode);
  }

  function harvest() {
    if (!ready || transition || harvestStarted !== null) return false;
    function start() {
      if (pickedMelon) pickedMelon.visible = true;
      pickedMelon = null;
      harvestStarted = currentTime;
      gardenMarker.disabled = true;
      animate("harvest");
      notify("Ww去菜园摘西瓜了");
    }
    return switchScene("island", start);
  }

  function setFurniturePosition(item, x, z) {
    let extents = furnitureExtents.get(item);
    if (!extents || extents.rotation !== item.rotation.y) {
      extentsBox.setFromObject(item);
      extents = {
        rotation: item.rotation.y,
        minX: extentsBox.min.x - item.position.x,
        maxX: extentsBox.max.x - item.position.x,
        minZ: extentsBox.min.z - item.position.z - COTTAGE.centerZ,
        maxZ: extentsBox.max.z - item.position.z - COTTAGE.centerZ,
      };
      furnitureExtents.set(item, extents);
    }
    const minX = -COTTAGE.halfWidth + .10 - extents.minX;
    const maxX = COTTAGE.halfWidth - .10 - extents.maxX;
    const minZ = COTTAGE.back + .10 - extents.minZ;
    const maxZ = COTTAGE.front - .10 - extents.maxZ;
    x = THREE.MathUtils.clamp(x, minX, maxX);
    z = THREE.MathUtils.clamp(z, minZ, maxZ);

    const footprint = {
      minX: x + extents.minX, maxX: x + extents.maxX,
      minZ: z + extents.minZ, maxZ: z + extents.maxZ,
    };
    const overlaps = (minX, maxX, minZ, maxZ) =>
      footprint.minX < maxX + .025 && footprint.maxX > minX - .025 &&
      footprint.minZ < maxZ + .025 && footprint.maxZ > minZ - .025;
    // Keep the fireplace, the companion's walking lane, and the cat's resting spot clear.
    if (overlaps(COTTAGE.chimneyX - .76, COTTAGE.chimneyX + .76, fireplaceZ - .33, fireplaceZ + .49) ||
        overlaps(.86, 2.00, .30, 1.80) || overlaps(-2.62, -1.68, 1.49, 2.31)) return false;
    for (const other of room.furniture) {
      if (other === item) continue;
      extentsBox.setFromObject(other);
      if (overlaps(extentsBox.min.x, extentsBox.max.x, extentsBox.min.z - COTTAGE.centerZ, extentsBox.max.z - COTTAGE.centerZ)) return false;
    }
    item.position.x = x;
    item.position.z = z;
    return true;
  }

  function saveFurniture(item) {
    furnitureLayout[item.userData.label] = [item.position.x, item.position.z, item.rotation.y];
    writeFurniture();
  }

  function writeFurniture() {
    writeStorage("furniture", { version: 2, items: furnitureLayout });
  }

  function selectFurniture(item) {
    selected = item;
    outline.visible = Boolean(item) && edit;
    if (item) outline.setFromObject(item);
    byId("furniture-label").textContent = item?.userData.label || "选择一件家具";
    rotateButton.disabled = !item;
  }

  function setEditing(enabled) {
    if (mode !== "room" || transition) return;
    edit = enabled;
    gesture = null;
    selectFurniture(null);
    updateInterface();
    if (enabled) canvas.focus({ preventScroll: true });
  }

  function rotateSelected() {
    if (!edit || !selected) return;
    const previousRotation = selected.rotation.y;
    selected.rotation.y = (previousRotation + Math.PI * .25) % (Math.PI * 2);
    if (!setFurniturePosition(selected, selected.position.x, selected.position.z)) {
      selected.rotation.y = previousRotation;
      return;
    }
    selected.updateMatrixWorld(true);
    outline.update();
    saveFurniture(selected);
  }

  function pointRay(event) {
    const bounds = canvas.getBoundingClientRect();
    ndc.set(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
  }

  function hit(roots) {
    const target = ray.intersectObjects(roots, true)[0]?.object;
    if (!target) return null;
    let parent = target;
    while (parent && !roots.includes(parent)) parent = parent.parent;
    return parent;
  }

  canvas.addEventListener("pointerdown", event => {
    if (!event.isPrimary && event.pointerType === "touch" && gesture) gesture.moved = true;
    if (!event.isPrimary || event.button !== 0 || !ready || transition) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, item: null };
    if (!edit) return;
    pointRay(event);
    selectFurniture(hit(room.furniture));
    if (!selected || !ray.ray.intersectPlane(ground, floorPoint)) return;
    gesture.item = selected;
    gesture.offsetX = selected.position.x - floorPoint.x;
    gesture.offsetZ = selected.position.z + COTTAGE.centerZ - floorPoint.z;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(gesture.x - event.clientX, gesture.y - event.clientY) > 6) gesture.moved = true;
    if (!gesture.item || !gesture.moved) return;
    pointRay(event);
    if (!ray.ray.intersectPlane(ground, floorPoint)) return;
    setFurniturePosition(gesture.item, floorPoint.x + gesture.offsetX, floorPoint.z + gesture.offsetZ - COTTAGE.centerZ);
    gesture.item.updateMatrixWorld(true);
    outline.update();
  });

  function finishGesture(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { item, moved } = gesture;
    gesture = null;
    if (item && moved) saveFurniture(item);
    if (moved || edit || transition || event.type === "pointercancel") return;
    pointRay(event);
    if (mode === "island") {
      const roots = [companions.island];
      if (island.door && camera.position.z > doorAnchor.z + 1) roots.push(island.door);
      if (island.garden && (camera.position.z > 2 || camera.position.x < -4)) roots.push(island.garden);
      const target = hit(roots);
      if (target === island.door) switchScene("room");
      if (target === island.garden) harvest();
      if (target === companions.island) { animate("greet"); chat.open(); }
    } else {
      const target = hit([island.door, companions.room]);
      if (target === island.door) switchScene("island");
      if (target === companions.room) { animate("greet"); chat.open(); }
    }
  }
  canvas.addEventListener("pointerup", finishGesture);
  canvas.addEventListener("pointercancel", finishGesture);

  canvas.addEventListener("dblclick", () => { if (edit) rotateSelected(); });
  canvas.addEventListener("keydown", event => {
    if (!ready || transition) return;
    if (edit && selected) {
      if (event.key.toLowerCase() === "r") rotateSelected();
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      setFurniturePosition(selected, selected.position.x + direction[0] * .14, selected.position.z + direction[1] * .14);
      selected.updateMatrixWorld(true);
      outline.update();
      saveFurniture(selected);
    } else if (!edit) {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      orbit.theta += direction[0] * .1;
      orbit.phi += direction[1] * .08;
      camera.position.setFromSpherical(orbit).add(controls.target);
      controls.update();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (chat.isOpen) chat.hide(true);
    else if (edit) setEditing(false);
  });

  doorMarker.addEventListener("click", () => switchScene("room"));
  gardenMarker.addEventListener("click", harvest);
  showRoom.addEventListener("click", () => switchScene("room"));
  showIsland.addEventListener("click", () => switchScene("island"));
  editRoom.addEventListener("click", () => setEditing(!edit));
  rotateButton.addEventListener("click", () => {
    rotateSelected();
    canvas.focus({ preventScroll: true });
  });
  byId("reset-camera").addEventListener("click", () => {
    if (ready && !transition) applyPose(photoPose(mode), mode);
  });
  byId("light-toggle").addEventListener("click", () => {
    light = modes[(modes.indexOf(light) + 1) % modes.length];
    writeStorage("light", light);
    updateLightButton();
  });
  byId("sound-toggle").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const enabled = await surf.set(!surf.audible);
      button.setAttribute("aria-pressed", String(enabled));
      button.setAttribute("aria-label", enabled ? "关闭海浪声" : "开启海浪声");
      button.title = enabled ? "关闭海浪声" : "开启海浪声";
      button.querySelector("use").setAttribute("href", enabled ? "#i-volume" : "#i-mute");
    } finally {
      button.disabled = false;
    }
  });

  let startTime, previousFrame;
  function frame(now) {
    startTime ??= now;
    currentTime = (now - startTime) / 1000;
    moveThroughDoor(now);
    if (!transition) controls.update();
    const lightBlend = reduceMotion.matches ? 1 : 1 - Math.exp(-(now - (previousFrame ?? now)) / 175);
    previousFrame = now;
    day = THREE.MathUtils.lerp(day, Number(light === "day"), lightBlend);
    night = THREE.MathUtils.lerp(night, Number(light === "night"), lightBlend);
    sunlight.color.copy(duskTint).lerp(dayTint, day).lerp(nightTint, night);
    sunlight.intensity = 2.7 + .21 * day - 1.94 * night;
    skyFill.intensity = 1.79 + .19 * day - 1.23 * night;
    rim.intensity = .72 - .40 * night;

    const daylight = THREE.MathUtils.clamp(.65 + .35 * day - .57 * night, 0, 1);
    companions.update(currentTime, mode, camera);
    room.update(currentTime, night < .5);
    fireplace.update(currentTime, daylight);
    coast.update(reduceMotion.matches ? 0 : currentTime, day, night);
    island.update(currentTime, daylight);
    companions.room.visible = mode === "room";
    if (mode === "room") {
      const position = camera.position;
      position.x = THREE.MathUtils.clamp(position.x, -COTTAGE.halfWidth + .19, COTTAGE.halfWidth - .19);
      position.y = THREE.MathUtils.clamp(position.y, COTTAGE.floorY + 1.48, COTTAGE.floorY + COTTAGE.ceiling - .27);
      position.z = THREE.MathUtils.clamp(position.z, COTTAGE.centerZ + COTTAGE.back + .19, COTTAGE.centerZ + COTTAGE.front - .19);
      const blocked = roomObstacles.some(object =>
        cameraObstacle.setFromObject(object).expandByScalar(.14).containsPoint(position)
      );
      if (blocked) position.copy(lastRoomPosition);
      else lastRoomPosition.copy(position);
      camera.lookAt(controls.target);
    }
    if (harvestStarted !== null && currentTime - harvestStarted >= 2.65 && !pickedMelon) {
      pickedMelon = island.melons[Math.floor(island.melons.length / 2)];
      if (pickedMelon) pickedMelon.visible = false;
    }
    if (harvestStarted !== null && currentTime - harvestStarted >= 5.65) {
      harvestStarted = null;
      melonRegrowth = currentTime + 14;
      gardenMarker.disabled = false;
      if (chat.isOpen) chat.message("amo", "摘回来啦！等会儿切给你一块。");
      notify("Ww带回了一颗西瓜");
    }
    if (harvestStarted === null && pickedMelon && currentTime >= melonRegrowth) {
      pickedMelon.visible = true;
      pickedMelon = null;
    }
    renderer.render(islandScene, camera);
    updateHotspots();
    if (!ready) {
      ready = true;
      loading.hidden = true;
      updateInterface();
    }
    rafId = requestAnimationFrame(frame);
  }

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    cancelAnimationFrame(rafId);
    loading.textContent = "三维场景已暂停，正在等待图形引擎恢复。";
    loading.hidden = false;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    loading.hidden = true;
    viewportWidth = 0;
    resize();
    rafId = requestAnimationFrame(frame);
  });
  // In-app WebKit can relayout dvh without dispatching a window resize.
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(experience);
  window.visualViewport?.addEventListener("resize", resize);
  window.addEventListener("resize", resize);
  window.addEventListener("pageshow", resize);
  updateLightButton();
  updateInterface();
  resize();
  rafId = requestAnimationFrame(frame);
}
import "./owner-link.js";
