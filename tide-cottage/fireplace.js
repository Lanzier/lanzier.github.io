export function createFireplace(THREE, { flueHeight = 3.45, light = true } = {}) {
  const group = new THREE.Group();
  group.name = '石砌壁炉';
  const stone = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.98 });
  const stones = ['#c0a991', '#ae987f', '#bba68f', '#a99079', '#d0bba0', '#b29d88'].map(stone);
  const mortar = stone('#74675b');
  const hearth = stone('#9d8a75');
  const soot = stone('#2d2522');
  const firebrick = stone('#4d3933');
  const oak = stone('#77513b');
  const oakEdge = stone('#966c4c');
  const iron = new THREE.MeshStandardMaterial({ color: '#342a28', metalness: 0.58, roughness: 0.58 });
  const logBark = stone('#594036');
  const logGrain = stone('#8b5a3d');
  const coal = new THREE.MeshStandardMaterial({
    color: '#6f3528', roughness: 0.97, emissive: '#b22712', emissiveIntensity: 0.64
  });
  const ember = new THREE.MeshBasicMaterial({ color: '#ff8545', toneMapped: false });
  const liveFlame = new THREE.MeshBasicMaterial({ color: '#ffad4d', toneMapped: false });
  const outerFlame = new THREE.MeshBasicMaterial({ color: '#f37032', toneMapped: false });
  const innerFlame = new THREE.MeshBasicMaterial({ color: '#fff2ad', toneMapped: false });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const roundCoal = new THREE.IcosahedronGeometry(1, 0);

  function mesh(geometry, material, x, y, z, shadow = false) {
    const piece = new THREE.Mesh(geometry, material);
    piece.position.set(x, y, z);
    piece.castShadow = shadow;
    piece.receiveShadow = shadow;
    group.add(piece);
    return piece;
  }

  function box(w, h, d, x, y, z, material, shadow = true) {
    const piece = mesh(cube, material, x, y, z, shadow);
    piece.scale.set(w, h, d);
    return piece;
  }

  // The recessed brick chamber stays dark even in the afternoon.
  box(1.36, 0.083, 0.676, 0, 0.042, 0.055, hearth);
  box(1.31, 0.035, 0.632, 0, 0.083, 0.060, stones[2]);
  box(1.29, 1.26, 0.12, 0, 0.70, -0.228, mortar);
  box(0.79, 1.09, 0.085, 0, 0.65, -0.15, soot, false);
  box(0.78, 0.045, 0.46, 0, 0.114, 0.051, firebrick);
  for (const side of [-1, 1]) {
    box(0.26, 1.23, 0.43, side * 0.504, 0.71, 0.041, mortar);
    box(0.036, 1.05, 0.239, side * 0.374, 0.643, 0.023, firebrick, false);
  }
  for (const y of [0.31, 0.48, 0.65, 0.82, 0.99]) {
    box(0.72, 0.01, 0.005, 0, y, -0.106, mortar, false);
  }
  box(1.26, 0.18, 0.449, 0, 1.29, 0.044, mortar);

  const rng = (index) => {
    const value = Math.sin((index + 13.6) * 19.244) * 7578.05;
    return value - Math.floor(value);
  };
  const batches = stones.map(() => []);
  function masonry(w, h, d, x, y, z, index) {
    batches[index % stones.length].push({ w, h, d, x, y, z, index });
  }

  // Stagger the pier joints and align the stone arch with the voussoirs below.
  for (let row = 0; row < 8; row += 1) {
    const y = 0.173 + row * 0.145;
    for (const side of [-1, 1]) {
      const index = 2 * row + (side + 1) / 2;
      const start = row < 5 ? 0.365 : 0.46;
      const width = 0.628 - start;
      const split = row % 3 ? 0.47 : 0.60;
      const widths = [width * split, width * (1 - split)];
      masonry(widths[0] - 0.013, 0.131, 0.066, side * (start + widths[0] / 2), y, 0.26, index);
      masonry(widths[1] - 0.013, 0.134, 0.073, side * (start + widths[0] + widths[1] / 2), y, 0.26, index + 3);
      masonry(0.083, 0.133, 0.377, side * 0.608, y, 0.007, index + 4);
    }
  }
  for (let index = 0; index < 7; index += 1) {
    const from = index * Math.PI / 7 + 0.016;
    const to = (index + 1) * Math.PI / 7 - 0.016;
    const center = 0.744;
    const inner = 0.352;
    const outer = index === 3 ? 0.509 : 0.478;
    const block = new THREE.Shape();
    block.moveTo(Math.cos(from) * inner, center + Math.sin(from) * inner);
    block.absarc(0, center, inner, from, to, false);
    block.lineTo(Math.cos(to) * outer, center + Math.sin(to) * outer);
    block.absarc(0, center, outer, to, from, true);
    block.closePath();
    const piece = new THREE.ExtrudeGeometry(block, {
      depth: 0.094, steps: 1, curveSegments: 4, bevelEnabled: true, bevelSize: 0.007, bevelThickness: 0.006, bevelSegments: 1
    });
    mesh(piece, stones[(index + 2) % stones.length], 0, 0, 0.218, true);
  }
  for (let x = -0.51, index = 0; x <= 0.52; x += 0.204, index += 1) {
    masonry(0.187, 0.062, 0.068, x, 1.318, 0.283, index + 1);
  }

  box(1.37, 0.078, 0.59, 0, 1.394, 0.027, oak);
  box(1.42, 0.044, 0.61, 0, 1.455, 0.032, oakEdge);
  box(0.133, 0.158, 0.22, -0.499, 1.295, 0.305, oak);
  box(0.133, 0.158, 0.22, 0.499, 1.295, 0.305, oak);
  box(0.84, 0.145, 0.385, 0, 1.53, -0.052, stones[1]);

  const top = Math.max(1.61, flueHeight);
  const shaftHeight = top - 1.60;
  box(0.624, shaftHeight, 0.32, 0, (top + 1.60) / 2, -0.069, mortar);
  const rows = Math.max(1, Math.ceil(shaftHeight / 0.157));
  for (let row = 0; row < rows; row += 1) {
    const h = shaftHeight / rows;
    const y = 1.60 + (row + 0.5) * h;
    const lines = row % 2 ? [-0.31, -0.094, 0.121, 0.31] : [-0.31, -0.191, 0.029, 0.219, 0.31];
    for (let index = 0; index + 1 < lines.length; index += 1) {
      const left = lines[index];
      const right = lines[index + 1];
      masonry(right - left - 0.012, Math.max(0.008, h - 0.014), 0.041, (left + right) / 2, y, 0.099, index + row + 1);
    }
    for (const side of [-1, 1]) {
      masonry(0.04, Math.max(0.008, h - 0.014), 0.306, side * 0.309, y, -0.062, row + side + 2);
    }
  }
  const transform = new THREE.Object3D();
  for (const [index, pieces] of batches.entries()) {
    if (!pieces.length) continue;
    const batch = new THREE.InstancedMesh(cube, stones[index], pieces.length);
    batch.castShadow = true;
    batch.receiveShadow = true;
    for (const [instance, piece] of pieces.entries()) {
      transform.position.set(piece.x, piece.y, piece.z);
      transform.rotation.set(0, 0, (rng(piece.index) - 0.5) * 0.027);
      transform.scale.set(piece.w, piece.h, piece.d);
      transform.updateMatrix();
      batch.setMatrixAt(instance, transform.matrix);
    }
    group.add(batch);
  }

  for (const x of [-0.258, 0.258]) box(0.028, 0.132, 0.028, x, 0.211, 0.232, iron);
  box(0.554, 0.026, 0.036, 0, 0.225, 0.225, iron);
  for (const x of [-0.21, -0.105, 0, 0.105, 0.21]) {
    box(0.021, 0.024, 0.223, x, 0.177, 0.114, iron);
  }
  const log = new THREE.CylinderGeometry(0.049, 0.06, 0.34, 9);
  const end = new THREE.CylinderGeometry(0.043, 0.043, 0.008, 9);
  for (const [x, y, z, yaw] of [[-0.077, 0.215, 0.106, 0.35], [0.037, 0.234, 0.155, -0.44], [0.034, 0.283, 0.114, 0.54]]) {
    const wood = mesh(log, logBark, x, y, z, true);
    wood.rotation.order = 'YXZ';
    wood.rotation.set(Math.PI / 2, Math.PI / 2 + yaw, 0);
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(wood.quaternion);
    for (const side of [-1, 1]) {
      const cap = mesh(end, logGrain, x + side * direction.x * 0.172, y, z + side * direction.z * 0.172);
      cap.quaternion.copy(wood.quaternion);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    const chunk = mesh(roundCoal, index % 3 ? coal : ember, -0.245 + index * 0.069, 0.153 + 0.021 * rng(index + 14), 0.12 + rng(index + 12) * 0.08);
    chunk.scale.set(0.042, 0.022, 0.044);
    chunk.rotation.y = rng(index + 8) * Math.PI;
  }

  function flameGeometry(bend) {
    const profile = [
      [0, 0], [0.68, 0.03], [0.92, 0.17], [0.79, 0.34], [0.59, 0.52], [0.29, 0.76], [0.12, 0.89], [0, 1]
    ].map(([radius, height]) => new THREE.Vector2(radius, height));
    const geometry = new THREE.LatheGeometry(profile, 8);
    const points = geometry.attributes.position;
    for (let index = 0; index < points.count; index += 1) {
      const y = points.getY(index);
      points.setX(index, points.getX(index) + bend * y * y);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  const flameShapes = [flameGeometry(0.61), flameGeometry(-0.46)];
  const flames = [
    [-0.159, 0.285, 0.105, 0.068, 0.288, outerFlame],
    [-0.099, 0.275, 0.136, 0.075, 0.368, liveFlame],
    [0.021, 0.283, 0.111, 0.080, 0.485, outerFlame],
    [0.021, 0.281, 0.153, 0.066, 0.379, liveFlame],
    [0.118, 0.273, 0.132, 0.069, 0.299, liveFlame],
    [0.173, 0.267, 0.092, 0.061, 0.324, outerFlame],
    [-0.086, 0.268, 0.17, 0.034, 0.177, innerFlame],
    [0.038, 0.269, 0.18, 0.036, 0.214, innerFlame],
    [0.117, 0.265, 0.165, 0.027, 0.165, innerFlame]
  ].map(([x, y, z, width, height, material], index) => ({
    piece: mesh(flameShapes[index % 2], material, x, y, z), x, width, height
  }));

  const sparks = Array.from({ length: 6 }, (_, index) => mesh(roundCoal, index % 2 ? ember : innerFlame, 0, 0, 0));
  const lamp = light ? new THREE.SpotLight('#ff9b53', 4.6, 3.1, 1.02, .83, 2) : null;
  if (lamp) {
    lamp.position.set(0, 0.38, 0.39);
    lamp.target.position.set(0, .42, 2.2);
    group.add(lamp, lamp.target);
  }

  function update(time, daylight = 1) {
    const sway = Math.sin(time * 4.13);
    for (const [index, { piece, x, width, height }] of flames.entries()) {
      const phase = time * (5.1 + index * 0.13) + index * 1.42;
      piece.position.x = x + Math.sin(phase * 0.7) * 0.019;
      piece.scale.set(width * (1 + 0.105 * Math.sin(phase)), height * (0.91 + 0.16 * Math.sin(phase + 0.8)), width * 0.55);
      piece.rotation.z = 0.11 * sway + 0.10 * Math.sin(phase * 0.81);
    }
    for (const [index, spark] of sparks.entries()) {
      const age = (time * (0.42 + 0.05 * index) + index * 0.151) % 1;
      spark.position.set((rng(index) - 0.5) * 0.36 + Math.sin(age * 5 + index) * 0.044, 0.38 + age * 0.599, 0.155 + rng(index + 17) * 0.072);
      spark.scale.setScalar(0.013 * Math.sin(age * Math.PI));
    }
    const flicker = 0.92 + 0.09 * sway + 0.045 * Math.sin(time * 11.7);
    coal.emissiveIntensity = 0.68 * flicker;
    if (lamp) lamp.intensity = (4.3 - 1.6 * daylight) * flicker;
  }

  update(0);
  return { group, update };
}
