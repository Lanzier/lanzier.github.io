import { createCoastalTrees } from './coastal-trees.js';
import { COTTAGE } from './cottage-plan.js';
import { weatherSurface } from './weather.js';

const TAU = Math.PI * 2;
const coastX = 14.55;
const coastZ = 9.15;

function coastline(angle) {
  const shore = 1 + .077 * Math.cos(angle * 3 + .8) + .062 * Math.sin(angle * 5 - .5)
    + .038 * Math.cos(angle * 8 + 1.45) + .031 * Math.sin(angle * 13);
  // Widen the banks while keeping the front shoreline aligned with the dock.
  return shore * (1 - .12 * Math.max(0, Math.sin(angle)) ** 4);
}

function shorePoint(angle) {
  const radius = coastline(angle);
  return { x: Math.cos(angle) * coastX * radius, z: Math.sin(angle) * coastZ * radius };
}

function islandRadius(x, z) {
  const nx = x / coastX;
  const nz = z / coastZ;
  return Math.hypot(nx, nz) / coastline(Math.atan2(nz, nx));
}

function terrainHeight(x, z) {
  const radius = islandRadius(x, z);
  const ripples = Math.sin(x * .8 + z * .34) * .075 + Math.sin(x * .27 - z * 1.04) * .072;
  const shoulder = .88 - .13 * radius + ripples;
  return shoulder - .77 * Math.max(0, (radius - .79) / .21) ** 1.35;
}

