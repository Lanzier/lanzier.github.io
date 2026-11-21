import { createCoastalTrees } from './coastal-trees.js';
import { createOutdoorNavigation } from './outdoor-navigation.js';
import { botanicalMesh } from './botanical-mesh.js';
import { COTTAGE, DOORWAY } from './cottage-plan.js';
import { batchCottageParts, makeLimewash, makeRidgeCap, makeRoofSlate } from './cottage-craft.js';
import { weatherSurface } from './weather.js';

import { coastX, coastZ, islandRadius, shorePoint, terrainHeight } from './topography.js';
import { createTidalLandscape } from './tidal-landscape.js';
import { createMeadowPath } from './meadow-path.js';

const TAU = Math.PI * 2;

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
  const navigation = createOutdoorNavigation(THREE);

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

  const tideTime = createTidalLandscape(THREE, root, weather, batch, navigation);

  function pathX(z) {
    const progress = THREE.MathUtils.clamp((z - 2.4) / 5.2, 0, 1);
    return -1.94 + 2.61 * progress + .26 * Math.sin(progress * Math.PI * 2);
  }

  createMeadowPath(THREE, root, pathX, weather, batch, navigation);

  const dock = new THREE.Group();
  root.add(dock);
  // Grain runs along the planks. Using a shared map also leaves each board's sun-bleached tint visible.
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 192;
  grainCanvas.height = 40;
  const grain = grainCanvas.getContext('2d');
  grain.fillStyle = '#fff6e6';
  grain.fillRect(0, 0, 192, 40);
  for (let strand = 0; strand < 27; strand++) {
    const y = strand * 1.57;
    grain.strokeStyle = strand % 5 ? 'rgba(98,77,61,.15)' : 'rgba(104,76,52,.31)';
    grain.lineWidth = strand % 4 ? .66 : 1;
    grain.beginPath();
    for (let x = 0; x <= 192; x += 4) {
      const knot = Math.exp(-(((x - 59) / 18) ** 2 + ((y - 14) / 6) ** 2));
      const height = y + Math.sin(x * .04 + y) * .63 + Math.sign(y - 14) * knot * 4;
      if (x) grain.lineTo(x, height);
      else grain.moveTo(x, height);
    }
    grain.stroke();
  }
  const pierGrain = new THREE.CanvasTexture(grainCanvas);
  pierGrain.colorSpace = THREE.SRGBColorSpace;
  pierGrain.anisotropy = 4;
  const dockBoards = [];
  for (let index = 0; index < 21; index += 1) {
    const z = 7.33 + index * .183;
    dockBoards.push({ x: .67 + range(-.04, .04), y: .53, z, sx: range(1.55, 1.69), sy: .075, sz: .174, ry: range(-.025, .025), tint: pick(['#a77c54', '#aa7955', '#9e714f', '#b5835d', '#be9067']) });
  }
  batch(dock, cube, dockBoards, weatherSurface(material('#ffffff', { map: pierGrain }), weather));
  const dockPiles = [], dockCaps = [], dockLashings = [], dockRails = [], dockRungs = [];
  for (const offset of [-.67, .67]) {
    dockRails.push({ x: .67 + offset, y: .429, z: 9.15, sx: .105, sy: .125, sz: 3.9 });
    for (const z of [7.65, 9.06, 10.94]) {
      const x = .67 + offset;
      navigation.barrier(x,z,x,z,.095);
      dockPiles.push({ x, y: .21, z, sx: .083, sy: 1.47, sz: .083 });
      dockCaps.push({ x, y: .96, z, sx: .095, sy: .048, sz: .095 });
      for (const y of [.72, .76, .80]) dockLashings.push({ x, y, z, sx: .09, sy: .024, sz: .09 });
    }
  }
  for (const x of [.37, .97]) dockRails.push({ x, y: .21, z: 11.17, sx: .063, sy: .83, sz: .088 });
  for (const y of [-.08, .09, .26, .43]) dockRungs.push({ x: .67, y, z: 11.18, sx: .66, sy: .045, sz: .075 });
  batch(dock, cylinder, dockPiles, wood);
  batch(dock, cylinder, dockCaps, woodLight);
  batch(dock, cylinder, dockLashings, cream);
  batch(dock, cube, dockRails, timber);
  batch(dock, cube, dockRungs, woodLight);
  const coil = [];
  for (let i = 0; i <= 56; i++) {
    const turn = i / 56;
    const theta = turn * TAU * 2.8;
    const radius = .05 + .18 * turn;
    coil.push(new THREE.Vector3(.18 + radius * Math.cos(theta), .585, 9.63 + radius * .83 * Math.sin(theta)));
  }
  navigation.support(mesh(dock, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 60, .019, 5, false), material('#b09b75'), 0, 0, 0));

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
  const gunwaleHeight = z => .292 + .084 * (Math.abs(z) / 1.25) ** 2 + .026 * z;
  const shipSide = [];
  for (let index = 1; index < outline.length; index += 1) {
    const a = outline[index - 1];
    const b = outline[index];
    const lowA = [a.x * .87, .03, a.y * .93];
    const highA = [a.x, gunwaleHeight(a.y), a.y];
    const lowB = [b.x * .87, .03, b.y * .93];
    const highB = [b.x, gunwaleHeight(b.y), b.y];
    shipSide.push(...lowA, ...lowB, ...highA, ...lowB, ...highB, ...highA);
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(shipSide, 3));
  shell.computeVertexNormals();
  mesh(boat, shell, material('#567d78', { side: THREE.DoubleSide }), 0, 0, 0);
  const railCurve = new THREE.CatmullRomCurve3(outline.slice(0, -1).map(p => new THREE.Vector3(p.x, gunwaleHeight(p.y), p.y)), true);
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
  // Leave exactly the framed opening in the front wall. The exterior route joins
  // the interior doorway crossing here, with the same character clearance.
  navigation.block(-4.10, back-.19, 4.10, front-1.24);
  navigation.block(-4.10, front-1.24, -2.495, front+.19);
  navigation.block(-1.365, front-1.24, 4.10, front+.19);
  const mortar = material('#ac9176');
  const porchShade = material('#d9a675');
  const limewash = makeLimewash(THREE);
  const stucco = material('#e5cba9', { map: limewash });
  const rearStucco = material('#cdbb9f', { map: limewash });
  const slate = weatherSurface(material('#3d5256'), weather);
  const floor = material('#ad7854');
  box(house, mortar, 0, .81, (front + back) / 2, 7.98, .52, 5.50);
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

  box(house, rearStucco, 0, (bottom + eave) / 2, back, wallSpan, eave - bottom, .18);
  // Rear trim lies flush with the plaster. Its painted faces are visible only from outside.
  const trimFace = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI);
  const rearBoard = (x, y, width, height, tint, angle = 0) => {
    const plank = mesh(house, trimFace, tint, x, y, back - .096, width, height, 1);
    plank.rotation.z = angle;
    plank.castShadow = false;
  };
  for (const y of [bottom + .14, eave - .13]) {
    rearBoard(0, y, wallSpan, .15, timber);
  }
  for (const x of [-3.81, -1.26, 1.26, 3.81]) {
    rearBoard(x, (bottom + eave + .01) / 2, .135, eave - bottom - .422, wood);
  }
  for (const side of [-1, 1]) {
    const rise = eave - bottom - .46;
    rearBoard(side * 3.26, (bottom + eave + .04) / 2, .092, Math.hypot(.86, rise), wood, side * Math.atan2(.86, rise));
  }
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
  const frontSidePanel = material('#dec1a1', { map: limewash });
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
  navigation.barrier(-4.13,2.50,-2.845,2.50);
  navigation.barrier(-1.035,2.50,4.165,2.50);
  for (const side of [-4.13,4.165]) navigation.barrier(side,1.30,side,2.50);
  for (const [y, z, width] of [[.92, 2.59, 1.81], [.81, 2.78, 1.94]]) box(house, porchShade, -1.94, y, z, width, .105, .26);
  for (const x of [3.82, 2.46, .98, -3.97]) {
    navigation.barrier(x,2.34,x,2.34,.085);
    box(house, timber, x, 1.40, 2.34, .113, .81, .113);
    box(house, woodLight, x, 1.822, 2.34, .16, .062, .16);
  }
  box(house, timber, 2.40, 1.61, 2.34, 3.03, .08, .087);
  navigation.barrier(.885,2.34,3.915,2.34,.055);
  navigation.block(2.345,1.55,3.515,2.00);
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
  doorHinge.position.set(DOORWAY.hingeX, bottom + .063, DOORWAY.hingeZ);
  doorHinge.scale.x = DOORWAY.leafWidth / 1.10;
  // Only the gated passage may enter the arc swept by the leaf and its handle.
  navigation.block(DOORWAY.hingeX - .31, DOORWAY.hingeZ - .06,
    DOORWAY.hingeX + DOORWAY.leafWidth + .01, DOORWAY.hingeZ + DOORWAY.leafWidth + .02);
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
  const roofColors = ['#4b676b', '#526d70', '#4b696c', '#58736f', '#506b6c', '#4c666b'];
  const patina = color('#849482');
  const rainwashed = color('#384f5b');
  const dryRoof = weatherSurface(material('#ffffff', { vertexColors: true }), weather);
  const tiles = [];
  const rowCount = 9, columnCount = 19;
  const stepZ = roofSlope / rowCount, tileWidth = 8.69 / columnCount;
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
    for (let row = 0; row < rowCount; row++) {
      const distance = (row + .49) * stepZ;
      const offset = row % 2 * .5;
      for (let column = 0; column < columnCount + offset; column++) {
        const left = Math.max(0, column - offset), right = Math.min(columnCount, column + 1 - offset);
        const x = ((right + left) / 2 - columnCount / 2) * tileWidth;
        const patch = Math.sin(x * 1.07 + row * .61 + side) * .55
          + Math.sin(x * 2.27 - row * .34 + side) * .26 + Math.cos(x * .52 - row * .83) * .19;
        const tint = color(pick(roofColors)).lerp(rainwashed, .65 * Math.max(0, -patch))
          .lerp(patina, .51 * Math.max(0, patch) ** 1.2);
        tiles.push({
          x, y: ridge - distance * Math.sin(pitch) + .093,
          z: roofMiddle + side * distance * Math.cos(pitch),
          sx: tileWidth * (right - left) - .009, sy: .046, sz: stepZ + .083,
          rx: angle, ry: side < 0 ? Math.PI : 0, tint,
        });
      }
    }
  }
  batch(house, makeRoofSlate(THREE), tiles, dryRoof);
  const caps = [];
  for (let index = 0; index < 20; index += 1) {
    caps.push({ x: (index - 9.5) * .443, y: ridge + .063, z: roofMiddle,
      sx: .437, sy: .080, sz: .286, tint: pick(['#52666b', '#627774', '#596f70']) });
  }
  batch(house, makeRidgeCap(THREE), caps, weatherSurface(material('#ffffff'), weather));

  // Other island details use the original sequence of planting and masonry variations.
  seed = 2878140261;
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
  box(house, black, chimneyX, 5.793, chimneyZ, .53, .024, .43);
  for (const side of [-1, 1]) {
    box(house, mortar, chimneyX, 5.82, chimneyZ + side * .276, .77, .14, .12);
    box(house, mortar, chimneyX + side * .302, 5.82, chimneyZ, .165, .14, .436);
  }

  const lampGlass = material('#ffda8f', { emissive: '#ffc373', emissiveIntensity: 2.1 });
  function lantern(parent, x, y, z, size) {
    box(parent, lampGlass, x, y, z, size * .69, size, size * .69).castShadow = false;
    for (const dx of [-.39, .39]) for (const dz of [-.39, .39]) box(parent, black, x + dx * size, y, z + dz * size, size * .075, size * 1.16, size * .075);
    for (const dy of [-.55, .55]) box(parent, black, x, y + dy * size, z, size * .91, size * .105, size * .91);
    mesh(parent, new THREE.ConeGeometry(.65, .34, 4), black, x, y + .73 * size, z, size, size, size).rotation.y = Math.PI / 4;
  }
  lantern(house, -2.94, 2.97, 1.46, .31);
  box(house, black, -2.94, 3.24, 1.37, .053, .067, .27);
  const porchLamp = new THREE.SpotLight('#ffac57', 13, 5.3, .79, .70, 1.8);
  porchLamp.position.set(-2.94, 2.92, 1.66);
  porchLamp.target.position.set(-2.70, .84, 3.25);
  house.add(porchLamp, porchLamp.target);
  lantern(dock, .02, .90, 7.65, .19);

  const leafColors = ['#658959', '#63865b', '#648b64', '#7e9d66', '#769862', '#739056'];
  createCoastalTrees(THREE, root, terrainHeight, weather, navigation);

  const shrubBeds = [
    [-10.7, -1.9, .55], [-9.3, 3.2, .62], [-7.25, 3.1, .46], [-6.95, 5.18, .48],
    [-5.93, 5.91, .38], [-7.7, -.7, .43], [9.75, 2.04, .54], [10.55, -2.0, .55],
    [7.2, 3.48, .50], [5.3, 4.95, .44], [3.40, 2.76, .30], [6.27, 5.12, .39],
    [-2.52, 5.75, .32], [6.90, -2.63, .39], [-4.63, 2.79, .36], [-5.74, -.08, .50],
    [2.47, 6.11, .43], [-3.62, -.5, .24], [4.90, -6.06, .48], [-6.25, -6.05, .39],
  ];
  const bushes = shrubBeds.map(([x, z, scale]) => ({
    x, y: terrainHeight(x, z) - .015, z, sx: scale * 1.13, sy: scale, sz: scale,
    ry: range(0, TAU), tint: pick(leafColors),
  }));
  navigation.blockInstances(batch(root, botanicalMesh(THREE, 'Shrub'), bushes,
    weatherSurface(material('#ffffff', { vertexColors: true, roughness: .91 }), weather, true)));

  const garden = new THREE.Group();
  root.add(garden);
  const gardenX = 5.98;
  const gardenZ = -.38;
  const gardenY = terrainHeight(gardenX, gardenZ);
  navigation.block(gardenX-1.72,gardenZ-1.405,gardenX+1.72,gardenZ+1.405);
  garden.position.set(gardenX, gardenY, gardenZ);
  const inGarden = (x, z) => Math.abs(x - gardenX) < 1.95 && Math.abs(z - gardenZ) < 1.62;
  const soil = material('#735743');
  const darkSoil = material('#5b4835');
  box(garden, darkSoil, 0, .055, 0, 3.28, .13, 2.62);
  for (const x of [-1.67, 1.67]) box(garden, woodLight, x, .096, 0, .1, .17, 2.78);
  for (const z of [-1.35, 1.35]) box(garden, woodLight, 0, .092, z, 3.42, .15, .104);
  for (const x of [-1.1, 0, 1.1]) mesh(garden, foliage, soil, x, .117, 0, .46, .16, 1.29);
  const runners = [];
  const melonBase = botanicalMesh(THREE, 'Melon');
  const melonMaterial = material('#ffffff', { vertexColors: true, roughness: .48 });
  const melons = [];
  for (const row of [-1.10, 0, 1.10]) {
    for (let column = 0; column < 3; column += 1) {
      const x = row + range(-.10, .12);
      const z = -.80 + column * .80 + range(-.10, .10);
      const size = range(.23, .33);
      const melon = mesh(garden, melonBase, melonMaterial, x, .15 + size * .88, z, size * 1.18, size * .86, size);
      melon.rotation.set(range(-.18, .18), range(0, TAU), range(-.29, .29));
      melons.push(melon);
      for (const side of [-1, 1]) {
        runners.push({ x: row + side * .255, y: .220, z: -.80 + .80 * column,
          sx: .96, sy: .96, sz: .85, ry: side < 0 ? Math.PI : 0 });
      }
    }
  }
  batch(garden, botanicalMesh(THREE, 'Runner'), runners,
    material('#ffffff', { vertexColors: true, roughness: .83 }), false);
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
  const pickets = [], picketTops = [];
  function fence(from, to) {
    const [ax, az] = from;
    const [bx, bz] = to;
    navigation.barrier(ax,az,bx,bz,.082);
    const count = Math.ceil(Math.hypot(bx - ax, bz - az) * 4.1);
    for (const y of [.31, .57]) brace(root, fenceWood, [ax, terrainHeight(ax, az) + y, az], [bx, terrainHeight(bx, bz) + y, bz], .085);
    for (let index = 0; index <= count; index += 1) {
      const x = THREE.MathUtils.lerp(ax, bx, index / count);
      const z = THREE.MathUtils.lerp(az, bz, index / count);
      const y = terrainHeight(x, z);
      const thick = index % count === 0;
      const width = thick ? .133 : .078;
      const height = thick ? .81 : .68;
      pickets.push({ x, y: y + height * .47, z, sx: width, sy: height, sz: width * .85 });
      picketTops.push({ x, y: y + height * .98, z, sx: width * .70, sy: width * .69, sz: width * .70, ry: Math.PI / 4 });
    }
  }
  fence([4.08, 4.70], [6.56, 4.70]);
  fence([6.56, 4.70], [6.56, 2.65]);
  batch(root, cube, pickets, fenceWood);
  batch(root, new THREE.ConeGeometry(1, 1, 4), picketTops, fenceWood);

  const blossoms = [];
  const petalStems = [];
  const centres = [];
  for (let cluster = 0; cluster < 62; cluster += 1) {
    const angle = range(0, TAU);
    const radius = range(.41, .88);
    const { x: sx, z: sz } = shorePoint(angle);
    const cx = sx * radius;
    const cz = sz * radius;
    if ((Math.abs(cx) < 4.35 && cz < 2.76 && cz > -4.7) || inGarden(cx, cz) || (cz > 2.48 && Math.abs(pathX(cz) - cx) < .72)) continue;
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
  // A cupped petal reads as a flower up close and only needs six faces per instance.
  const petalShape = new THREE.BufferGeometry();
  petalShape.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -.32, -1, -.76, .24, -.34, -.90, .66, .51, 0, .86, 1,
    .90, .66, .51, .76, .24, -.34, 0, -.12, .03,
  ], 3));
  petalShape.setIndex([6, 0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0]);
  petalShape.computeVertexNormals();
  batch(root, petalShape, blossoms, material('#ffffff', { side: THREE.DoubleSide }), false);
  batch(root, pebble, centres, material('#ffffff'), false);
  batch(root, new THREE.CylinderGeometry(.70, 1, 1, 4, 1, true), petalStems, material('#ffffff'), false);

  const grassPositions = [];
  const grassColors = [];
  const grassHeights = [];
  const grassPalette = ['#778f4c', '#829d58', '#678853', '#52764a', '#8b9e5f', '#78995a', '#b5b174', '#6a8f54'].map(color);
  for (let index = 0; index < 14500; index += 1) {
    const x = range(-coastX * 1.12, coastX * 1.12);
    const z = range(-coastZ * 1.12, coastZ * 1.12);
    const r = islandRadius(x, z);
    if (r > .94 || (Math.abs(x) < 4.26 && z > -4.33 && z < 2.51)
      || inGarden(x, z)
      || (z > 2.56 && Math.abs(pathX(z) - x) < .55)
      || (z > 3.03 && z < 4.38 && x > 4.21 && x < 6.44)) continue;
    const meadowPatch = Math.sin(x * 1.48 + Math.cos(z * .89)) * Math.cos(z * 1.14 - x * .34);
    if (meadowPatch < -.48) continue;
    const height = range(.105, .31) * (.87 + meadowPatch * .28) * (r > .87 ? .72 : 1);
    const y = terrainHeight(x, z) - .047;
    const tint = pick(grassPalette);
    const base = tint.clone().multiplyScalar(.81);
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
  navigation.barrier(3.86,1.17,5.31,.60,.13);
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
    navigation.barrier(x,z,x,z,size*1.19);
    mesh(house, new THREE.CylinderGeometry(1, .70, 1.30, 9), coral, x, 1.09 + size * .65, z, size, size, size);
    mesh(house, cylinder, soil, x, 1.09 + size * 1.31, z, size * .90, .018, size * .90);
    for (let leaf = 0; leaf < 8; leaf += 1) {
      const angle = leaf * 2.4;
      const sprig = mesh(house, foliage, pottedLeaves, x + Math.cos(angle) * size * .72, 1.12 + size * range(1.61, 2.71), z + Math.sin(angle) * size * .73, size * .42, size * .85, size * .28);
      sprig.rotation.set(Math.sin(angle) * .62, angle, Math.cos(angle) * .61);
    }
  }

  const shellPaint = new Set([wood, timber, woodLight, black, teal, mortar, coral, soil, pottedLeaves,
    porchShade, floor, stucco, rearStucco, frontSidePanel, doorPaint]);
  for (const group of [house, door, doorHinge]) batchCottageParts(THREE, group, shellPaint);

  const smoke = Array.from({ length: 12 }, (_, index) => {
    const puff = new THREE.Mesh(foliage, new THREE.MeshBasicMaterial({ color: '#f7e1ce', transparent: true, depthWrite: false }));
    puff.renderOrder = 3;
    root.add(puff);
    return { puff, delay: index / 12 };
  });

  function update(time, daylight = 1) {
    wind.value = time;
    tideTime.value = time;
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
    porchLamp.intensity = (13 + Math.sin(time * 5.1) * .45) * (2.45 - daylight * 1.30);
    windowGlass.emissiveIntensity = .35 + (1 - daylight) * .71;
    doorGlass.emissiveIntensity = .64 + (1 - daylight) * .62;
    windowGlass.opacity = .21 - daylight * .09;
  }

  return {
    door,
    doorHinge,
    roomMount,
    garden,
    doorAnchor: new THREE.Vector3(-1.94, 2.58, 1.48),
    gardenAnchor: new THREE.Vector3(gardenX, gardenY + .77, gardenZ),
    harvestSpot: new THREE.Vector3(gardenX, navigation.heightAt(gardenX,gardenZ+2.06), gardenZ + 2.06),
    melons,
    outdoorRoute: navigation.route,
    outdoorCanWalk: navigation.canWalk,
    outdoorCanStand: navigation.canStand,
    outdoorHeight: navigation.heightAt,
    terrainHeight,
    update,
  };
}
