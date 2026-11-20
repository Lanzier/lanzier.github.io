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
  const material = new THREE.SpriteMaterial({
    transparent: true, alphaTest: .10, depthWrite: false, toneMapped: false,
  });
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
      if (name === 'idle') {
        load('walk');
        load('wave');
      }
    });
    return clip;
  }

  const idle = load('idle');
  function sprite() {
    const object = new THREE.Sprite(material);
    object.visible = false;
    object.center.set(.5, .043);
    object.scale.set(1.29 * DSH_TILE_ASPECT, 1.29, 1);
    const raycast = object.raycast;
    object.raycast = function (raycaster, hits) {
      if (!this.visible) return;
      const results = [];
      raycast.call(this, raycaster, results);
      for (const hit of results) {
        if (hit.uv.x > .16 && hit.uv.x < .84 && hit.uv.y > .035 && hit.uv.y < .96) hits.push(hit);
      }
    };
    return object;
  }

  function display(object, name, elapsed, time, flipped) {
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
    const mirrored = name === 'walk' && flipped;
    texture.repeat.set((mirrored ? -1 : 1) / columns, 1 / rows);
    texture.offset.set((column + Number(mirrored)) / columns, 1 - (row + 1) / rows);
    if (!material.map) material.needsUpdate = true;
    material.map = texture;
  }

  return { sprite, display, preload: load };
}
