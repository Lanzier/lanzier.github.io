import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCoast } from "./coast.js";
import { COTTAGE, DOORWAY, CAT_REST, advanceDoor } from "./cottage-plan.js";
import { createFireplace } from "./fireplace.js";
import { createIsland } from "./island.js";
import { createRoom } from "./room.js";
import { createCompanions } from "./companions.js";
import { createActivities } from "./activities.js";
import { createChat, createSurf, readStorage, writeStorage } from "./interaction.js";
import { createWeatherControls, createWeatherEffects } from "./weather.js";

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
  const touchScreen = matchMedia("(pointer: coarse)").matches;
  const maxPixelRatio = touchScreen ? 1.5 : 1.65;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const camera = new THREE.PerspectiveCamera(42, 1, .18, 1400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduceMotion.matches;
  controls.dampingFactor = .08;
  controls.enablePan = false;
  controls.rotateSpeed = .58;
  controls.zoomSpeed = .73;
  let wheelDistance;
  const zoomOffset = new THREE.Vector3();

  canvas.addEventListener("wheel", event => {
    if (!controls.enabled || !event.deltaY) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    const distance = wheelDistance ?? camera.position.distanceTo(controls.target);
    wheelDistance = THREE.MathUtils.clamp(distance * Math.exp(pixels * .00115), controls.minDistance, controls.maxDistance);
  }, { capture: true, passive: false });

  const islandScene = new THREE.Scene();
  const currentWeather = createWeatherControls(byId);
  const weather = createWeatherEffects(THREE, islandScene, {
    eave: COTTAGE.roofEave, center: COTTAGE.centerZ, halfWidth: COTTAGE.roofHalfWidth, span: COTTAGE.roofSpan,
  });
  const island = createIsland(THREE, islandScene, weather);
  const room = createRoom(THREE, island.roomMount);
  const fireplace = createFireplace(THREE, {
    flueHeight: COTTAGE.chimneyBaseY - COTTAGE.floorY + .08,
  });
  const fireplaceZ = COTTAGE.chimneyZ - COTTAGE.centerZ;
  fireplace.group.position.set(COTTAGE.chimneyX, 0, fireplaceZ);
  room.contents.add(fireplace.group);
  const companions = createCompanions(THREE, island.roomMount, islandScene);
  companions.island.userData.groundHeight = island.terrainHeight;
  const activities = createActivities(THREE, islandScene, island, room, fireplace.group);
  let actor = activities.update(0);
  const coast = createCoast(THREE, islandScene);

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

  let light;
  let day = 0;
  let night = 0;
  const duskTint = new THREE.Color("#ffcf91");
  const dayTint = new THREE.Color("#fff0d4");
  const nightTint = new THREE.Color("#91b9fe");

  const islandTarget = new THREE.Vector3(0, 1.96, -1.35);
  const roomOrigin = island.roomMount.position;
  const roomTarget = new THREE.Vector3(.58, 1.01, -.84).add(roomOrigin);
  const doorAnchor = island.doorAnchor || new THREE.Vector3(-1.94, 2.65, 1.5);
  const gardenAnchor = island.gardenAnchor;
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
  let lastHarvest = null;
  const regrowingMelons = new Map();
  const fruitPosition = new THREE.Vector3();
  let toastTimer;
  let ready = false;
  let currentTime = 0;
  let rafId = 0;

  const savedFurniture = readStorage("furniture", {});
  const legacyLayout = savedFurniture.version !== 2;
  const savedPositions = legacyLayout ? savedFurniture : savedFurniture.items;
  const furnitureLayout = {};
  let correctedLayout = legacyLayout;
  const extentsBox = new THREE.Box3();
  const lastRoomPosition = new THREE.Vector3();
  const roomObstacles = [...room.furniture, fireplace.group].map(item => ({
    item, box: new THREE.Box3(), x: NaN, z: NaN, angle: NaN,
  }));
  const furnitureExtents = new WeakMap();
  for (const item of room.furniture) {
    const label = item.userData.label;
    const placement = savedPositions?.[label];
    if (Array.isArray(placement) && placement.length === 3 && placement.every(Number.isFinite)) {
      const originalRotation = item.rotation.y;
      item.rotation.y = placement[2] % (Math.PI * 2);
      const x = legacyLayout ? placement[0] * .74 : placement[0];
      const z = legacyLayout ? placement[1] * .62 : placement[1];
      if (!setFurniturePosition(item, x, z)) {
        item.rotation.y = originalRotation;
        activities.refreshLayout();
      }
      furnitureLayout[label] = [item.position.x, item.position.z, item.rotation.y];
      correctedLayout ||= furnitureLayout[label].some((value,index) => Math.abs(value-placement[index]) > .001);
    }
  }
  if (correctedLayout && Object.keys(furnitureLayout).length) writeFurniture();

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
  }, { harvest, animate, takePhoto, describeActivity, getView: () => mode, getLight: () => light });

  function describeActivity() {
    return activities.describe(actor);
  }

  function takePhoto(firstPerson) {
    const { walker, sprite, heading } = companions.photoSubject(actor.sceneMode);
    const feet = walker.getWorldPosition(new THREE.Vector3());
    const photoCamera = new THREE.PerspectiveCamera(firstPerson ? 66 : 53, camera.aspect, .085, camera.far);
    const target = feet.clone();
    if (firstPerson) {
      photoCamera.position.copy(feet).add(new THREE.Vector3(0, .88, 0));
      target.copy(photoCamera.position).addScaledVector(heading, 4);
      target.y -= .32;
    } else {
      target.y += .53;
      photoCamera.position.copy(feet).add(new THREE.Vector3(-1.65, 1.46, 2.35));
      if (actor.sceneMode === "room") {
        const { back, front } = COTTAGE;
        photoCamera.position.z = THREE.MathUtils.clamp(photoCamera.position.z, roomOrigin.z + back + .22, roomOrigin.z + front - .22);
      }
    }
    photoCamera.lookAt(target);
    const spriteVisible = sprite.visible;
    const outlineVisible = outline.visible;

    return new Promise((resolve, reject) => {
      try {
        if (firstPerson) sprite.visible = false;
        outline.visible = false;
        renderer.render(islandScene, photoCamera);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Photo encoding failed")), "image/jpeg", .9);
      } finally {
        sprite.visible = spriteVisible;
        outline.visible = outlineVisible;
        renderer.render(islandScene, camera);
      }
    });
  }

  function notify(text) {
    const toast = byId("toast");
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2950);
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
      touchScreen ? "轻点探索 · 滑动环顾 · 双指缩放" : "拖动环顾 · 滚轮缩放";
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
    const size = Math.max(1, ((portrait ? 1.26 : 1.39) / camera.aspect) ** .87);
    return {
      target: islandTarget.clone(),
      position: (portrait ? new THREE.Vector3(-6.6, 10.6, 25.5) : new THREE.Vector3(-8.6, 6.9, 27.8))
        .multiplyScalar(size * (portrait ? .87 : 1)).add(islandTarget),
      fov: portrait ? 64 : 56,
    };
  }

  function applyPose(pose, view) {
    wheelDistance = undefined;
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
  let resolutionScale = 1;
  let resolutionSample = 0, sampleFrames = 0, fastWindows = 0;
  function sizeDrawingBuffer() {
    const pixelBudget = touchScreen ? 1350000 : 4000000;
    const pixelRatio = Math.min(devicePixelRatio, maxPixelRatio, Math.sqrt(pixelBudget / (viewportWidth * viewportHeight)));
    renderer.setDrawingBufferSize(viewportWidth, viewportHeight, pixelRatio * resolutionScale);
  }
  function sampleMobileFrame(now) {
    if (!touchScreen) return;
    if (!resolutionSample || now - resolutionSample > 2400) {
      resolutionSample = now;
      sampleFrames = 0;
      return;
    }
    sampleFrames++;
    const elapsed = now - resolutionSample;
    if (elapsed < 1800) return;
    const average = elapsed / sampleFrames;
    fastWindows = average < 23 ? fastWindows + 1 : 0;
    const scale = average > 40 ? Math.max(.75, resolutionScale - .125)
      : fastWindows >= 4 ? Math.min(1, resolutionScale + .125) : resolutionScale;
    if (scale !== resolutionScale) {
      resolutionScale = scale;
      fastWindows = 0;
      sizeDrawingBuffer();
    }
    resolutionSample = now;
    sampleFrames = 0;
  }
  function resize() {
    const previous = camera.aspect;
    const { width, height } = experience.getBoundingClientRect();
    if (!width || !height || (width === viewportWidth && height === viewportHeight)) return;
    const widthChanged = width !== viewportWidth;
    viewportWidth = width;
    viewportHeight = height;
    sizeDrawingBuffer();
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
    const fade = byId("scene-fade");

    if (inward && !flight.changed && !flight.quick) {
      const progress = ease(Math.min(1, elapsed / flyTime));
      doorApproach.set(doorAnchor.x + .78, 3.35, doorAnchor.z + 6.6);
      doorFocus.set(doorAnchor.x + .34, doorAnchor.y - .33, doorAnchor.z);
      camera.position.lerpVectors(flight.position, doorApproach, progress);
      flightLook.lerpVectors(flight.target, doorFocus, progress);
      camera.lookAt(flightLook);
    }
    if (elapsed >= flyTime && !flight.changed) fade.classList.add("covered");
    if (elapsed >= changeTime && !flight.changed && island.doorHinge.rotation.y <= -DOORWAY.passAngle) {
      mode = flight.next;
      flight.changed = true;
      flight.changedAt = now;
      applyPose(mode === "island" && savedOrbit ? savedOrbit : photoPose(mode), mode);
      updateInterface();
      fade.classList.remove("covered");
    }
    if (flight.changed && now - flight.changedAt >= (flight.quick ? 12 : 265)) {
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
    const hidden = !isVisible || !inBounds;
    if (hidden !== button.hidden) button.hidden = hidden;
    if (!hidden) {
      const x = `clamp(44px, ${((projected.x * .5 + .5) * 100).toFixed(2)}%, calc(100% - 44px))`;
      const y = `${((.5 - projected.y * .5) * 100).toFixed(2)}%`;
      if (button.style.left !== x) button.style.left = x;
      if (button.style.top !== y) button.style.top = y;
    }
  }

  function updateHotspots() {
    const outside = mode === "island" && !transition;
    mark(doorMarker, doorAnchor, outside && camera.position.z > doorAnchor.z + 1);
    mark(gardenMarker, gardenAnchor, outside && (camera.position.z > 2 || camera.position.x > 4));
    if (!outside && (doorMarker.dataset.targetHover === "true" || gardenMarker.dataset.targetHover === "true")) updateHotspotHover(null);
  }

  function updateHotspotHover(target) {
    doorMarker.dataset.targetHover = String(target === island.door);
    gardenMarker.dataset.targetHover = String(target === island.garden);
  }

  // Touch browsers can retarget the click following pointerup to a newly revealed label.
  // Only activate that label on a fresh press (or a keyboard/assistive click).
  let revealedOnThisPress = false;
  document.addEventListener("pointerdown", () => { revealedOnThisPress = false; }, true);
  byId("hotspots").addEventListener("click", event => {
    if (revealedOnThisPress && event.detail) {
      event.preventDefault();
      event.stopPropagation();
    }
    revealedOnThisPress = false;
  }, true);

  function animate(action) {
    if (action === "greet") activities.greet();
    else activities.request(action);
  }

  function harvest() {
    if (!ready || transition || !activities.request("harvest")) return false;
    notify("Ww准备去菜园摘西瓜");
    return true;
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
    // Reserve the permanent fixtures and the doorway. The navigation check below
    // determines which lanes each actual furniture layout needs.
    if (overlaps(COTTAGE.chimneyX - .76, COTTAGE.chimneyX + .76, fireplaceZ - .33, fireplaceZ + .49) ||
        overlaps(CAT_REST.room.x-CAT_REST.radius, CAT_REST.room.x+CAT_REST.radius,
          CAT_REST.room.z-CAT_REST.radius, CAT_REST.room.z+CAT_REST.radius) ||
        overlaps(DOORWAY.centerX-.55, DOORWAY.centerX+.55, DOORWAY.interiorWaitZ-COTTAGE.centerZ-.55, COTTAGE.front)) return false;
    for (const other of room.furniture) {
      if (other === item) continue;
      extentsBox.setFromObject(other);
      if (overlaps(extentsBox.min.x, extentsBox.max.x, extentsBox.min.z - COTTAGE.centerZ, extentsBox.max.z - COTTAGE.centerZ)) return false;
    }
    const oldX = item.position.x, oldZ = item.position.z;
    item.position.set(x,item.position.y,z);
    if (!activities.acceptsLayout(item)) {
      item.position.set(oldX,item.position.y,oldZ);
      activities.refreshLayout();
      return false;
    }
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
      activities.refreshLayout();
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
    wheelDistance = undefined;
    if (event.pointerType === "touch") updateHotspotHover(null);
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
    if (!event.buttons && event.pointerType === "mouse" && ready && mode === "island" && !transition) {
      pointRay(event);
      const targets = [];
      if (!doorMarker.hidden) targets.push(island.door);
      if (!gardenMarker.hidden) targets.push(island.garden);
      updateHotspotHover(hit(targets));
    }
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(gesture.x - event.clientX, gesture.y - event.clientY) > 6) gesture.moved = true;
    if (!gesture.item || !gesture.moved) return;
    pointRay(event);
    if (!ray.ray.intersectPlane(ground, floorPoint)) return;
    setFurniturePosition(gesture.item, floorPoint.x + gesture.offsetX, floorPoint.z + gesture.offsetZ - COTTAGE.centerZ);
    gesture.item.updateMatrixWorld(true);
    outline.update();
  });
  canvas.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse") updateHotspotHover(null);
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
      if (!gardenMarker.hidden) roots.push(island.garden);
      let target = hit(roots);
      if (!target && event.pointerType === "touch") {
        // Keep tiny distant doors and plants tappable at the same point as their world marker.
        let closest = 22 * 22;
        for (const [object, anchor, marker] of [[island.door, doorAnchor, doorMarker], [island.garden, gardenAnchor, gardenMarker]]) {
          if (marker.hidden) continue;
          projected.copy(anchor).project(camera);
          const dx = (projected.x - ndc.x) * viewportWidth * .5;
          const dy = (projected.y - ndc.y) * viewportHeight * .5;
          const distance = dx * dx + dy * dy;
          if (distance < closest) {
            closest = distance;
            target = object;
          }
        }
      }
      if (event.pointerType === "touch" && (target === island.door || target === island.garden)) {
        revealedOnThisPress = true;
        updateHotspotHover(target);
        return;
      }
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
  gardenMarker.addEventListener("click", () => {
    harvest();
    if (touchScreen) updateHotspotHover(null);
  });
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

  let startTime, previousFrame, nextShadow = 0;
  function frame(now) {
    startTime ??= now;
    currentTime = (now - startTime) / 1000;
    moveThroughDoor(now);
    if (controls.enabled && wheelDistance !== undefined) {
      zoomOffset.copy(camera.position).sub(controls.target);
      const distance = zoomOffset.length();
      const elapsed = Math.min(40, now - (previousFrame ?? now));
      const blend = reduceMotion.matches ? 1 : 1 - Math.exp(-elapsed / 95);
      const next = THREE.MathUtils.lerp(distance, wheelDistance, blend);
      const settled = Math.abs(next - wheelDistance) < .003;
      camera.position.copy(controls.target).add(zoomOffset.setLength(settled ? wheelDistance : next));
      if (settled) wheelDistance = undefined;
    } else if (!controls.enabled) {
      wheelDistance = undefined;
    }
    if (!transition) controls.update();
    const delta = Math.min(.25, (now - (previousFrame ?? now)) / 1000);
    const lightBlend = reduceMotion.matches || !light ? 1 : 1 - Math.exp(-delta * 5.7);
    previousFrame = now;
    const { minute, type, intensity } = currentWeather();
    const smooth = THREE.MathUtils.smoothstep;
    const daylightHours = smooth(minute, 370, 490) * (1 - smooth(minute, 945, 1075));
    const darkness = 1 - smooth(minute, 315, 398) * (1 - smooth(minute, 1058, 1145));
    day = THREE.MathUtils.lerp(day, daylightHours, lightBlend);
    night = THREE.MathUtils.lerp(night, darkness, lightBlend);
    const period = darkness > .6 ? "night" : daylightHours > .55 ? "day" : "dusk";
    if (period !== light) experience.dataset.light = light = period;
    const cloud = weather.update(currentTime, delta, type, intensity);
    sunlight.color.copy(duskTint).lerp(dayTint, day).lerp(nightTint, night);
    sunlight.intensity = (2.7 + .21 * day - 2.16 * night) * (1 - cloud * .49);
    skyFill.intensity = (1.79 + .19 * day - 1.57 * night) * (1 - cloud * .14);
    rim.intensity = (.72 - .57 * night) * (1 - cloud * .34);

    const daylight = THREE.MathUtils.clamp(.65 + .35 * day - .57 * night, 0, 1);
    const hinge = island.doorHinge;
    actor = activities.update(currentTime, hinge.rotation.y);
    hinge.rotation.y = advanceDoor(hinge.rotation.y, actor.doorOpen || Boolean(transition), reduceMotion.matches ? Infinity : delta);
    companions.update(currentTime, mode, camera, actor);
    room.update(currentTime, night < .5);
    fireplace.update(currentTime, daylight);
    coast.update(reduceMotion.matches ? 0 : currentTime, minute, day, night, cloud, camera.position.distanceTo(controls.target));
    island.update(currentTime, daylight);
    if (mode === "room") {
      const position = camera.position;
      position.x = THREE.MathUtils.clamp(position.x, -COTTAGE.halfWidth + .19, COTTAGE.halfWidth - .19);
      position.y = THREE.MathUtils.clamp(position.y, COTTAGE.floorY + 1.48, COTTAGE.floorY + COTTAGE.ceiling - .27);
      position.z = THREE.MathUtils.clamp(position.z, COTTAGE.centerZ + COTTAGE.back + .19, COTTAGE.centerZ + COTTAGE.front - .19);
      const blocked = roomObstacles.some(obstacle => {
        const { item } = obstacle;
        if (obstacle.x !== item.position.x || obstacle.z !== item.position.z || obstacle.angle !== item.rotation.y) {
          obstacle.box.setFromObject(item).expandByScalar(.14);
          obstacle.x = item.position.x;
          obstacle.z = item.position.z;
          obstacle.angle = item.rotation.y;
        }
        return obstacle.box.containsPoint(position);
      });
      if (blocked) position.copy(lastRoomPosition);
      else lastRoomPosition.copy(position);
      camera.lookAt(controls.target);
    }
    if (actor.activity === "harvest" && !actor.moving && actor.arrivedAt !== lastHarvest && currentTime - actor.arrivedAt > 2) {
      lastHarvest = actor.arrivedAt;
      let closest, bestDistance = Infinity;
      for (const melon of island.melons) {
        if (!melon.visible) continue;
        const distance = melon.getWorldPosition(fruitPosition).distanceToSquared(actor.position);
        if (distance < bestDistance) { bestDistance = distance; closest = melon; }
      }
      if (closest) {
        closest.visible = false;
        regrowingMelons.set(closest,currentTime + 28);
      }
    }
    for (const [melon, readyAt] of regrowingMelons) {
      if (currentTime >= readyAt) {
        melon.visible = true;
        regrowingMelons.delete(melon);
      }
    }
    if (now >= nextShadow || !ready) {
      renderer.shadowMap.needsUpdate = true;
      nextShadow = now + (touchScreen ? 100 : 65);
    }
    renderer.render(islandScene, camera);
    sampleMobileFrame(now);
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
    nextShadow = 0;
    viewportWidth = 0;
    resize();
    rafId = requestAnimationFrame(frame);
  });
  // In-app WebKit can relayout dvh without dispatching a window resize.
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(experience);
  window.visualViewport?.addEventListener("resize", resize);
  window.addEventListener("resize", resize);
  window.addEventListener("pageshow", resize);
  updateInterface();
  resize();
  rafId = requestAnimationFrame(frame);
}
import "./owner-link.js";
