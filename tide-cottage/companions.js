import { createDshPet } from './dsh-pet.js';

export function createCompanions(THREE, roomScene, islandScene) {
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const pet = createDshPet(THREE);
  const materials = {
    blush: material('#e7a18d'),
    feature: material('#253c37'),
    cat: material('#dc8a43'),
    catDark: material('#a85831'),
    catLight: material('#f3c58f'),
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

  function addCritter(parent) {
    const walker = new THREE.Group();
    walker.name = 'Ww';
    parent.add(walker);
    addShadow(walker, .93, .64);
    const sprite = pet.sprite();
    walker.add(sprite);
    return { walker, sprite, mirrored: false, heading: new THREE.Vector3(0, 0, -1) };
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
    anchor.position.set(isRoom ? 1.43 : 1.3, isRoom ? 0 : .75, isRoom ? 1.24 : 3.78);
    scene.add(anchor);
    const critter = addCritter(anchor);
    const cat = addCat(anchor, isRoom ? -3.58 : .82, isRoom ? .66 : .13);
    return { anchor, critter, cat, isRoom };
  }

  const room = addCompanions(roomScene, true);
  const island = addCompanions(islandScene, false);
  const local = new THREE.Vector3();

  function update(time, sceneMode, camera, actor) {
    for (const state of [room, island]) {
      const { anchor, critter, cat, isRoom } = state;
      const mode = isRoom ? 'room' : 'island';
      const active = mode === actor.sceneMode;
      critter.walker.visible = active;
      if (active) {
        anchor.worldToLocal(local.copy(actor.position));
        critter.walker.position.copy(local);
        critter.heading.copy(actor.heading);
        const cameraAxes = camera.matrixWorld.elements;
        const facing = actor.heading.x * cameraAxes[0] + actor.heading.z * cameraAxes[2];
        if (Math.abs(facing) > .01) critter.mirrored = facing > 0;
        const sleeping = !actor.moving && actor.activity === 'sleep';
        critter.sprite.material.rotation = sleeping ? -.97 : 0;
        pet.display(critter.sprite, actor.clip, actor.clipTime, time, critter.mirrored);
      } else {
        critter.sprite.visible = false;
      }
      const ground = anchor.userData.groundHeight;
      if (ground) cat.anchor.position.y = ground(anchor.position.x + cat.x, anchor.position.z + cat.z) - anchor.position.y;
      cat.anchor.visible = mode === sceneMode;
      cat.body.scale.y = 1 + .039 * Math.sin(time * 2.25 + 1);
      cat.tail.rotation.y = .31 * Math.sin(time * 1.52);
      cat.anchor.rotation.y = -.18 + .16 * Math.sin(time * .68);
    }
  }

  function photoSubject(sceneMode) {
    return (sceneMode === 'room' ? room : island).critter;
  }

  return { room: room.anchor, island: island.anchor, update, photoSubject };
}
