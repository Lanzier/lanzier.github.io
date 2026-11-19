const TAU = Math.PI * 2;

export function createCompanions(THREE, roomScene, islandScene) {
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const materials = {
    fur: material('#5ca998'),
    darkFur: material('#377b73'),
    paleFur: material('#f7e7c2'),
    blush: material('#e7a18d'),
    feature: material('#253c37'),
    eye: material('#1e3230', .29),
    shine: new THREE.MeshBasicMaterial({ color: '#fff7dd' }),
    scarf: material('#c4664b'),
    stitching: material('#f1ab6f'),
    cat: material('#dc8a43'),
    catDark: material('#a85831'),
    catLight: material('#f3c58f'),
    rind: material('#47764a'),
    melon: material('#e68381'),
    seed: material('#442e34')
  };

  function material(color, roughness = .74) {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }

  function form(parent, finish, position, size, angle = 0) {
    const mesh = new THREE.Mesh(sphere, finish);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    mesh.rotation.z = angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function line(parent, finish, radius, ...points) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const geometry = new THREE.TubeGeometry(curve, points.length * 4, radius, 7, false);
    const mesh = new THREE.Mesh(geometry, finish);
    parent.add(mesh);
    return mesh;
  }

  function shadowTexture() {
    const size = 32;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const distance = Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2) / (size / 2);
        pixels[(y * size + x) * 4 + 3] = Math.round(110 * Math.max(0, 1 - distance) ** 1.75);
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size);
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  const shadowMap = shadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: shadowMap });
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);

  function addShadow(parent, width, depth) {
    const plane = new THREE.Mesh(shadowGeometry, shadowMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = .012;
    plane.scale.set(width, depth, 1);
    parent.add(plane);
  }

  function addMelon(parent) {
    const fruit = new THREE.Group();
    fruit.position.set(0, .48, .29);
    fruit.rotation.x = -.25;
    parent.add(fruit);

    function slice(width, depth, thickness, finish, y, z) {
      const shape = new THREE.Shape();
      shape.moveTo(-width, 0);
      shape.quadraticCurveTo(0, .027, width, 0);
      shape.quadraticCurveTo(width * .79, -depth, 0, -depth);
      shape.quadraticCurveTo(-width * .79, -depth, -width, 0);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 12
      });
      const mesh = new THREE.Mesh(geometry, finish);
      mesh.position.set(0, y, z);
      fruit.add(mesh);
    }

    slice(.193, .126, .071, materials.rind, 0, -.018);
    slice(.176, .104, .042, materials.paleFur, .004, .024);
    slice(.158, .084, .033, materials.melon, .009, .05);
    for (const [x, y, angle] of [[-.095, -.034, -.33], [-.055, -.049, -.19], [.003, -.044, .07], [.06, -.049, .2], [.105, -.027, .45]]) {
      form(fruit, materials.seed, [x, y, .096], [.006, .013, .003], angle);
    }
    fruit.visible = false;
    return fruit;
  }

  function addCritter(parent) {
    const walker = new THREE.Group();
    const body = new THREE.Group();
    walker.name = '阿沫';
    parent.add(walker);
    addShadow(walker, 1.1, .78);
    walker.add(body);

    const feet = [-1, 1].map(side => form(body, materials.darkFur, [side * .154, .075, .104], [.112, .078, .16], side * .09));
    form(body, materials.fur, [0, .35, -.015], [.277, .305, .239]);
    form(body, materials.paleFur, [0, .321, .145], [.19, .201, .105]);
    form(body, materials.darkFur, [.03, .277, -.254], [.092, .125, .14], .31);

    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * .244, .438, .032);
      body.add(arm);
      form(arm, materials.fur, [side * .045, -.096, .022], [.084, .151, .099], side * .21);
      form(arm, materials.paleFur, [side * .065, -.179, .053], [.05, .057, .059], side * .17);
      return arm;
    });

    const collar = new THREE.Mesh(new THREE.TorusGeometry(.202, .052, 10, 36), materials.scarf);
    collar.position.set(0, .579, .007);
    collar.rotation.set(Math.PI / 2, 0, .12);
    collar.scale.x = 1.06;
    body.add(collar);
    form(body, materials.scarf, [.134, .559, .21], [.074, .063, .052], -.45);
    form(body, materials.scarf, [.169, .472, .202], [.049, .094, .036], .11);
    form(body, materials.scarf, [.223, .493, .177], [.046, .077, .035], .61);
    line(body, materials.stitching, .007, [.153, .514, .242], [.166, .477, .243], [.173, .444, .23]);

    const head = new THREE.Group();
    head.position.y = .743;
    body.add(head);
    form(head, materials.fur, [0, .053, 0], [.328, .258, .26]);
    form(head, materials.paleFur, [0, .017, .137], [.271, .201, .155]);
    form(head, materials.fur, [-.258, .218, -.017], [.104, .187, .079], .68);
    form(head, materials.paleFur, [-.289, .247, .031], [.058, .118, .047], .66);
    form(head, materials.fur, [.257, .189, -.018], [.101, .159, .076], -.92);
    form(head, materials.paleFur, [.286, .208, .026], [.057, .099, .043], -.93);
    form(head, materials.darkFur, [.043, .285, .025], [.058, .108, .062], -.54);
    form(head, materials.fur, [.12, .263, .03], [.047, .087, .048], -.94);

    const eyes = [-1, 1].map(side => {
      const eye = new THREE.Group();
      eye.position.set(side * .108, .053, .279);
      eye.rotation.y = side * .15;
      head.add(eye);
      form(eye, materials.eye, [0, 0, 0], [.051, .066, .027], side * .045);
      form(eye, materials.shine, [-.013, .023, .023], [.015, .017, .006]);
      form(eye, materials.shine, [.017, -.013, .025], [.007, .007, .004]);
      form(head, materials.blush, [side * .174, -.035, .252], [.049, .025, .018], side * .18);
      return eye;
    });

    form(head, materials.feature, [0, -.025, .297], [.026, .017, .012]);
    line(head, materials.feature, .008, [-.041, -.056, .283], [-.021, -.072, .287], [0, -.065, .29], [.021, -.072, .287], [.041, -.056, .283]);

    return { walker, body, feet, arms, head, eyes, fruit: addMelon(body), action: null };
  }

  function addCat(parent, x, z) {
    const anchor = new THREE.Group();
    const body = new THREE.Group();
    anchor.name = '柚子';
    anchor.position.set(x, 0, z);
    anchor.rotation.y = -.18;
    parent.add(anchor);
    anchor.add(body);
    addShadow(anchor, .69, .54);

    form(body, materials.cat, [0, .18, -.101], [.207, .17, .237]);
    form(body, materials.catLight, [0, .19, .031], [.139, .121, .132]);
    for (const side of [-1, 1]) {
      form(body, materials.catLight, [side * .109, .068, .15], [.08, .058, .106]);
      form(body, materials.cat, [side * .123, .38, .062], [.069, .118, .047], side * -.35);
      form(body, materials.blush, [side * .126, .393, .091], [.045, .08, .026], side * -.35);
    }

    form(body, materials.cat, [0, .31, .06], [.18, .133, .148]);
    form(body, materials.catLight, [0, .263, .151], [.123, .07, .072]);
    for (const side of [-1, 1]) {
      line(body, materials.catDark, .01, [side * .037, .425, .105], [side * .045, .402, .143], [side * .051, .384, .161]);
      line(body, materials.feature, .007, [side * .051, .31, .197], [side * .076, .319, .191], [side * .096, .312, .18]);
      line(body, materials.catDark, .004, [side * .096, .273, .205], [side * .151, .279, .181], [side * .184, .279, .17]);
      line(body, materials.catDark, .004, [side * .095, .256, .2], [side * .145, .254, .18], [side * .176, .251, .17]);
    }
    line(body, materials.catDark, .009, [0, .439, .093], [0, .418, .14], [0, .389, .175]);
    form(body, materials.catDark, [0, .281, .224], [.018, .012, .009]);
    line(body, materials.catDark, .005, [-.023, .261, .216], [-.012, .253, .222], [0, .26, .227], [.012, .253, .222], [.023, .261, .216]);

    const tail = new THREE.Group();
    tail.position.set(.14, .13, -.159);
    body.add(tail);
    line(tail, materials.cat, .044, [0, 0, 0], [.12, .009, -.046], [.237, .05, -.01], [.268, .102, .064], [.226, .128, .123]);
    line(tail, materials.catLight, .043, [.259, .114, .085], [.245, .124, .107], [.226, .128, .123]);
    form(tail, materials.catLight, [.225, .128, .125], [.041, .041, .041]);
    return { anchor, body, tail, x, z };
  }

  function addCompanions(scene, isRoom) {
    const anchor = new THREE.Group();
    anchor.name = isRoom ? '屋内的伙伴' : '岛上的伙伴';
    anchor.position.set(isRoom ? 1.35 : 1.3, isRoom ? 0 : .75, isRoom ? .6 : 2.5);
    scene.add(anchor);
    const critter = addCritter(anchor);
    const cat = addCat(anchor, isRoom ? -2.58 : .82, isRoom ? .44 : .13);
    return { anchor, critter, cat, isRoom };
  }

  const room = addCompanions(roomScene, true);
  const island = addCompanions(islandScene, false);
  let lastTime = 0;

  function ease(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function idlePose(time, isRoom) {
    const phase = (time + (isRoom ? 13 : 0)) % 24;
    const easing = ease((phase - 6) / 3) * (1 - ease((phase - 16) / 3));
    const walking = (phase > 6 && phase < 9) || (phase > 16 && phase < 19);
    return { x: easing * (isRoom ? .62 : .35), z: easing * (isRoom ? -.61 : -.23), walking, fruit: false, wave: 0, chew: 0 };
  }

  function actionPose(pose, action, elapsed) {
    if (action.name === 'greet') {
      pose.wave = Math.sin(Math.PI * THREE.MathUtils.clamp(elapsed / 2.1, 0, 1));
      return;
    }
    if (action.name === 'eat') {
      pose.fruit = elapsed > .3 && elapsed < 4.1;
      pose.chew = pose.fruit ? Math.sin(elapsed * 12) : 0;
      return;
    }
    const progress = ease(elapsed / 2.45) * (1 - ease((elapsed - 3.1) / 2.55));
    pose.x = THREE.MathUtils.lerp(action.x, action.destinationX, progress);
    pose.z = THREE.MathUtils.lerp(action.z, action.destinationZ, progress) + .32 * Math.sin(Math.PI * progress);
    pose.walking = elapsed < 2.45 || (elapsed > 3.1 && elapsed < 5.65);
    pose.fruit = elapsed > 2.65 && elapsed < 6.7;
    pose.chew = elapsed > 5.65 ? Math.sin(elapsed * 12) : 0;
  }

  function updateCompanions(state, time) {
    const { anchor, critter, cat, isRoom } = state;
    const pose = idlePose(time, isRoom);
    if (critter.action) {
      const action = critter.action;
      const elapsed = time - action.started;
      if (elapsed > action.duration) {
        critter.action = null;
      } else {
        actionPose(pose, action, elapsed);
        const recover = ease((elapsed - action.duration + .45) / .45);
        if (action.name !== 'harvest') {
          pose.x = THREE.MathUtils.lerp(action.x, pose.x, recover);
          pose.z = THREE.MathUtils.lerp(action.z, pose.z, recover);
          pose.walking = false;
        } else if (recover > 0) {
          const idle = idlePose(time, isRoom);
          pose.x = THREE.MathUtils.lerp(pose.x, idle.x, recover);
          pose.z = THREE.MathUtils.lerp(pose.z, idle.z, recover);
        }
      }
    }

    const groundHeight = anchor.userData.groundHeight;
    const step = pose.walking ? Math.sin(time * 11) : 0;
    const direction = pose.x - critter.walker.position.x;
    const facing = pose.walking && Math.abs(direction) > .0001 ? Math.sign(direction) * .71 : 0;
    critter.walker.position.set(pose.x, 0, pose.z);
    critter.walker.rotation.y += (facing - critter.walker.rotation.y) * .14;
    if (groundHeight) {
      critter.walker.position.y = groundHeight(anchor.position.x + pose.x, anchor.position.z + pose.z) - anchor.position.y;
      cat.anchor.position.y = groundHeight(anchor.position.x + cat.x, anchor.position.z + cat.z) - anchor.position.y;
    }
    critter.body.position.y = .008 + .013 * Math.sin(time * 2.5) + .081 * Math.abs(step) + .073 * pose.wave;
    critter.body.rotation.z = .022 * Math.sin(time * 1.7) + step * .067;
    critter.head.rotation.z = .022 * Math.sin(time * 1.5 + 1) - .22 * pose.wave;
    critter.head.rotation.x = -.055 * pose.chew;
    critter.feet[0].position.z = .104 + .062 * step;
    critter.feet[1].position.z = .104 - .062 * step;
    critter.arms[0].rotation.z = (pose.fruit ? .38 : -.06) - pose.wave * (1.5 + .34 * Math.sin(time * 17));
    critter.arms[0].rotation.x = step * .34 - (pose.fruit ? 1.0 : 0);
    critter.arms[1].rotation.x = -step * .34 - (pose.fruit ? 1.0 : 0);
    critter.arms[1].rotation.z = pose.fruit ? -.38 : .06;
    critter.fruit.visible = pose.fruit;
    critter.fruit.position.y = .48 + .019 * pose.chew;
    const blink = Math.pow(Math.max(0, Math.cos(time * TAU / 4.65)), 215);
    for (const eye of critter.eyes) eye.scale.y = 1 - .94 * blink;

    cat.body.scale.y = 1 + .039 * Math.sin(time * 2.25 + 1);
    cat.tail.rotation.y = .31 * Math.sin(time * 1.52);
    cat.anchor.rotation.y = -.18 + .16 * Math.sin(time * .68);
  }

  function update(timeSeconds) {
    lastTime = timeSeconds;
    updateCompanions(room, timeSeconds);
    updateCompanions(island, timeSeconds);
  }

  function trigger(action, sceneMode) {
    const { anchor, critter, isRoom } = sceneMode === 'room' ? room : island;
    const target = anchor.userData.harvestTarget;
    const durations = { greet: 2.15, eat: 4.4, harvest: 7.2 };
    if (!Object.prototype.hasOwnProperty.call(durations, action)) return;
    critter.action = {
      name: action,
      started: lastTime,
      duration: durations[action],
      x: critter.walker.position.x,
      z: critter.walker.position.z,
      destinationX: target ? target.x - anchor.position.x + .35 : isRoom ? -2.16 : -4.05,
      destinationZ: target ? target.z - anchor.position.z + .72 : isRoom ? 1.11 : .19
    };
  }

  return { room: room.anchor, island: island.anchor, update, trigger };
}
