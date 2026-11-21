// Keep the units movable (door, furniture and shell) while submitting their static parts together.
export function batchCottageParts(THREE, parent, tintable, animated = new Set()) {
  const batches = new Map();
  for (const part of parent.children) {
    if (!part.isMesh || part.isInstancedMesh || part.material.transparent || animated.has(part)) continue;
    const mat = part.material;
    const family = tintable.has(mat)
      ? `paint/${mat.map?.id ?? '-'}/${mat.roughness}/${mat.metalness}/${mat.side}`
      : mat.id;
    const key = [part.geometry.id, family, part.castShadow, part.receiveShadow].join(':');
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(part);
  }
  for (const parts of batches.values()) {
    if (parts.length < 2) continue;
    const first = parts[0];
    const useTints = parts.some(part => part.material !== first.material);
    const material = useTints ? first.material.clone() : first.material;
    if (useTints) material.color.set(0xffffff);
    const instances = new THREE.InstancedMesh(first.geometry, material, parts.length);
    instances.castShadow = first.castShadow;
    instances.receiveShadow = first.receiveShadow;
    parts.forEach((part, index) => {
      part.updateMatrix();
      instances.setMatrixAt(index, part.matrix);
      if (useTints) instances.setColorAt(index, part.material.color);
    });
    parent.remove(...parts);
    parent.add(instances);
  }
}

