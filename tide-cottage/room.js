export function createRoom(THREE, scene) {
  const cabin = new THREE.Group();
  cabin.name = 'Cottage interior';
  scene.add(cabin);

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

  const wall = standard('#eadabc');
  const panel = standard('#d2b791');
  const teal = standard('#3c7770');
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
  const moss = standard('#78865d');
  const fabric = standard('#b9b47b');
  const iron = standard('#353e39');
  const foliage = ['#54724e', '#709761', '#8bac74', '#385943'].map((color) => standard(color));
  const clay = standard('#b96d50');
  const soil = standard('#4d3727');
  const ink = standard('#35515a');
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
  const cylinder = (parent, top, bottom, height, x, y, z, material, shadows = true) =>
    mesh(parent, new THREE.CylinderGeometry(top, bottom, height, 16), material, x, y, z, shadows);

  const movable = (label, x, z, radius) => {
    const group = new THREE.Group();
    group.name = label;
    group.position.set(x, 0, z);
    group.userData = { label, radius };
    cabin.add(group);
    furniture.push(group);
    return group;
  };

  // The south and east sides are open so the furniture stays visible from outside.
  box(cabin, 10.6, 0.25, 8.65, 0, -0.15, 0.08, darkWood);
  const floorColors = ['#bf8a61', '#c39870', '#cda37a', '#be936b', '#cc986a', '#b58b64', '#cda779']
    .map((color) => new THREE.Color(color));
  const planks = new THREE.InstancedMesh(boxGeometry, standard('#ffffff', { map: woodGrain }), 96);
  const transform = new THREE.Object3D();
  let plankIndex = 0;
  for (let row = 0; row < 16; row += 1) {
    const offset = row % 3 * 0.68;
    for (let x = -5.24; x < 5.23;) {
      const nominalWidth = x === -5.24 && offset > 0 ? offset : 2.04;
      const width = Math.min(nominalWidth, 5.24 - x);
      transform.position.set(x + width / 2, -0.034, -3.973 + row * 0.535);
      transform.scale.set(width - 0.013, 0.046, 0.523);
      transform.updateMatrix();
      planks.setMatrixAt(plankIndex, transform.matrix);
      planks.setColorAt(plankIndex, floorColors[Math.floor(random() * floorColors.length)]);
      plankIndex += 1;
      x += width;
    }
  }
  planks.count = plankIndex;
  planks.receiveShadow = true;
  cabin.add(planks);
  box(cabin, 10.58, 0.11, 0.11, 0, -0.055, 4.34, trim);
  box(cabin, 0.12, 0.105, 8.55, 5.22, -0.055, 0.03, trim);

  box(cabin, 10.6, 3.35, 0.17, 0, 1.66, -4.25, wall, false);
  box(cabin, 0.17, 3.35, 8.65, -5.23, 1.66, 0.08, wall, false);
  box(cabin, 10.55, 0.73, 0.06, 0, 0.375, -4.14, panel, false);
  box(cabin, 0.062, 0.73, 8.55, -5.12, 0.375, 0.08, panel, false);
  for (const height of [0.095, 0.755, 3.19]) {
    box(cabin, 10.56, 0.095, 0.105, 0, height, -4.09, trim);
    box(cabin, 0.105, 0.095, 8.57, -5.075, height, 0.06, trim);
  }
  for (let x = -5.05; x < 5.13; x += 0.31) {
    box(cabin, 0.016, 0.64, 0.025, x, 0.42, -4.102, cedar, false);
  }
  for (let z = -4.03; z < 4.13; z += 0.31) {
    box(cabin, 0.025, 0.64, 0.016, -5.08, 0.42, z, cedar, false);
  }
  box(cabin, 0.16, 3.34, 0.15, -5.05, 1.67, -4.06, trim);
  box(cabin, 0.15, 3.34, 0.15, 5.13, 1.67, -4.06, trim);
  box(cabin, 0.15, 3.34, 0.15, -5.05, 1.67, 4.24, trim);

  box(cabin, 11.40, 0.12, 11.28, 0.34, 3.38, 1.30, standard('#e2c59f'), false);
  for (let x = -4.74; x <= 4.8; x += 1.58) {
    box(cabin, 0.146, 0.235, 11.26, x, 3.24, 1.30, darkWood);
  }
  for (const z of [-3.94, -1.01, 1.87, 4.10]) {
    box(cabin, 10.64, 0.19, 0.18, 0, 3.11, z, trim);
    box(cabin, 10.64, 0.055, 0.195, 0, 3.17, z, cedar);
  }

  const windowView = texture(864, 460, (ctx, width, height) => {
    const horizon = height * 0.57;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#507f99');
    sky.addColorStop(0.56, '#aec9bb');
    sky.addColorStop(1, '#fce2af');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);
    const halo = ctx.createRadialGradient(643, 182, 13, 643, 182, 103);
    halo.addColorStop(0, '#fff8db');
    halo.addColorStop(0.36, 'rgba(255,238,187,0.38)');
    halo.addColorStop(1, 'rgba(255,238,187,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(522, 60, 246, 245);
    ctx.beginPath();
    ctx.arc(643, 182, 19, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8da';
    ctx.fill();
    const sea = ctx.createLinearGradient(0, horizon, 0, height);
    sea.addColorStop(0, '#6b9693');
    sea.addColorStop(1, '#275a68');
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, width, height - horizon);
    for (let i = 0; i < 640; i += 1) {
      const depth = random();
      const y = horizon + depth * (height - horizon);
      const x = random() * width;
      const sunny = Math.abs(x - 643) < 20 + depth * 106;
      ctx.fillStyle = sunny ? 'rgba(255,228,173,0.25)' : 'rgba(219,246,216,0.12)';
      ctx.fillRect(x, y, (8 + depth * 72) * random(), 0.7 + depth * 2);
    }
    for (const [x, y, scale] of [[176, 119, 1], [277, 143, 0.74], [204, 150, 0.68]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(-10, 1);
      ctx.quadraticCurveTo(-4, -4, 0, 1);
      ctx.quadraticCurveTo(5, -4, 10, 1);
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = '#4f6870';
      ctx.stroke();
      ctx.restore();
    }
  });
  const nightView = texture(864, 460, (ctx, width, height) => {
    const horizon = height * 0.57;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#101a37');
    sky.addColorStop(0.55, '#446477');
    sky.addColorStop(0.57, '#2b5066');
    sky.addColorStop(1, '#122d43');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 75; i += 1) {
      const x = random() * width;
      const y = random() * horizon * 0.78;
      ctx.fillStyle = i % 3 ? '#98b4ce' : '#d6eaf1';
      ctx.fillRect(x, y, i % 8 ? 1.4 : 2.4, i % 8 ? 1.4 : 2.4);
    }
    const halo = ctx.createRadialGradient(643, 132, 11, 643, 132, 75);
    halo.addColorStop(0, '#d9ede6');
    halo.addColorStop(0.35, 'rgba(162,208,223,0.28)');
    halo.addColorStop(1, 'rgba(162,208,223,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(550, 40, 185, 185);
    ctx.beginPath();
    ctx.arc(643, 132, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#d9ede6';
    ctx.fill();
    for (let i = 0; i < 490; i += 1) {
      const depth = random();
      const x = random() * width;
      const y = horizon + depth * (height - horizon);
      const moonlit = Math.abs(x - 643) < 15 + depth * 102;
      ctx.fillStyle = moonlit ? 'rgba(186,225,235,0.3)' : 'rgba(132,183,209,0.11)';
      ctx.fillRect(x, y, (8 + depth * 64) * random(), 0.58 + depth * 1.7);
    }
  });
  const windowGroup = new THREE.Group();
  windowGroup.position.set(2.22, 2.12, -4.12);
  cabin.add(windowGroup);
  const windowMaterial = new THREE.MeshBasicMaterial({ map: windowView, color: '#ffffff', toneMapped: false });
  mesh(windowGroup, new THREE.PlaneGeometry(3.04, 1.61), windowMaterial, 0, 0, 0.057, false);
  for (const x of [-1.56, 0, 1.56]) {
    box(windowGroup, x === 0 ? 0.067 : 0.131, 1.77, 0.13, x, 0, 0.108, paleOak);
  }
  for (const y of [-0.852, 0.184, 0.852]) {
    const outer = Math.abs(y) > 0.8;
    box(windowGroup, outer ? 3.26 : 3.05, outer ? 0.11 : 0.055, 0.16, 0, y, 0.12, paleOak);
  }
  box(windowGroup, 3.35, 0.085, 0.35, 0, -0.909, 0.16, warmOak);
  box(windowGroup, 3.77, 0.041, 0.041, 0, 0.983, 0.22, iron);
  for (const side of [-1, 1]) {
    sphere(windowGroup, 0.049, 0.049, 0.049, side * 1.92, 0.983, 0.22, brass);
    for (let i = 0; i < 7; i += 1) {
      const x = side * (1.50 + 0.046 * i);
      const curtain = sphere(windowGroup, 0.041, 0.945, 0.045, x, 0.012, 0.23 + 0.018 * Math.sin(i), i % 2 ? cream : beige);
      curtain.rotation.z = side * (i - 3) * 0.008;
    }
    box(windowGroup, 0.36, 0.055, 0.053, side * 1.63, -0.24, 0.278, salmon);
  }

  const exit = new THREE.Group();
  exit.name = '木门';
  exit.position.set(-5.02, 0, 1.59);
  exit.rotation.y = Math.PI / 2;
  cabin.add(exit);
  box(exit, 1.42, 2.54, 0.16, 0, 1.27, 0, trim);
  box(exit, 1.19, 2.39, 0.09, 0, 1.21, 0.096, teal);
  for (const x of [-0.636, 0.636]) box(exit, 0.12, 2.54, 0.17, x, 1.27, 0.118, warmOak);
  box(exit, 1.4, 0.127, 0.18, 0, 2.49, 0.12, warmOak);
  box(exit, 1.39, 0.065, 0.31, 0, 0.035, 0.11, warmOak);
  const doorGroove = standard('#2f6159');
  for (let x = -0.37; x <= 0.38; x += 0.185) {
    box(exit, 0.013, 1.10, 0.019, x, 0.685, 0.148, doorGroove, false);
  }
  box(exit, 0.86, 0.429, 0.028, 0, 1.91, 0.159, darkWood);
  box(exit, 0.75, 0.33, 0.031, 0, 1.91, 0.174, standard('#8ca9a1', { emissive: '#8bb8b5', emissiveIntensity: 0.19 }));
  for (const x of [-0.132, 0.132]) box(exit, 0.025, 0.33, 0.038, x, 1.91, 0.187, trim);
  sphere(exit, 0.056, 0.056, 0.055, 0.43, 1.12, 0.207, brass);
  box(exit, 0.085, 0.18, 0.025, 0.43, 1.10, 0.158, brass);

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
  box(cabin, 4.80, 0.032, 3.51, -0.13, 0.018, 0.69, standard('#ffffff', { map: rugMap }));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 30; i += 1) {
      const thread = box(cabin, 0.013, 0.016, 0.12 + random() * 0.04, -2.42 + i * 0.156, 0.011, 0.69 + 1.78 * side, beige, false);
      thread.rotation.y = (random() - 0.5) * 0.43;
    }
  }

  const table = movable('茶几', -0.30, 0.55, 1.12);
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

  const bed = movable('海蓝小床', 2.56, -2.47, 1.61);
  box(bed, 2.07, 0.264, 2.59, 0, 0.258, 0, warmOak);
  box(bed, 2.12, 0.155, 2.63, 0, 0.37, 0, paleOak);
  box(bed, 2.14, 1.01, 0.157, 0, 0.66, -1.25, cedar);
  box(bed, 2.23, 0.09, 0.2, 0, 1.17, -1.25, trim);
  for (const x of [-0.88, 0.88]) {
    for (const z of [-1.08, 1.07]) box(bed, 0.14, 0.23, 0.14, x, 0.115, z, trim);
  }
  for (let x = -0.86; x < 0.90; x += 0.19) box(bed, 0.014, 0.38, 0.022, x, 0.916, -1.16, trim, false);
  box(bed, 1.99, 0.192, 2.43, 0, 0.52, 0.025, cream);
  box(bed, 2.02, 0.101, 1.74, 0, 0.668, 0.354, denim);
  box(bed, 2.035, 0.17, 0.04, 0, 0.60, 1.236, denim);
  for (const x of [-1.016, 1.016]) box(bed, 0.043, 0.17, 1.68, x, 0.60, 0.37, denim);
  const seams = standard('#668b94');
  for (let z = -0.31; z < 1.21; z += 0.124) box(bed, 2.019, 0.007, 0.012, 0, 0.722, z, seams, false);
  for (const x of [-0.496, 0.485]) {
    const pillow = sphere(bed, 0.43, 0.116, 0.272, x, 0.689, -0.86, beige);
    pillow.rotation.y = x * 0.20;
  }
  box(bed, 1.98, 0.026, 0.192, 0, 0.727, -0.455, cream);
  box(bed, 1.46, 0.027, 0.46, 0.18, 0.742, 0.852, fabric);
  box(bed, 1.46, 0.031, 0.032, 0.18, 0.749, 0.685, cream);
  box(bed, 1.46, 0.031, 0.032, 0.18, 0.749, 1.022, cream);

  const shelf = movable('书架', -2.76, -3.60, 0.99);
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

  const chair = movable('藤边扶手椅', 3.84, 1.19, 0.94);
  chair.rotation.y = -1.06;
  for (const x of [-0.471, 0.471]) {
    for (const z of [-0.432, 0.432]) box(chair, 0.083, 0.49, 0.083, x, 0.246, z, warmOak);
  }
  box(chair, 1.08, 0.111, 1.03, 0, 0.438, 0, cedar);
  box(chair, 0.91, 0.165, 0.92, 0, 0.565, 0.031, beige);
  const back = box(chair, 0.94, 0.63, 0.115, 0, 0.859, -0.457, cedar);
  back.rotation.x = -0.105;
  const cushion = sphere(chair, 0.452, 0.347, 0.114, 0, 0.829, -0.383, fabric);
  cushion.rotation.x = -0.07;
  for (const x of [-0.513, 0.513]) {
    box(chair, 0.091, 0.067, 0.935, x, 0.793, -0.018, paleOak);
    box(chair, 0.071, 0.391, 0.071, x, 0.611, 0.35, warmOak);
    box(chair, 0.072, 0.404, 0.078, x, 0.641, -0.32, warmOak);
  }

  const fern = movable('陶盆绿植', -3.77, -1.77, 0.52);
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
  pendant.position.set(-0.27, 3.11, -0.48);
  cabin.add(pendant);
  cylinder(pendant, 0.116, 0.116, 0.081, 0, 0.10, 0, iron);
  cylinder(pendant, 0.022, 0.022, 0.289, 0, -0.068, 0, iron);
  cylinder(pendant, 0.137, 0.382, 0.232, 0, -0.26, 0, standard('#dfaa6d', {
    emissive: '#bd703b', emissiveIntensity: 0.25
  }));
  cylinder(pendant, 0.383, 0.383, 0.026, 0, -0.385, 0, bulbMaterial);
  sphere(pendant, 0.085, 0.05, 0.085, 0, -0.401, 0, bulbMaterial);
  const lamp = new THREE.PointLight('#ffc47c', 16.5, 8, 2);
  lamp.position.set(0, -0.47, 0);
  pendant.add(lamp);
  const windowFill = new THREE.PointLight('#accbd6', 5.2, 6.4, 1.65);
  windowFill.position.set(2.22, 2.31, -3.76);
  cabin.add(windowFill);

  const picture = (x, y, width, height, color) => {
    box(cabin, width, height, 0.075, x, y, -4.099, trim);
    box(cabin, width - 0.08, height - 0.08, 0.051, x, y, -4.045, cream);
    box(cabin, width - 0.2, (height - 0.18) * 0.70, 0.035, x, y, -4.010, color);
    const sun = sphere(cabin, 0.048, 0.048, 0.015, x + width * 0.16, y + height * 0.12, -3.98, beige, false);
    sun.rotation.z = 0.12;
    const hill = sphere(cabin, (width - 0.2) * 0.48, 0.06, 0.015, x, y - height * 0.105, -3.98, ink, false);
    hill.rotation.z = 0.07;
  };
  picture(-0.67, 2.37, 0.63, 0.54, denim);
  picture(0.01, 2.06, 0.43, 0.41, moss);

  // Batch shared shapes inside each group so a furniture item still moves as a unit.
  for (const parent of [cabin, windowGroup, exit, pendant, table, bed, shelf, chair]) {
    const batches = new Map();
    for (const part of parent.children) {
      if (!part.isMesh || part.isInstancedMesh) continue;
      const key = [part.geometry.id, part.material.id, part.castShadow, part.receiveShadow].join('/');
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(part);
    }
    for (const parts of batches.values()) {
      if (parts.length < 3) continue;
      const sample = parts[0];
      const group = new THREE.InstancedMesh(sample.geometry, sample.material, parts.length);
      group.castShadow = sample.castShadow;
      group.receiveShadow = sample.receiveShadow;
      for (const [index, part] of parts.entries()) {
        part.updateMatrix();
        group.setMatrixAt(index, part.matrix);
      }
      parent.remove(...parts);
      parent.add(group);
    }
  }

  return {
    furniture,
    exit,
    update(time, daylight = true) {
      windowMaterial.map = daylight ? windowView : nightView;
      windowFill.intensity = daylight ? 5.2 : 2.2;
      lamp.intensity = (daylight ? 16.5 : 23.0) + Math.sin(time * 1.39) * 0.28;
      for (let i = 0; i < fernLeaves.length; i += 1) {
        fernLeaves[i].rotation.z = Math.sin(time * 0.91 + i * 1.6) * 0.052;
      }
    }
  };
}
