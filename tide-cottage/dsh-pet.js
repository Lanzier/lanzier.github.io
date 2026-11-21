import { DSH_CLIPS, DSH_TILE_ASPECT } from './assets/dsh-pet/clips.js';
import { DSH_FILE_STILLS } from './assets/dsh-pet/file-stills.js';

const playback = {
  idle: { first: 0, length: DSH_CLIPS.idle.frames, loop: true, speed: 1 },
  wave: { first: 30, length: 52, loop: false, speed: 1.55 },
  walk: { first: 22, length: 65, loop: true, speed: 1 },
  eat: { first: 12, length: 91, loop: false, speed: 1.15 },
};

export function createDshPet(THREE) {
  const loader = new THREE.TextureLoader();
  const localFile = location.protocol === 'file:';
  const clips = new Map();
  const material = new THREE.MeshBasicMaterial({
    transparent: true, alphaTest: .10, depthWrite: false, toneMapped: false,
  });
  const height = 1.29;
  const geometry = new THREE.PlaneGeometry(height * DSH_TILE_ASPECT, height).translate(0, height * (.5 - .03), 0);
  const cameraAt = new THREE.Vector3(), feet = new THREE.Vector3();
  const parentOrientation = new THREE.Quaternion(), desiredOrientation = new THREE.Quaternion();
  const pose = new THREE.Euler(0, 0, 0, 'YXZ');
  // Only the visible scene sets the UVs, so the two pets can share the same GPU textures.
  function load(name) {
    if (clips.has(name)) return clips.get(name);
    const grid = localFile ? { columns: 1, rows: 1, fps: 1 } : DSH_CLIPS[name];
    const clip = { texture: null, ...grid };
    clips.set(name, clip);
    const url = localFile ? DSH_FILE_STILLS[name] : `assets/dsh-pet/${name}.webp`;
    loader.load(url, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      clip.texture = texture;
    });
    return clip;
  }

  const idle = load('idle');
  function orient(object, camera) {
    const state = object.userData;
    if (state.bedYaw !== undefined) {
      pose.set(-Math.PI / 2, state.bedYaw, 0, 'YXZ');
    } else {
      camera.getWorldPosition(cameraAt);
      object.getWorldPosition(feet);
      const dx = cameraAt.x - feet.x, dz = cameraAt.z - feet.z;
      if (dx * dx + dz * dz > .000001) state.yaw = Math.atan2(dx, dz);
      pose.set(0, state.yaw, 0, 'YXZ');
    }
    object.parent.getWorldQuaternion(parentOrientation).invert();
    object.quaternion.copy(parentOrientation.multiply(desiredOrientation.setFromEuler(pose)));
    object.updateWorldMatrix(false, false);
    if (state.walkColumn >= 0) {
      const axes = camera.matrixWorld.elements;
      const right = state.heading.x * axes[0] + state.heading.z * axes[2];
      if (Math.abs(right) > .01) state.mirrored = right > 0;
      material.map.repeat.x = (state.mirrored ? -1 : 1) / state.columns;
      material.map.offset.x = (state.walkColumn + Number(state.mirrored)) / state.columns;
    }
  }

  function sprite(heading) {
    const object = new THREE.Mesh(geometry, material);
    object.visible = false;
    object.userData = { yaw: 0, walkColumn: -1, mirrored: false, heading };
    // Reorient for the actual render camera, including a selfie taken between animation frames.
    object.onBeforeRender = (_renderer, _scene, camera) => orient(object, camera);
    object.frustumCulled = false;
    const raycast = object.raycast;
    object.raycast = function (raycaster, hits) {
      if (!this.visible) return;
      if (raycaster.camera) orient(this, raycaster.camera);
      const results = [];
      raycast.call(this, raycaster, results);
      for (const hit of results) {
        if (hit.uv.x > .16 && hit.uv.x < .84 && hit.uv.y > .035 && hit.uv.y < .96) hits.push(hit);
      }
    };
    return object;
  }

  function display(object, name, elapsed, time) {
    let clip = load(name);
    if (!clip.texture) {
      name = 'idle';
      elapsed = time;
      clip = idle;
    }
    const { texture, columns, rows, fps } = clip;
    object.visible = Boolean(texture);
    if (!texture) return;

    const { first, length, loop, speed } = playback[name];
    const tick = Math.max(0, Math.floor(elapsed * fps * speed));
    const frame = localFile ? 0 : first + (loop ? tick % length : Math.min(tick, length - 1));
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    object.userData.walkColumn = name === 'walk' ? column : -1;
    object.userData.columns = columns;
    texture.repeat.set(1 / columns, 1 / rows);
    texture.offset.set(column / columns, 1 - (row + 1) / rows);
    if (!material.map) material.needsUpdate = true;
    material.map = texture;
  }

  return { sprite, display, preload: load };
}