export function makeLimewash(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = 4 * (y * 128 + x);
      const t = y / 127, u = x / 128 * Math.PI * 2;
      const wash = Math.sin(u + t * 7) * 1.6 + Math.sin(u * 3 - t * 5) * 1.2;
      const foot = Math.max(0, (t - .64) / .36) ** 2 * (9 + 3 * Math.cos(2 * u + .8));
      const speck = ((x * 31 + y * 59 + x * y * 7) % 17) / 8 - 1;
      const value = 251 + wash + speck * 1.7 - foot - 8 * Math.max(0, 1 - t * 7);
      image.data[i] = value;
      image.data[i + 1] = value - .8;
      image.data[i + 2] = value - 2.1;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// A sawn upper edge, clipped exposed corners and a slight lift at the overlapping lip.
export function makeRoofSlate(THREE) {
  const positions = [], colors = [], indices = [];
  const polygon = (points, shades) => {
    const start = positions.length / 3;
    points.forEach((point, n) => {
      positions.push(...point);
      colors.push(shades[n], shades[n], shades[n]);
    });
    for (let i = 1; i < points.length - 1; i++) indices.push(start, start + i, start + i + 1);
  };
  const top = [
    [-.5, .08, -.50], [-.5, .53, .35], [-.38, .60, .50],
    [.36, .59, .49], [.5, .52, .34], [.5, .08, -.50],
  ];
  polygon(top, [.77, .98, 1.04, 1.01, .98, .80]);
  for (let i = 0; i < top.length - 1; i++) {
    const a = top[i], b = top[i + 1];
    polygon([b, a, [a[0], -.40, a[2]], [b[0], -.40, b[2]]], [.74, .77, .56, .59]);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  shape.setIndex(indices);
  shape.computeVertexNormals();
  return shape;
}

export function makeRidgeCap(THREE) {
  const profile = new THREE.Shape();
  profile.moveTo(-.5, 0);
  profile.lineTo(-.07, .88);
  profile.lineTo(.07, .88);
  profile.lineTo(.5, 0);
  profile.lineTo(.5, -.14);
  profile.lineTo(0, .62);
  profile.lineTo(-.5, -.14);
  profile.closePath();
  const cap = new THREE.ExtrudeGeometry(profile, { depth: 1, bevelEnabled: false });
  return cap.translate(0, 0, -.5).rotateY(Math.PI / 2);
}

export function makeQuilt(THREE) {
  const quilt = new THREE.PlaneGeometry(1, 1, 28, 26);
  const vertices = quilt.getAttribute('position');
  const uv = quilt.getAttribute('uv');
  for (let i = 0; i < vertices.count; i++) {
    const u = uv.getX(i), v = 1 - uv.getY(i);
    const side = 2 * u - 1;
    const edge = Math.max(0, (Math.abs(side) - .86) / .14);
    const foot = Math.max(0, (v - .89) / .11);
    const sideAngle = edge * Math.PI / 2, footAngle = foot * Math.PI / 2;
    const x = Math.sign(side) * (.965 * Math.min(1, Math.abs(side) / .86) + .065 * Math.sin(sideAngle));
    const z = -.48 + 1.676 * Math.min(1, v / .89) + .08 * Math.sin(footAngle);
    const sag = .158 * Math.max(1 - Math.cos(sideAngle), 1 - Math.cos(footAngle));
    const tuft = .009 * Math.sin(Math.PI * (u * 7 + v * 4)) ** 2 * Math.sin(Math.PI * (u * 7 - v * 4)) ** 2;
    const fold = .006 * Math.cos(u * 27 + v * 8) + .004 * Math.sin(v * 22 - u * 11);
    vertices.setXYZ(i, x, .715 - sag + tuft + fold, z);
  }
  quilt.computeVertexNormals();
  return quilt;
}

export function drawQuilt(ctx, width, height) {
  ctx.fillStyle = '#668f90';
  ctx.fillRect(0, 0, width, height);
  // Broad bands of sea-glass blue survive mipmapping at the exterior viewing distance.
  for (const [y, h, color] of [[.045, .14, '#8ba7a0'], [.18, .012, '#b9c5a8'],
    [.818, .12, '#567e80'], [.815, .009, '#b9b99a'], [.96, .04, '#4d7175']]) {
    ctx.fillStyle = color;
    ctx.fillRect(0, height * y, width, height * h);
  }
  ctx.lineWidth = 1.05;
  ctx.setLineDash([2.5, 2]);
  ctx.strokeStyle = 'rgba(230,231,201,.48)';
  const dx = width / 7, dy = height / 4;
  ctx.beginPath();
  for (let x = -width; x < 2 * width; x += dx) {
    ctx.moveTo(x, 0); ctx.lineTo(x + 4 * dx, 4 * dy);
    ctx.moveTo(x, 0); ctx.lineTo(x - 4 * dx, 4 * dy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // A narrow woven ochre panel wraps around both sides at the foot.
  ctx.fillStyle = '#b19c67';
  ctx.fillRect(0, height * .663, width, height * .13);
  for (const y of [.673, .692, .761, .780]) {
    ctx.fillStyle = '#ded2a2';
    ctx.fillRect(0, height * y, width, height * .005);
  }
  ctx.fillStyle = '#cbbc8b';
  for (let i = 0; i < 16; i++) {
    const x = (i + .5) * width / 16, y = height * .726;
    ctx.beginPath();
    ctx.moveTo(x - 3, y); ctx.lineTo(x, y - 3); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 3);
    ctx.fill();
  }
}

// Two small woodcut-style prints with a shared palette, composed at the size of their frames.
export function drawCoastPrint(ctx, width, height, twilight) {
  const palette = twilight
    ? ['#d6a67e', '#e9bf89', '#987c74', '#586b70', '#3b545a']
    : ['#b6c9bc', '#e4cb93', '#849d97', '#607f80', '#385e65'];
  ctx.save();
  ctx.scale(width, height);
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = palette[1];
  ctx.beginPath();
  ctx.arc(twilight ? .34 : .69, .32, .12, 0, Math.PI * 2);
  ctx.fill();
  const ridge = (points, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.lineTo(1, 1);
    ctx.closePath();
    ctx.fill();
  };
  ridge([[0,.51],[.14,.47],[.26,.50],[.39,.47],[.59,.39],[.71,.45],[.85,.42],[1,.46]], palette[2]);
  ridge([[0,.61],[.22,.56],[.37,.57],[.64,.63],[.79,.62],[1,.60]], palette[3]);
  ctx.fillStyle = palette[1];
  for (let i = 0; i < 9; i++) {
    const x = (twilight ? .34 : .69) + Math.sin(i * 2.4) * .025;
    ctx.fillRect(x - .03 - i * .002, .59 + .022 * i, .06 + .004 * i, .005);
  }
  ridge(twilight
    ? [[0,.9],[.32,.82],[.57,.83],[.71,.71],[.79,.68],[1,.61]]
    : [[0,.66],[.13,.69],[.25,.74],[.36,.76],[.44,.85],[.66,.91],[1,.95]], palette[4]);
  ctx.restore();
}