export function createIsland(THREE, scene, weather) {
  let seed = 49871;
  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const range = (min, max) => min + rand() * (max - min);
  const pick = (items) => items[Math.floor(rand() * items.length)];
  const material = (color, settings = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, ...settings });
  const color = (value) => new THREE.Color(value);
  const root = new THREE.Group();
  scene.add(root);

  const cube = new THREE.BoxGeometry(1, 1, 1);
  const pebble = new THREE.IcosahedronGeometry(1, 0);
  const foliage = new THREE.IcosahedronGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const wood = material('#674337');
  const timber = material('#482c28');
  const woodLight = material('#aa7251');
  const copper = material('#9c6b48', { metalness: .3 });
  const cream = material('#f6dec0');
  const teal = material('#3c6c69');
  const coral = material('#b35e41');
  const black = material('#253437');
  const gold = material('#ceab63', { metalness: .15 });

  function mesh(parent, geometry, surface, x, y, z, sx = 1, sy = 1, sz = 1) {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(parent, surface, x, y, z, width, height, depth) {
    return mesh(parent, cube, surface, x, y, z, width, height, depth);
  }

  const dummy = new THREE.Object3D();
  function batch(parent, geometry, items, surface = material('#ffffff'), cast = true) {
    const instances = new THREE.InstancedMesh(geometry, surface, items.length);
    items.forEach(({ x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, tint }, index) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      instances.setMatrixAt(index, dummy.matrix);
      if (tint) instances.setColorAt(index, color(tint));
    });
    instances.castShadow = cast;
    instances.receiveShadow = true;
    parent.add(instances);
    return instances;
  }

  function pole(parent, surface, from, to, start, end = start) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const middle = a.clone().addScaledVector(direction, .5);
    const geometry = start === end ? cylinder : new THREE.CylinderGeometry(end, start, 1, 7);
    const radius = start === end ? start : 1;
    const object = mesh(parent, geometry, surface, middle.x, middle.y, middle.z, radius, direction.length(), radius);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return object;
  }

  function brace(parent, surface, from, to, width, depth = width) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const middle = a.clone().addScaledVector(direction, .5);
    const object = box(parent, surface, middle.x, middle.y, middle.z, width, direction.length(), depth);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return object;
  }

  const groundPositions = [];
  const groundColors = [];
  const greens = ['#73905a', '#789558', '#698850', '#68874d', '#6e8b51', '#849858', '#5f8050', '#79915c'];
  const sand = ['#b6a479', '#c0ab7e', '#ab9875', '#a7976d', '#bba883'];
  const stone = ['#8a8a70', '#93937c', '#9a9d87', '#797e69', '#a4a086'];
  function groundTriangle(a, b, c, tint) {
    const shade = color(tint);
    for (const point of [a, b, c]) {
      groundPositions.push(...point);
      groundColors.push(shade.r, shade.g, shade.b);
    }
  }

  const rings = [.1, .22, .34, .45, .55, .65, .73, .80, .87, .93, .985, 1.035, 1.065].map((radius, level) => (
    Array.from({ length: 64 }, (_, index) => {
      const angle = TAU * index / 64 + (level % 2 - .5) * .025;
      const { x: sx, z: sz } = shorePoint(angle);
      const x = sx * radius;
      const z = sz * radius;
      return [x, terrainHeight(x, z) + (level > 1 && level < 9 ? range(-.055, .055) : 0), z];
    })
  ));
  for (let index = 0; index < 64; index += 1) {
    const next = (index + 1) % 64;
    groundTriangle([0, terrainHeight(0, 0), 0], rings[0][next], rings[0][index], pick(greens));
    for (let level = 0; level < rings.length - 1; level += 1) {
      const palette = level < 8 ? greens : level < 11 ? sand : stone;
      const inner = rings[level];
      const outer = rings[level + 1];
      groundTriangle(inner[index], inner[next], outer[index], pick(palette));
      groundTriangle(inner[next], outer[next], outer[index], pick(palette));
    }
  }
  const groundGeometry = new THREE.BufferGeometry();
  groundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(groundPositions, 3));
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  groundGeometry.computeVertexNormals();
  mesh(root, groundGeometry, weatherSurface(material('#ffffff', { vertexColors: true }), weather), 0, 0, 0);

  const rockItems = [];
  for (let index = 0; index < 72; index += 1) {
    const angle = TAU * index / 72 + range(-.036, .036);
    const boulder = index % 6 === 0;
    const radius = boulder ? range(.90, .98) : range(.92, 1.035);
    const { x: sx, z: sz } = shorePoint(angle);
    const x = sx * radius;
    const z = sz * radius;
    const size = boulder ? range(.92, 1.64) : range(.15, .52);
    if (z > 6.7 && x > -.75 && x < 3.6) continue;
    rockItems.push({ x, y: Math.max(-.08, terrainHeight(x, z) - .11), z, sx: size * range(.87, 1.57), sy: size * range(.40, .85), sz: size * range(.70, 1.25), rx: range(-.4, .4), ry: angle, tint: pick(stone) });
  }
  for (const [x, z, s] of [[6.6, 5.4, .93], [7.1, 5.92, .72], [7.4, 5.34, .80], [-7.72, 3.7, .57], [-7.3, 4.14, .46], [-6.94, -4.7, .61], [6.25, -4.4, .56], [2.04, 5.39, .24], [2.32, 5.35, .32], [2.3, 5.76, .21]]) {
    rockItems.push({ x, y: terrainHeight(x, z) + .02, z, sx: s, sy: s * .7, sz: s * .75, ry: rand() * TAU, tint: pick(stone) });
  }
  batch(root, pebble, rockItems);

  function pathX(z) {
    const progress = THREE.MathUtils.clamp((z - 2.4) / 5.2, 0, 1);
    return -1.94 + 2.61 * progress + .26 * Math.sin(progress * Math.PI * 2);
  }

  const path = [];
  for (let index = 0; index < 20; index += 1) {
    const z = 2.68 + index * .252;
    const x = pathX(z);
    const y = terrainHeight(x, z);
    path.push({ x: x + range(-.06, .06), y: y + .027, z, sx: range(.53, .68), sy: range(.047, .072), sz: range(.17, .22), ry: range(-.22, .18), tint: pick(['#c2a179', '#b9976a', '#bca37b', '#ac9069', '#c4aa83']) });
  }
  batch(root, foliage, path);

  const dock = new THREE.Group();
  root.add(dock);
  const dockBoards = [];
  for (let index = 0; index < 21; index += 1) {
    const z = 7.33 + index * .183;
    dockBoards.push({ x: .67 + range(-.04, .04), y: .53, z, sx: range(1.55, 1.69), sy: .075, sz: .174, ry: range(-.025, .025), tint: pick(['#a77c54', '#aa7955', '#9e714f', '#b5835d', '#be9067']) });
  }
  batch(dock, cube, dockBoards);
  for (const offset of [-.67, .67]) {
    box(dock, timber, .67 + offset, .429, 9.15, .105, .125, 3.9);
    for (const z of [7.65, 9.06, 10.94]) {
      const x = .67 + offset;
      mesh(dock, cylinder, wood, x, .21, z, .083, 1.47, .083);
      mesh(dock, cylinder, woodLight, x, .96, z, .095, .048, .095);
      for (const y of [.72, .76, .80]) mesh(dock, cylinder, cream, x, y, z, .09, .024, .09);
    }
  }
  for (const x of [.37, .97]) box(dock, timber, x, .21, 11.17, .063, .83, .088);
  for (const y of [-.08, .09, .26, .43]) box(dock, woodLight, .67, y, 11.18, .66, .045, .075);

  const boat = new THREE.Group();
  boat.position.set(2.24, .066, 9.51);
  boat.rotation.y = -.34;
  root.add(boat);
  const boatShape = new THREE.Shape();
  boatShape.moveTo(0, 1.25);
  boatShape.quadraticCurveTo(-.69, .72, -.51, -.62);
  boatShape.quadraticCurveTo(-.44, -1.05, 0, -1.08);
  boatShape.quadraticCurveTo(.44, -1.05, .51, -.62);
  boatShape.quadraticCurveTo(.69, .72, 0, 1.25);
  const boatBase = new THREE.ExtrudeGeometry(boatShape, { depth: .11, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .07, bevelThickness: .05, curveSegments: 9 });
  const hull = mesh(boat, boatBase, woodLight, 0, .04, 0);
  hull.rotation.x = Math.PI / 2;
  const outline = boatShape.getPoints(12);
  const shipSide = [];
  for (let index = 1; index < outline.length; index += 1) {
    const a = outline[index - 1];
    const b = outline[index];
    const lowA = [a.x * .87, .03, a.y * .93];
    const highA = [a.x, .25, a.y];
    const lowB = [b.x * .87, .03, b.y * .93];
    const highB = [b.x, .25, b.y];
    shipSide.push(...lowA, ...lowB, ...highA, ...lowB, ...highB, ...highA);
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(shipSide, 3));
  shell.computeVertexNormals();
  mesh(boat, shell, material('#9e7153', { side: THREE.DoubleSide }), 0, 0, 0);
  const railCurve = new THREE.CatmullRomCurve3(outline.map((p) => new THREE.Vector3(p.x, .25, p.y)), true);
  mesh(boat, new THREE.TubeGeometry(railCurve, 50, .034, 5, true), timber, 0, 0, 0);
  for (const z of [-.46, .42]) box(boat, wood, 0, .19, z, .90, .051, .15);
  pole(boat, woodLight, [-.63, .26, -.95], [.50, .30, .85], .024);
  const paddle = mesh(boat, foliage, woodLight, .54, .3, .93, .072, .025, .19);
  paddle.rotation.y = .55;

  const house = new THREE.Group();
  root.add(house);
  const { floorY, centerZ: roofMiddle, chimneyX, chimneyZ, chimneyBaseY } = COTTAGE;
  const roomMount = new THREE.Group();
  roomMount.position.set(0, floorY, roofMiddle);
  house.add(roomMount);
  const front = 1.21;
  const back = -4.05;
  const bottom = 1.04;
  const { roofEave: eave, roofRidge: ridge, roofSpan } = COTTAGE;
  const wallSpan = 7.78;
  const mortar = material('#ac9176');
  const porchShade = material('#d9a675');
  const stucco = material('#e4c7a6');
  const innerGold = material('#dfb789', { emissive: '#cc7b35', emissiveIntensity: .20 });
  const slate = weatherSurface(material('#3d5256'), weather);
  const floor = material('#ad7854');
  box(house, mortar, 0, .89, (front + back) / 2, 7.98, .36, 5.50);
  box(house, floor, 0, floorY - .065, roofMiddle, wallSpan, .13, 5.24);
  const foundation = [];
  for (let row = 0; row < 2; row += 1) {
    for (let index = 0; index < 19; index += 1) {
      foundation.push({ x: -3.83 + index * .421 + (row - .5) * .15, y: .822 + row * .128, z: front + .148, sx: range(.34, .40), sy: range(.096, .121), sz: .12, tint: pick(['#bda081', '#c6a788', '#978674', '#b29177', '#ccab87']) });
    }
    for (let index = 0; index < 12; index += 1) {
      for (const side of [-1, 1]) foundation.push({ x: side * 4.007, y: .822 + row * .128, z: back + .3 + index * .43 + (row - .5) * .16, sx: .12, sy: range(.093, .12), sz: range(.34, .41), tint: pick(['#bda081', '#c6a788', '#978674', '#b29177']) });
    }
  }
  batch(house, cube, foundation);

  box(house, innerGold, 0, (bottom + eave) / 2, back, wallSpan, eave - bottom, .16);
  for (const side of [-1, 1]) {
    const x = side * 3.88;
    box(house, stucco, x, (bottom + eave) / 2, -3.15, .15, eave - bottom, 1.8);
    box(house, stucco, x, (bottom + eave) / 2, .61, .15, eave - bottom, 1.2);
    box(house, stucco, x, 1.46, -1.27, .15, .86, 2.23);
    box(house, stucco, x, 3.53, -1.27, .15, .33, 2.23);
    box(house, timber, x, 3.62, -1.42, .23, .18, 5.43);
    box(house, timber, x, 1.13, -1.42, .23, .19, 5.45);
    for (const z of [front, -2.36, -.16, back]) box(house, timber, x, 2.41, z, .22, 2.78, .15);
    for (const z of [-1.65, -.91]) box(house, wood, x, 2.65, z, .20, 1.52, .085);
    for (const y of [1.91, 2.80, 3.42]) box(house, wood, x, y, -1.26, .20, .087, 2.22);
    const endShape = new THREE.Shape();
    endShape.moveTo(0, 0);
    endShape.lineTo(5.4, 0);
    endShape.lineTo(2.70, ridge - eave - .025);
    endShape.closePath();
    const gable = mesh(house, new THREE.ShapeGeometry(endShape), material('#d8b795', { side: THREE.DoubleSide }), x, eave, 1.27);
    gable.rotation.y = Math.PI / 2;
    brace(house, timber, [x, eave - .02, 1.29], [x, ridge - .025, roofMiddle], .11, .12);
    brace(house, timber, [x, ridge - .025, roofMiddle], [x, eave - .02, -4.14], .11, .12);
    box(house, timber, x, eave + .63, roofMiddle, .16, 1.38, .13);
  }

  const windowGlass = material('#ffd891', { transparent: true, opacity: .18, depthWrite: false, metalness: .0, roughness: .22, emissive: '#ffaf50', emissiveIntensity: .30 });
  for (const x of [-3.876, 3.876]) {
    const pane = box(house, windowGlass, x, 2.65, -1.26, .019, 1.49, 2.18);
    pane.castShadow = false;
  }
  const frontSidePanel = material('#d4b695');
  box(house, frontSidePanel, -3.23, 2.36, front, 1.29, 2.59, .16);
  box(house, frontSidePanel, 3.47, 2.36, front, .85, 2.59, .16);
  box(house, frontSidePanel, .88, 1.29, front, 4.20, .48, .16);
  box(house, frontSidePanel, .88, 3.47, front, 4.20, .33, .16);
  for (const x of [-3.88, .91, 2.99, 3.88]) box(house, timber, x, 2.36, front + .036, .15, 2.73, .22);
  for (const y of [1.11, 3.63]) box(house, timber, 0, y, front + .049, 7.97, .19, .23);
  for (const y of [1.53, 3.35]) box(house, woodLight, .86, y, front + .098, 4.30, .10, .22);
  box(house, wood, .85, 2.91, front + .09, 4.21, .058, .12);
  brace(house, timber, [-3.82, 1.26, front + .128], [-2.64, 3.50, front + .128], .12, .092);
  brace(house, timber, [3.06, 3.52, front + .128], [3.80, 1.26, front + .128], .12, .092);
  for (const [x, width] of [[-.20, 2.06], [1.95, 2.00]]) {
    const pane = box(house, windowGlass, x, 2.44, front + .03, width, 1.82, .018);
    pane.castShadow = false;
  }

  // Keep the porch, shingles and planting variations from the original scene.
  seed = 2500481594;
  const porch = [];
  for (let index = 0; index < 9; index += 1) {
    porch.push({ x: .02, y: 1.015, z: 1.34 + index * .137, sx: 8.29, sy: .122, sz: .130, tint: pick(['#ad7b56', '#b88764', '#b0815c', '#a47450', '#c08d64']) });
  }
  batch(house, cube, porch);
  for (const [y, z, width] of [[.92, 2.59, 1.81], [.81, 2.78, 1.94]]) box(house, porchShade, -1.94, y, z, width, .105, .26);
  for (const x of [3.82, 2.46, .98, -3.97]) {
    box(house, timber, x, 1.40, 2.34, .113, .81, .113);
    box(house, woodLight, x, 1.822, 2.34, .16, .062, .16);
  }
  box(house, timber, 2.40, 1.61, 2.34, 3.03, .08, .087);
  box(house, wood, 2.40, 1.26, 2.34, 3.03, .074, .081);
  for (const x of [1.34, 1.72, 2.08, 2.42, 2.75, 3.1, 3.48]) box(house, wood, x, 1.44, 2.34, .061, .37, .063);
  for (const x of [2.5, 3.35]) box(house, timber, x, 1.23, 1.79, .10, .31, .31);
  box(house, woodLight, 2.93, 1.41, 1.79, 1.11, .10, .40);
  box(house, wood, 2.93, 1.65, 1.60, 1.10, .19, .075);

  const door = new THREE.Group();
  for (const x of [-2.57, -1.29]) box(door, timber, x, 2.36, front + .036, .15, 2.73, .22);
  box(door, timber, -1.93, 3.57, front + .054, 1.19, .13, .18);
  box(door, wood, -1.93, 1.11, front + .07, 1.14, .075, .21);
  const doorHinge = new THREE.Group();
  doorHinge.position.set(-2.49, bottom + .063, front + .102);
  house.add(door);
  door.add(doorHinge);
  const doorPaint = material('#62958c');
  box(doorHinge, teal, .55, 1.22, 0, 1.10, 2.44, .11);
  box(doorHinge, doorPaint, .55, .49, .065, .86, .66, .046);
  box(doorHinge, doorPaint, .55, 1.17, .065, .86, .49, .046);
  const doorGlass = material('#ffd795', { emissive: '#f7a348', emissiveIntensity: .64 });
  box(doorHinge, doorGlass, .55, 1.91, .063, .84, .73, .022);
  box(doorHinge, teal, .55, 1.91, .091, .055, .74, .049);
  box(doorHinge, teal, .55, 1.91, .091, .85, .052, .049);
  mesh(doorHinge, foliage, gold, .938, 1.08, .113, .052, .052, .049);
  const latch = box(doorHinge, gold, .938, 1.08, .091, .082, .122, .026);
  latch.rotation.z = .045;

  const pitch = Math.atan2(ridge - eave, roofSpan);
  const roofSlope = Math.hypot(roofSpan, ridge - eave);
  const roofColors = ['#50666a', '#536a6d', '#486064', '#576c6e', '#4e6869', '#5f7775', '#435c61', '#617777', '#597876'];
  const tiles = [];
  for (const side of [-1, 1]) {
    const angle = pitch * side;
    const roof = box(house, slate, 0, (ridge + eave) / 2, roofMiddle + side * roofSpan / 2, 8.83, .145, roofSlope + .06);
    roof.rotation.x = angle;
    const fascia = box(house, timber, 0, eave - .027, roofMiddle + side * roofSpan, 8.99, .195, .137);
    fascia.rotation.x = angle * .2;
    for (const x of [-4.40, 4.40]) {
      const roofVerge = box(house, wood, x, (ridge + eave) / 2 + .025, roofMiddle + side * roofSpan / 2, .17, .19, roofSlope + .20);
      roofVerge.rotation.x = angle;
    }
    for (let row = 0; row < 10; row += 1) {
      const distance = .11 + row * .334;
      for (let column = 0; column < 25; column += 1) {
        const x = (column - 12) * .349 + (row % 2 - .5) * .172;
        tiles.push({ x, y: ridge - distance * Math.sin(pitch) + .105 + range(-.009, .010), z: roofMiddle + side * distance * Math.cos(pitch), sx: range(.327, .348), sy: range(.034, .049), sz: range(.362, .392), rx: angle, ry: range(-.015, .015), tint: pick(roofColors) });
      }
    }
  }
  for (let index = 0; index < 20; index += 1) {
    tiles.push({ x: (index - 9.5) * .439, y: ridge + .116, z: roofMiddle, sx: .43, sy: .096, sz: .21, tint: pick(roofColors) });
  }
  batch(house, cube, tiles, weatherSurface(material('#ffffff'), weather));

  const brick = material('#99654c');
  const chimneyTopY = 5.785;
  box(house, brick, chimneyX, (chimneyTopY + chimneyBaseY) / 2, chimneyZ, .64, chimneyTopY - chimneyBaseY, .56);
  const masonry = [];
  for (let row = 0; row < 6; row += 1) {
    const y = 4.44 + row * .225;
    for (let column = 0; column < 2; column += 1) {
      masonry.push({ x: chimneyX - .15 + column * .3 + (row % 2 - .5) * .04, y, z: chimneyZ + .287, sx: .284, sy: .20, sz: .05, tint: pick(['#b27960', '#9f5c47', '#b06f53', '#a56a55']) });
      masonry.push({ x: chimneyX + .335, y, z: chimneyZ - .13 + column * .259, sx: .046, sy: .203, sz: .237, tint: pick(['#a16450', '#ad6e58', '#9f5c47']) });
    }
  }
  batch(house, cube, masonry);
  box(house, mortar, chimneyX, 5.80, chimneyZ, .77, .154, .67);
  box(house, timber, chimneyX, 5.885, chimneyZ, .40, .026, .35);

  const lampGlass = material('#ffda8f', { emissive: '#ffc373', emissiveIntensity: 2.1 });
  function lantern(parent, x, y, z, size) {
    box(parent, lampGlass, x, y, z, size * .69, size, size * .69).castShadow = false;
    for (const dx of [-.39, .39]) for (const dz of [-.39, .39]) box(parent, black, x + dx * size, y, z + dz * size, size * .075, size * 1.16, size * .075);
    for (const dy of [-.55, .55]) box(parent, black, x, y + dy * size, z, size * .91, size * .105, size * .91);
    mesh(parent, new THREE.ConeGeometry(.65, .34, 4), black, x, y + .73 * size, z, size, size, size).rotation.y = Math.PI / 4;
  }
  lantern(house, -2.94, 2.97, 1.46, .31);
  box(house, black, -2.94, 3.24, 1.37, .053, .067, .27);
  const porchLamp = new THREE.PointLight('#ffac57', 8.5, 5.3, 1.8);
  porchLamp.position.set(-2.94, 2.92, 1.66);
  house.add(porchLamp);
  lantern(dock, .02, .90, 7.65, .19);

  const leafColors = ['#48734b', '#537c4c', '#65894e', '#719155', '#7b9c5d', '#5d814e', '#3a694f', '#91a860'];
  const leafItems = [];
  createCoastalTrees(THREE, root, terrainHeight, weather);

  const shrubBeds = [
    [-10.7, -1.9, .55], [-9.3, 3.2, .62], [-7.25, 3.1, .46], [-6.95, 5.18, .48],
    [-5.93, 5.91, .38], [-7.7, -.7, .43], [9.75, 2.04, .54], [10.55, -2.0, .55],
    [7.2, 3.48, .50], [5.3, 4.95, .44], [3.7, 3.12, .30], [6.27, 5.12, .39],
    [-2.52, 5.75, .32], [4.79, -.08, .39], [-4.63, 2.79, .36], [-5.74, -.08, .50],
    [2.47, 6.11, .43], [-3.62, -.5, .24], [4.90, -6.06, .48], [-6.25, -6.05, .39],
  ];
  for (const [x, z, scale] of shrubBeds) {
    for (let index = 0; index < 7; index += 1) {
      const px = x + range(-.95, .95) * scale;
      const pz = z + range(-.95, .95) * scale;
      leafItems.push({ x: px, y: terrainHeight(px, pz) + .22 * scale, z: pz, sx: scale * range(.42, 1.09), sy: scale * range(.32, .73), sz: scale * range(.39, .81), ry: range(0, TAU), tint: pick(leafColors) });
    }
  }
  batch(root, foliage, leafItems);

  const garden = new THREE.Group();
  root.add(garden);
  const gardenX = -4.95;
  const gardenZ = 4.37;
  const gardenY = terrainHeight(gardenX, gardenZ);
  garden.position.set(gardenX, gardenY, gardenZ);
  garden.rotation.y = -.15;
  const soil = material('#735743');
  const darkSoil = material('#5b4835');
  box(garden, darkSoil, 0, .055, 0, 3.28, .13, 2.62);
  for (const x of [-1.67, 1.67]) box(garden, woodLight, x, .096, 0, .1, .17, 2.78);
  for (const z of [-1.35, 1.35]) box(garden, woodLight, 0, .092, z, 3.42, .15, .104);
  for (const x of [-1.1, 0, 1.1]) mesh(garden, foliage, soil, x, .117, 0, .46, .16, 1.29);
  const vines = [];
  const melonBase = new THREE.SphereGeometry(1, 13, 8);
  const melonColors = [];
  const melonUV = melonBase.getAttribute('uv');
  for (let index = 0; index < melonUV.count; index += 1) {
    const band = Math.sin(melonUV.getX(index) * TAU * 6 + Math.sin(melonUV.getY(index) * TAU * 2) * .63);
    const shade = color(band > .15 ? '#3c8261' : '#78aa59');
    melonColors.push(shade.r, shade.g, shade.b);
  }
  melonBase.setAttribute('color', new THREE.Float32BufferAttribute(melonColors, 3));
  const melonMaterial = material('#ffffff', { vertexColors: true });
  const melons = [];
  for (const row of [-1.10, 0, 1.10]) {
    for (let column = 0; column < 3; column += 1) {
      const x = row + range(-.15, .13);
      const z = -.80 + column * .80 + range(-.20, .15);
      const size = range(.19, .30);
      const melon = mesh(garden, melonBase, melonMaterial, x, .23 + size * .51, z, size * 1.23, size * .86, size);
      melon.rotation.set(.15, range(0, TAU), range(-.37, .37));
      melons.push(melon);
      for (let leaf = 0; leaf < 12; leaf += 1) {
        vines.push({ x: x + range(-.45, .45), y: range(.18, .27), z: z + range(-.37, .37), sx: range(.087, .21), sy: range(.022, .046), sz: range(.070, .16), ry: range(0, TAU), rz: range(-.23, .23), tint: pick(['#57834c', '#5f8f50', '#77a15a', '#80a65c']) });
      }
    }
  }
  batch(garden, foliage, vines);
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 192;
  signCanvas.height = 100;
  const signContext = signCanvas.getContext('2d');
  signContext.fillStyle = '#edd0a2';
  signContext.fillRect(0, 0, 192, 100);
  signContext.strokeStyle = '#8b674f';
  signContext.lineWidth = 5;
  signContext.strokeRect(8, 8, 176, 84);
  signContext.fillStyle = '#565c44';
  signContext.font = 'bold 38px sans-serif';
  signContext.textAlign = 'center';
  signContext.textBaseline = 'middle';
  signContext.fillText('西瓜田', 96, 52);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  box(garden, wood, 1.00, .38, -.96, .067, .73, .07);
  mesh(garden, new THREE.PlaneGeometry(.63, .34), material('#ffffff', { map: signTexture, side: THREE.DoubleSide }), 1.00, .68, -.94).rotation.x = -.13;

  const fenceWood = material('#edddc5');
  function fence(from, to) {
    const [ax, az] = from;
    const [bx, bz] = to;
    const count = Math.ceil(Math.hypot(bx - ax, bz - az) * 4.1);
    for (const y of [.31, .57]) brace(root, fenceWood, [ax, terrainHeight(ax, az) + y, az], [bx, terrainHeight(bx, bz) + y, bz], .085);
    for (let index = 0; index <= count; index += 1) {
      const x = THREE.MathUtils.lerp(ax, bx, index / count);
      const z = THREE.MathUtils.lerp(az, bz, index / count);
      const y = terrainHeight(x, z);
      const thick = index % count === 0;
      const width = thick ? .133 : .078;
      const height = thick ? .81 : .68;
      box(root, fenceWood, x, y + height * .47, z, width, height, width * .85);
      mesh(root, new THREE.ConeGeometry(width * .70, width * .69, 4), fenceWood, x, y + height * .98, z).rotation.y = Math.PI / 4;
    }
  }
  fence([4.08, 4.70], [6.56, 4.70]);
  fence([6.56, 4.70], [6.56, 2.65]);

  const dirtPatch = (x, z, width, depth) => {
    const patch = mesh(root, foliage, darkSoil, x, terrainHeight(x, z) - .03, z, width, .14, depth);
    patch.castShadow = false;
  };
  dirtPatch(5.37, 3.70, 1.15, .68);

  const blossoms = [];
  const petalStems = [];
  const centres = [];
  for (let cluster = 0; cluster < 62; cluster += 1) {
    const angle = range(0, TAU);
    const radius = range(.41, .88);
    const { x: sx, z: sz } = shorePoint(angle);
    const cx = sx * radius;
    const cz = sz * radius;
    if ((Math.abs(cx) < 4.35 && cz < 2.76 && cz > -4.7) || (cx < -3.15 && cx > -6.7 && cz > 2.8 && cz < 5.9) || (cz > 2.48 && Math.abs(pathX(cz) - cx) < .72)) continue;
    const tint = pick(['#f8e6a5', '#fbdb9f', '#ffe3ce', '#e3b4b9', '#eaa2a1', '#c8a6d0', '#f4e2c9']);
    for (let index = 0; index < 7; index += 1) {
      const x = cx + range(-.34, .34);
      const z = cz + range(-.34, .34);
      const y = terrainHeight(x, z);
      const height = range(.14, .41);
      const radius = range(.035, .063);
      petalStems.push({ x, y: y + height * .44, z, sx: .012, sy: height * 1.02, sz: .012, tint: '#527b53' });
      centres.push({ x, y: y + height, z, sx: radius, sy: radius * .45, sz: radius, tint: '#e8b65d' });
      for (let petal = 0; petal < 5; petal += 1) {
        const a = petal * TAU / 5;
        blossoms.push({ x: x + Math.sin(a) * radius, y: y + height, z: z + Math.cos(a) * radius, sx: radius * .54, sy: radius * .34, sz: radius * .90, ry: a, tint });
      }
    }
  }
  batch(root, foliage, blossoms, material('#ffffff'), false);
  batch(root, foliage, centres, material('#ffffff'), false);
  batch(root, cylinder, petalStems, material('#ffffff'), false);

  const grassPositions = [];
  const grassColors = [];
  const grassHeights = [];
  const grassPalette = ['#778f4c', '#829d58', '#678853', '#52764a', '#8b9e5f', '#78995a', '#b5b174', '#6a8f54'].map(color);
  for (let index = 0; index < 14500; index += 1) {
    const x = range(-coastX * 1.12, coastX * 1.12);
    const z = range(-coastZ * 1.12, coastZ * 1.12);
    const r = islandRadius(x, z);
    if (r > .94 || (Math.abs(x) < 4.26 && z > -4.33 && z < 2.51)
      || (x < -3.18 && x > -6.77 && z > 2.73 && z < 6.0)
      || (z > 2.56 && Math.abs(pathX(z) - x) < .55)
      || (z > 3.03 && z < 4.38 && x > 4.21 && x < 6.44)) continue;
    const height = range(.084, .31) * (r > .87 ? .78 : 1);
    const y = terrainHeight(x, z) - .047;
    const tint = pick(grassPalette);
    const base = tint.clone().multiplyScalar(.67);
    for (let blade = 0; blade < 3; blade += 1) {
      const angle = range(0, TAU);
      const w = range(.019, .034);
      const offsetX = Math.sin(angle) * w;
      const offsetZ = Math.cos(angle) * w;
      grassPositions.push(x - offsetX, y, z - offsetZ, x + offsetX, y, z + offsetZ, x + range(-.082, .082), y + height * range(.65, 1.14), z + range(-.082, .082));
      grassColors.push(base.r, base.g, base.b, base.r, base.g, base.b, tint.r, tint.g, tint.b);
      grassHeights.push(0, 0, height);
    }
  }
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
  grassGeometry.setAttribute('color', new THREE.Float32BufferAttribute(grassColors, 3));
  grassGeometry.setAttribute('bladeHeight', new THREE.Float32BufferAttribute(grassHeights, 1));
  grassGeometry.computeVertexNormals();
  const wind = { value: 0 };
  const grassMaterial = material('#ffffff', { vertexColors: true, side: THREE.DoubleSide });
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.islandWind = wind;
    shader.vertexShader = 'uniform float islandWind; attribute float bladeHeight;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed.x += sin(islandWind * 1.95 + transformed.x * 1.30 + transformed.z * .68) * bladeHeight * .21;
      transformed.z += sin(islandWind * 1.43 + transformed.z * 1.06) * bladeHeight * .16;
    `);
  };
  mesh(root, grassGeometry, grassMaterial, 0, 0, 0).castShadow = false;

  const clothes = [];
  pole(root, timber, [5.31, terrainHeight(5.31, .6), .6], [5.31, 2.48, .6], .049, .041);
  const rope = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.86, 2.46, 1.17), new THREE.Vector3(4.57, 2.35, .89), new THREE.Vector3(5.31, 2.45, .6),
  ]);
  mesh(root, new THREE.TubeGeometry(rope, 16, .012, 5, false), woodLight, 0, 0, 0);
  for (const [progress, height, tint] of [[.20, .50, '#e9c68d'], [.54, .55, '#80aea9'], [.83, .46, '#e4a27d']]) {
    const p = rope.getPoint(progress);
    const pivot = new THREE.Group();
    pivot.position.copy(p);
    pivot.rotation.y = .36;
    root.add(pivot);
    const fabric = material(tint, { side: THREE.DoubleSide });
    mesh(pivot, new THREE.PlaneGeometry(.33, height, 3, 5), fabric, 0, -height / 2, 0);
    box(pivot, wood, -.119, .016, 0, .034, .077, .031);
    box(pivot, wood, .119, .016, 0, .034, .077, .031);
    clothes.push(pivot);
  }

  const pottedLeaves = material('#678653');
  for (const [x, z, size] of [[-2.93, 2.07, .21], [-3.28, 2.21, .12], [-.87, 1.95, .17], [3.72, 2.00, .14]]) {
    mesh(house, new THREE.CylinderGeometry(1, .70, 1.30, 9), coral, x, 1.09 + size * .65, z, size, size, size);
    mesh(house, cylinder, soil, x, 1.09 + size * 1.31, z, size * .90, .018, size * .90);
    for (let leaf = 0; leaf < 8; leaf += 1) {
      const angle = leaf * 2.4;
      const sprig = mesh(house, foliage, pottedLeaves, x + Math.cos(angle) * size * .72, 1.12 + size * range(1.61, 2.71), z + Math.sin(angle) * size * .73, size * .42, size * .85, size * .28);
      sprig.rotation.set(Math.sin(angle) * .62, angle, Math.cos(angle) * .61);
    }
  }

  const smoke = Array.from({ length: 12 }, (_, index) => {
    const puff = new THREE.Mesh(foliage, new THREE.MeshBasicMaterial({ color: '#f7e1ce', transparent: true, depthWrite: false }));
    puff.renderOrder = 3;
    root.add(puff);
    return { puff, delay: index / 12 };
  });

  function update(time, daylight = 1) {
    wind.value = time;
    boat.position.y = .077 + Math.sin(time * 1.45) * .053;
    boat.rotation.x = Math.sin(time * 1.23) * .034;
    boat.rotation.z = Math.cos(time * 1.13) * .046;
    clothes.forEach((cloth, index) => { cloth.rotation.x = .08 + Math.sin(time * 1.85 + index * .77) * .13; });
    for (const { puff, delay } of smoke) {
      const life = (time * .23 + delay) % 1;
      const scale = .078 + life * .31;
      puff.position.set(chimneyX + life * .93 + Math.sin(life * 5.8 + time * .63) * life * .19, 5.89 + life * 1.68, chimneyZ - life * .28);
      puff.scale.set(scale * 1.14, scale, scale * 1.2);
      puff.material.opacity = Math.sin(life * Math.PI) * .11;
    }
    porchLamp.intensity = (8.5 + Math.sin(time * 5.1) * .45) * (1.66 - daylight * .62);
    windowGlass.opacity = .21 - daylight * .09;
  }

  return {
    door,
    doorHinge,
    roomMount,
    garden,
    doorAnchor: new THREE.Vector3(-1.94, 2.58, 1.48),
    gardenAnchor: new THREE.Vector3(gardenX, gardenY + .77, gardenZ),
    melons,
    shorePoint,
    shoreSize: [coastX, coastZ],
    terrainHeight,
    update,
  };
}
