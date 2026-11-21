import { COTTAGE } from './cottage-plan.js';
import { batchCottageParts, drawCoastPrint, drawQuilt, makeQuilt } from './cottage-craft.js';

export function createRoom(THREE, scene) {
  const { halfWidth, back, front, ceiling } = COTTAGE;
  const width = 2 * halfWidth;
  const depth = front - back;
  const centerZ = (front + back) / 2;
  const contents = new THREE.Group();
  contents.name = 'Cottage furnishings';
  scene.add(contents);

  const furniture = [];
  let seed = 53;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const standard = (color, options = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.84, ...options
  });
  const texture = (width, height, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };
  const woodGrain = texture(384, 80, (ctx, width, height) => {
    ctx.fillStyle = '#f5e6ce';
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 120; i += 1) {
      const y = random() * height;
      const variance = 0.8 + 2.2 * random();
      const phase = random() * 8;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(80,42,24,${0.018 + random() * 0.085})`;
      ctx.lineWidth = 0.4 + Math.floor(random() * 1.9);
      for (let x = 0; x <= width; x += 8) {
        const vy = y + Math.sin(x * 0.014 + phase) * variance + Math.sin(x * 0.042 + phase) * 0.35;
        if (x === 0) ctx.moveTo(x, vy);
        else ctx.lineTo(x, vy);
      }
      ctx.stroke();
    }
  });
  woodGrain.anisotropy = 4;

  const panel = standard('#d2b791');
  const trim = standard('#784e39', { map: woodGrain });
  const cedar = standard('#a57149', { map: woodGrain });
  const warmOak = standard('#c28d5f', { map: woodGrain });
  const paleOak = standard('#d7a977', { map: woodGrain });
  const darkWood = standard('#54352a', { map: woodGrain });
  const brass = standard('#bb8845', { metalness: 0.46, roughness: 0.46 });
  const beige = standard('#f4e5c8');
  const cream = standard('#f7edda');
  const denim = standard('#537b88');
  const salmon = standard('#ca7761');
  const fabric = standard('#b9b47b');
  const iron = standard('#353e39');
  const foliage = ['#54724e', '#709761', '#8bac74', '#385943'].map((color) => standard(color));
  const clay = standard('#b96d50');
  const soil = standard('#4d3727');
  const bulbMaterial = standard('#fff2c5', { emissive: '#ffe0a1', emissiveIntensity: 1.15 });

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(1, 16, 10);
  const mesh = (parent, geometry, material, x, y, z, shadows = true) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = shadows;
    object.receiveShadow = shadows;
    parent.add(object);
    return object;
  };
  const box = (parent, w, h, d, x, y, z, material, shadows = true) => {
    const object = mesh(parent, boxGeometry, material, x, y, z, shadows);
    object.scale.set(w, h, d);
    return object;
  };
  const sphere = (parent, w, h, d, x, y, z, material, shadows = true) => {
    const object = mesh(parent, sphereGeometry, material, x, y, z, shadows);
    object.scale.set(w, h, d);
    return object;
  };
  const roundProfiles = new Map();
  const cylinder = (parent, top, bottom, height, x, y, z, material, shadows = true) => {
    const taper = top / bottom;
    if (!roundProfiles.has(taper)) roundProfiles.set(taper, new THREE.CylinderGeometry(taper, 1, 1, 16));
    const object = mesh(parent, roundProfiles.get(taper), material, x, y, z, shadows);
    object.scale.set(bottom, height, bottom);
    return object;
  };

  const movable = (label, x, z, scale) => {
    const group = new THREE.Group();
    group.name = label;
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    group.userData = { label };
    contents.add(group);
    furniture.push(group);
    return group;
  };

  box(contents, width, 0.067, depth, 0, -0.054, centerZ, darkWood);
  const floorColors = ['#bf8a61', '#c39870', '#cda37a', '#be936b', '#cc986a', '#b58b64', '#cda779']
    .map((color) => new THREE.Color(color));
  const rowCount = Math.ceil(depth / 0.38);
  const rowDepth = depth / rowCount;
  const plankLength = 1.49;
  const planks = new THREE.InstancedMesh(boxGeometry, standard('#ffffff', { map: woodGrain }),
    rowCount * (Math.ceil(width / plankLength) + 2));
  const transform = new THREE.Object3D();
  let plankIndex = 0;
  for (let row = 0; row < rowCount; row += 1) {
    const offset = row % 3 * 0.49;
    for (let x = -halfWidth; x < halfWidth - 0.001;) {
      const nominalLength = x === -halfWidth && offset > 0 ? offset : plankLength;
      const length = Math.min(nominalLength, halfWidth - x);
      transform.position.set(x + length / 2, -0.011, back + (row + 0.5) * rowDepth);
      transform.scale.set(length - 0.010, 0.032, rowDepth - 0.009);
      transform.updateMatrix();
      planks.setMatrixAt(plankIndex, transform.matrix);
      planks.setColorAt(plankIndex, floorColors[Math.floor(random() * floorColors.length)]);
      plankIndex += 1;
      x += length;
    }
  }
  planks.count = plankIndex;
  planks.receiveShadow = true;
  contents.add(planks);
  box(contents, width, 0.040, 0.060, 0, -0.014, front - 0.030, trim);
  box(contents, 0.060, 0.040, depth, halfWidth - 0.030, -0.014, centerZ, trim);

  const sideX = -halfWidth - 0.10;
  const windowZ = 0.16;
  const windowY = 1.515;
  box(contents, width, 0.56, 0.055, 0, 0.28, back + 0.041, panel, false);
  box(contents, 0.060, 0.56, depth, -halfWidth - 0.003, 0.28, centerZ, panel, false);
  for (const height of [0.064, 0.585, ceiling - 0.085]) {
    box(contents, width, 0.071, 0.085, 0, height, back + 0.062, trim);
    box(contents, 0.085, 0.071, depth, -halfWidth + 0.021, height, centerZ, trim);
  }
  for (let x = -halfWidth + 0.2; x < halfWidth - 0.1; x += 0.285) {
    box(contents, 0.014, 0.47, 0.02, x, 0.32, back + 0.079, cedar, false);
  }
  for (let z = back + 0.16; z < front - 0.12; z += 0.285) {
    box(contents, 0.020, 0.47, 0.014, -halfWidth + 0.033, 0.32, z, cedar, false);
  }
  box(contents, 0.13, ceiling, 0.13, -halfWidth + 0.064, ceiling / 2, back + 0.075, trim);
  box(contents, 0.13, ceiling, 0.13, halfWidth - 0.064, ceiling / 2, back + 0.075, trim);
  box(contents, 0.13, ceiling, 0.13, -halfWidth + 0.064, ceiling / 2, front - 0.075, trim);

  box(contents, width, 0.10, depth, 0, ceiling + 0.05, centerZ, standard('#e2c59f'), false);
  for (let x = -3.16; x <= 3.18; x += 1.05) {
    box(contents, 0.105, 0.127, depth, x, ceiling - 0.047, centerZ, darkWood);
  }
  for (const z of [back + 0.18, -0.21, front - 0.19]) {
    box(contents, width, 0.14, 0.157, 0, ceiling - 0.103, z, trim);
    box(contents, width, 0.043, 0.175, 0, ceiling - 0.075, z, cedar);
  }

  const windowGroup = new THREE.Group();
  windowGroup.position.set(sideX, windowY, windowZ);
  windowGroup.rotation.y = Math.PI / 2;
  contents.add(windowGroup);
  for (const x of [-1.11, -0.37, 0.37, 1.11]) {
    const outer = Math.abs(x) > 1;
    box(windowGroup, outer ? 0.102 : 0.061, 1.60, 0.125, x, 0, 0.108, paleOak);
  }
  for (const y of [-0.746, 0.15, 0.751]) {
    const outer = Math.abs(y) > 0.7;
    box(windowGroup, outer ? 2.31 : 2.18, outer ? 0.09 : 0.054, 0.125, 0, y, 0.108, paleOak);
  }
  box(windowGroup, 2.37, 0.065, 0.267, 0, -0.81, 0.16, warmOak);
  box(windowGroup, 2.65, 0.032, 0.032, 0, 0.876, 0.187, iron);
  for (const side of [-1, 1]) {
    sphere(windowGroup, 0.038, 0.038, 0.038, side * 1.35, 0.876, 0.187, brass);
    for (let i = 0; i < 7; i += 1) {
      const x = side * (1.048 + 0.035 * i);
      const curtain = sphere(windowGroup, 0.032, 0.81, 0.039, x, 0.018, 0.204 + 0.015 * Math.sin(i), i % 2 ? cream : beige);
      curtain.rotation.z = side * (i - 3) * 0.008;
    }
    box(windowGroup, 0.274, 0.047, 0.047, side * 1.153, -0.24, 0.244, salmon);
  }

  const rugMap = texture(792, 578, (ctx, width, height) => {
    ctx.fillStyle = '#c47c61';
    ctx.fillRect(0, 0, width, height);
    for (const [edge, size, color] of [[15, 4, '#f4dcc0'], [29, 11, '#f4dcc0'], [49, 3, '#f4dcc0'], [63, 6, '#a85e49']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.strokeRect(edge, edge, width - 2 * edge, height - 2 * edge);
    }
    const diamond = (x, y, w, h, thickness) => {
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x - w, y);
      ctx.closePath();
      ctx.strokeStyle = '#ecd0aa';
      ctx.lineWidth = thickness;
      ctx.stroke();
    };
    for (const x of [118, width - 118]) {
      for (const y of [116, height - 116]) diamond(x, y, 28, 28, 4);
    }
    for (let y = 145; y < 450; y += 74) {
      for (let x = 168; x <= 624; x += 76) diamond(x, y, 15, 12, 3);
    }
    for (let i = 0; i < 15000; i += 1) {
      ctx.fillStyle = i % 2 ? 'rgba(75,40,30,0.09)' : 'rgba(253,229,186,0.08)';
      ctx.fillRect(random() * width, random() * height, 1 + random() * 7, 1);
    }
  });
  const rugX = -0.31;
  const rugZ = 1.02;
  const rugWidth = 3.53;
  const rugDepth = 2.29;
  box(contents, rugWidth, 0.028, rugDepth, rugX, 0.015, rugZ, standard('#ffffff', { map: rugMap }));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 24; i += 1) {
      const x = rugX - rugWidth / 2 + (i + 0.5) * rugWidth / 24;
      const z = rugZ + (rugDepth / 2 + 0.024) * side;
      const thread = box(contents, 0.012, 0.014, 0.084 + random() * 0.03, x, 0.010, z, beige, false);
      thread.rotation.y = (random() - 0.5) * 0.43;
    }
  }

  const table = movable('茶几', -0.35, 0.72, 0.86);
  table.rotation.y = -0.09;
  box(table, 1.91, 0.106, 1.07, 0, 0.45, 0, paleOak);
  box(table, 1.75, 0.093, 0.91, 0, 0.38, 0, cedar);
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.4, 0.4]) box(table, 0.091, 0.37, 0.09, x, 0.22, z, trim);
  }
  box(table, 1.52, 0.047, 0.72, 0, 0.17, 0, warmOak);
  box(table, 0.38, 0.022, 0.29, 0.57, 0.513, -0.245, denim);
  cylinder(table, 0.13, 0.13, 0.023, 0.55, 0.535, -0.20, cream);
  cylinder(table, 0.082, 0.059, 0.098, 0.55, 0.589, -0.20, cream);
  cylinder(table, 0.065, 0.065, 0.007, 0.55, 0.641, -0.20, standard('#8e552e'));
  mesh(table, new THREE.TorusGeometry(0.032, 0.011, 8, 14), cream, 0.629, 0.596, -0.20);

  const melonGreen = standard('#5c8b54');
  const melonPink = standard('#e87d72');
  const melonSeed = standard('#673c33');
  cylinder(table, 0.31, 0.28, 0.027, -0.36, 0.516, 0.023, cream);
  const halfMelon = mesh(table, new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), melonGreen, -0.36, 0.657, 0.023);
  halfMelon.scale.set(0.224, 0.127, 0.224);
  cylinder(table, 0.222, 0.222, 0.012, -0.36, 0.659, 0.023, cream);
  cylinder(table, 0.199, 0.199, 0.009, -0.36, 0.665, 0.023, melonPink);
  for (let i = 0; i < 13; i += 1) {
    const angle = i * 2.4;
    const radius = 0.044 + (i % 4) * 0.036;
    sphere(table, 0.014, 0.004, 0.008, -0.36 + Math.cos(angle) * radius, 0.67, 0.023 + Math.sin(angle) * radius, melonSeed, false);
  }

  const bed = movable('海蓝小床', 0, -1.22, 0.86);
  box(bed, 2.07, 0.264, 2.59, 0, 0.258, 0, warmOak);
  box(bed, 2.12, 0.155, 2.63, 0, 0.37, 0, paleOak);
  box(bed, 2.14, 1.01, 0.157, 0, 0.66, -1.25, cedar);
  box(bed, 2.23, 0.09, 0.2, 0, 1.17, -1.25, trim);
  for (const x of [-0.88, 0.88]) {
    for (const z of [-1.08, 1.07]) box(bed, 0.14, 0.23, 0.14, x, 0.115, z, trim);
  }
  for (let x = -0.86; x < 0.90; x += 0.19) box(bed, 0.014, 0.38, 0.022, x, 0.916, -1.16, trim, false);
  box(bed, 1.99, 0.192, 2.43, 0, 0.52, 0.025, cream);
  const quiltMap = texture(256, 256, drawQuilt);
  quiltMap.anisotropy = 2;
  const quiltMaterial = standard('#ffffff', { map: quiltMap, roughness: .97 });
  const quilt = mesh(bed, makeQuilt(THREE), quiltMaterial, 0, 0, 0);
  const sleepingQuilt = mesh(bed, makeQuilt(THREE, true), quiltMaterial, 0, 0, 0);
  sleepingQuilt.visible = false;
  for (const x of [-0.496, 0.485]) {
    const pillow = sphere(bed, 0.43, 0.116, 0.272, x, 0.689, -0.86, beige);
    pillow.rotation.y = x * 0.20;
  }
  box(bed, 1.98, 0.026, 0.192, 0, 0.727, -0.455, cream);

  const shelf = movable('书架', -2.55, -2.18, 0.86);
  box(shelf, 1.78, 2.32, 0.15, 0, 1.24, -0.214, trim);
  for (const x of [-0.901, 0.901]) {
    box(shelf, 0.104, 2.43, 0.50, x, 1.24, 0.014, cedar);
  }
  box(shelf, 1.96, 0.129, 0.564, 0, 2.449, 0.01, trim);
  box(shelf, 1.98, 0.215, 0.555, 0, 0.129, 0.013, trim);
  const bookColors = ['#a25d4b', '#c19461', '#698a79', '#b8794d', '#677990', '#bfbb8a', '#d8ccb2', '#86657c']
    .map((color) => standard(color));
  for (let row = 0; row < 4; row += 1) {
    const height = 0.259 + row * 0.541;
    box(shelf, 1.75, 0.067, 0.421, 0, height, 0.026, warmOak);
    for (let x = -0.795; x < 0.72;) {
      const width = 0.065 + random() * 0.105;
      const bookHeight = 0.24 + random() * 0.19;
      const depth = 0.23 + random() * 0.09;
      const y = height + 0.034 + bookHeight / 2;
      const z = 0.076 + random() * 0.018;
      const cover = bookColors[Math.floor(random() * bookColors.length)];
      box(shelf, width, bookHeight, depth, x + width / 2, y, z, cover);
      box(shelf, width * 0.71, 0.017, 0.013, x + width / 2, y - bookHeight * 0.30, z + depth * 0.5, beige, false);
      x += width + 0.021 + (random() < 0.13 ? 0.071 : 0);
    }
  }

  const chair = movable('藤边扶手椅', 2.98, 1.55, 0.82);
  chair.rotation.y = -1.06;
  for (const x of [-0.471, 0.471]) {
    for (const z of [-0.432, 0.432]) box(chair, 0.083, 0.49, 0.083, x, 0.246, z, warmOak);
  }
  box(chair, 1.08, 0.111, 1.03, 0, 0.438, 0, cedar);
  box(chair, 0.91, 0.165, 0.92, 0, 0.565, 0.031, beige);
  const chairBack = box(chair, 0.94, 0.63, 0.115, 0, 0.859, -0.457, cedar);
  chairBack.rotation.x = -0.105;
  const cushion = sphere(chair, 0.452, 0.347, 0.114, 0, 0.829, -0.383, fabric);
  cushion.rotation.x = -0.07;
  for (const x of [-0.513, 0.513]) {
    box(chair, 0.091, 0.067, 0.935, x, 0.793, -0.018, paleOak);
    box(chair, 0.071, 0.391, 0.071, x, 0.611, 0.35, warmOak);
    box(chair, 0.072, 0.404, 0.078, x, 0.641, -0.32, warmOak);
  }

  const fern = movable('陶盆绿植', -3.14, -0.78, 0.88);
  cylinder(fern, 0.255, 0.177, 0.33, 0, 0.168, 0, clay);
  cylinder(fern, 0.267, 0.267, 0.057, 0, 0.328, 0, clay);
  cylinder(fern, 0.23, 0.23, 0.014, 0, 0.359, 0, soil);
  const fernLeaves = [];
  for (let i = 0; i < 12; i += 1) {
    const angle = i * 2.399;
    const axis = new THREE.Vector3(Math.cos(angle) * (0.34 + random() * 0.16), 0.55 + random() * 0.37, Math.sin(angle) * (0.35 + random() * 0.13));
    const stem = cylinder(fern, 0.008, 0.014, axis.length(), axis.x * 0.5, 0.35 + axis.y * 0.5, axis.z * 0.5, foliage[0]);
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
    const leaf = sphere(fern, 0.101, 0.025, 0.225, axis.x, 0.37 + axis.y, axis.z, foliage[i % foliage.length]);
    leaf.rotation.set(0.35 + random() * 0.24, Math.PI / 2 - angle, 0);
    fernLeaves.push(leaf);
  }

  const pendant = new THREE.Group();
  pendant.position.set(-0.27, ceiling - 0.127, -0.21);
  contents.add(pendant);
  cylinder(pendant, 0.116, 0.116, 0.081, 0, 0.10, 0, iron);
  cylinder(pendant, 0.022, 0.022, 0.289, 0, -0.068, 0, iron);
  cylinder(pendant, 0.137, 0.382, 0.232, 0, -0.26, 0, standard('#dfaa6d', {
    emissive: '#bd703b', emissiveIntensity: 0.25
  }));
  cylinder(pendant, 0.383, 0.383, 0.026, 0, -0.385, 0, bulbMaterial);
  sphere(pendant, 0.085, 0.05, 0.085, 0, -0.401, 0, bulbMaterial);
  const lamp = new THREE.SpotLight('#ffc47c', 22, 5.8, 1.16, .61, 2);
  lamp.position.set(0, -0.47, 0);
  lamp.target.position.set(.05, -2.2, -.1);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(512, 512);
  lamp.shadow.normalBias = .018;
  pendant.add(lamp, lamp.target);
  const windowFill = new THREE.SpotLight('#accbd6', 6.8, 3.8, .78, .70, 1.65);
  windowFill.position.set(sideX + 0.26, windowY + 0.19, windowZ);
  windowFill.target.position.set(-1.2, .6, -.28);
  contents.add(windowFill, windowFill.target);

  const picture = (x, y, width, height, twilight) => {
    box(contents, width, height, 0.075, x, y, back + 0.068, trim);
    box(contents, width - 0.08, height - 0.08, 0.051, x, y, back + 0.122, cream);
    const art = texture(128, 96, (ctx, w, h) => drawCoastPrint(ctx, w, h, twilight));
    mesh(contents, new THREE.PlaneGeometry(width - .15, height - .15),
      standard('#ffffff', { map: art }), x, y, back + .15, false);
  };
  picture(-0.54, 1.78, 0.63, 0.54, false);
  picture(0.14, 1.51, 0.43, 0.41, true);

  const finishes = new Set([panel, trim, cedar, warmOak, paleOak, darkWood, beige, cream, denim,
    salmon, fabric, iron, clay, soil, melonGreen, melonPink, melonSeed, ...bookColors, ...foliage]);
  const animated = new Set(fernLeaves);
  for (const parent of [contents, windowGroup, pendant, table, bed, shelf, chair, fern]) {
    batchCottageParts(THREE, parent, finishes, animated);
  }

  return {
    contents,
    furniture,
    table,
    bed,
    update(time, daylight = true, sleeping = false) {
      quilt.visible = !sleeping;
      sleepingQuilt.visible = sleeping;
      windowFill.intensity = daylight ? 6.8 : 2.5;
      lamp.intensity = (daylight ? 22 : 28) + Math.sin(time * 1.39) * 0.28;
      for (let i = 0; i < fernLeaves.length; i += 1) {
        fernLeaves[i].rotation.z = Math.sin(time * 0.91 + i * 1.6) * 0.052;
      }
    }
  };
}
