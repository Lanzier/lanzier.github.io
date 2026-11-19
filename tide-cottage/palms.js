const TWO_PI = Math.PI * 2;

export function createPalms(THREE, island, terrainHeight) {
  const colors = values => values.map(value => new THREE.Color(value));
  const bark = colors(["#987759", "#ad8d6b", "#795d4a", "#b09a7f"]);
  const leaves = colors(["#356d45", "#4c8c47", "#6ba44a", "#88ae54", "#2c6749", "#4f955b"]);
  const fruitColors = colors(["#829a4b", "#a7a35c", "#879550", "#7a754a", "#948b53"]);
  const dryLeaf = new THREE.Color("#9b7d43");
  const stem = new THREE.Color("#87994c");
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: .86,
  });
  const trunkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96 });
  const fruitMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .78 });
  const fruitShape = new THREE.IcosahedronGeometry(1, 1);
  const dummy = new THREE.Object3D();
  const trunks = draft();
  const crowns = [];

  let seed = 38752;
  function random(min, max) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return min + (max - min) * seed / 4294967296;
  }

  function draft() {
    const positions = [], tints = [], indices = [];
    return {
      vertex(x, y, z, tint, value = 1) {
        positions.push(x, y, z);
        tints.push(tint.r * value, tint.g * value, tint.b * value);
        return positions.length / 3 - 1;
      },
      quad(a, b, c, d) {
        indices.push(a, b, c, b, d, c);
      },
      mesh(material, parent) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(tints, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const object = new THREE.Mesh(geometry, material);
        object.castShadow = true;
        object.receiveShadow = true;
        parent.add(object);
      },
    };
  }

  function trunk(x, z, height, leanX, leanZ, thickness, isFan) {
    const ground = terrainHeight(x, z) - .09;
    const scars = Math.round(height / (isFan ? .145 : .245));
    const sides = 10;
    let previous;
    for (let ring = 0; ring <= scars * 4; ring++) {
      const phase = ring % 4;
      const t = (Math.floor(ring / 4) + [0, .14, .33, .79][phase]) / scars;
      const offset = t * t * (.66 + .34 * t);
      const bow = Math.sin(Math.PI * t) * .14;
      const radius = thickness * (1 - .44 * t + .29 * Math.exp(-12 * t)) *
        [1, .94, .98, 1.025][phase];
      const y = ground + height * t;
      const row = [];
      for (let side = 0; side < sides; side++) {
        const angle = TWO_PI * side / sides;
        const shade = 1 + .08 * Math.sin(side * 8 + Math.floor(ring / 4) * .82);
        row.push(trunks.vertex(
          x + leanX * offset + bow + Math.cos(angle) * radius,
          y + Math.sin(angle * 2 + t * 8) * .038 * radius / thickness,
          z + leanZ * offset + Math.sin(angle) * radius,
          bark[phase], shade,
        ));
      }
      if (previous) {
        for (let side = 0; side < sides; side++) {
          const next = (side + 1) % sides;
          trunks.quad(previous[side], row[side], previous[next], row[next]);
        }
      }
      previous = row;
    }
    return [x + leanX, ground + height, z + leanZ];
  }

  function arch(t, span, lift, drop, curl) {
    return [
      span * t,
      lift * Math.sin(Math.PI * .81 * t) - drop * t ** 2.25,
      curl * t * t,
    ];
  }

  function vertexAt(geometry, angle, x, y, z, tint, value) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return geometry.vertex(x * cosine - z * sine, y, x * sine + z * cosine, tint, value);
  }

  function leaflet(geometry, angle, source, end, width, tint, bend, sampleCount = 4) {
    const [x, y, z] = source;
    const dx = end[0] - x, dy = end[1] - y, dz = end[2] - z;
    const length = Math.hypot(dx, dz) || 1;
    const acrossX = -dz / length, acrossZ = dx / length;
    let previous;
    for (let step = 0; step <= sampleCount; step++) {
      const t = step / sampleCount;
      const profile = step === 0 || step === sampleCount ? .045 : Math.sin(Math.PI * t) ** .8;
      const halfWidth = width * profile * (1.26 - .5 * t);
      const px = x + dx * t, pz = z + dz * t;
      const py = y + dy * t + Math.sin(Math.PI * t) * bend;
      const shade = .87 + .20 * Math.sin(t * 1.7);
      const row = [
        vertexAt(geometry, angle, px - acrossX * halfWidth, py, pz - acrossZ * halfWidth, tint, shade * .81),
        vertexAt(geometry, angle, px, py + halfWidth * .40, pz, tint, shade * 1.13),
        vertexAt(geometry, angle, px + acrossX * halfWidth, py, pz + acrossZ * halfWidth, tint, shade),
      ];
      if (previous) {
        geometry.quad(previous[0], previous[1], row[0], row[1]);
        geometry.quad(previous[1], previous[2], row[1], row[2]);
      }
      previous = row;
    }
  }

  function rachis(geometry, angle, span, lift, drop, curl, width, tint) {
    let previous;
    for (let index = 0; index <= 12; index++) {
      const t = index / 12;
      const [x, y, z] = arch(t, span, lift, drop, curl);
      const radius = width * (1.12 - t);
      const row = [
        vertexAt(geometry, angle, x, y, z - radius, tint, .78),
        vertexAt(geometry, angle, x, y + radius * .35, z + radius, tint, 1.06),
      ];
      if (previous) geometry.quad(previous[0], previous[1], row[0], row[1]);
      previous = row;
    }
  }

  function coconutFrond(geometry, angle, span, lift, drop, tint) {
    const curl = random(-.23, .23);
    rachis(geometry, angle, span, lift, drop, curl, span * .022, tint === dryLeaf ? dryLeaf : stem);
    for (const side of [-1, 1]) {
      for (let index = 0; index < 12; index++) {
        const t = .12 + index * .071 + (side === 1 ? .019 : 0);
        const [x, y, z] = arch(t, span, lift, drop, curl);
        const portion = Math.sin(Math.PI * t) ** .79;
        const reach = span * (.06 + portion * random(.23, .34));
        leaflet(geometry, angle, [x, y, z], [
          x + reach * random(.55, .85),
          y - reach * random(.24, .56),
          z + side * reach,
        ], Math.min(span * .043, reach * .31), tint, reach * .17);
      }
    }
    const terminal = arch(.90, span, lift, drop, curl);
    leaflet(geometry, angle, terminal, arch(1.08, span, lift, drop, curl), span * .033, tint, .015, 3);
  }

  function fanFrond(geometry, angle, span, lift, drop, tint) {
    const curl = random(-.11, .11);
    rachis(geometry, angle, span * .60, lift, drop, curl, span * .032, stem);
    const hub = arch(1, span * .60, lift, drop, curl);
    for (let ray = -5; ray <= 5; ray++) {
      const theta = ray * .237;
      const reach = span * (.57 - .027 * Math.abs(ray)) * random(.93, 1.07);
      leaflet(geometry, angle, hub, [
        hub[0] + Math.cos(theta) * reach,
        hub[1] + reach * (.27 - .16 * Math.abs(ray)),
        hub[2] + Math.sin(theta) * reach,
      ], reach * .13, tint, reach * .20);
    }
  }

  function palm(x, z, height, spread, leanX, leanZ, isFan = false) {
    const crown = new THREE.Group();
    crown.position.set(...trunk(x, z, height, leanX, leanZ, isFan ? .158 : .205, isFan));
    island.add(crown);
    const geometry = draft();
    const offset = random(0, TWO_PI);
    const layers = isFan
      ? [[5, 1, .28, .47], [4, .92, .49, .25], [2, .64, .73, .06]]
      : [[6, 1, .32, .54], [5, .93, .51, .25], [3, .66, .77, .07]];
    layers.forEach(([count, length, lift, drop], layer) => {
      for (let i = 0; i < count; i++) {
        const angle = offset + layer * .54 + TWO_PI * i / count + random(-.18, .18);
        const tint = leaves[(i + layer * 2 + crowns.length) % leaves.length];
        const frond = isFan ? fanFrond : coconutFrond;
        frond(geometry, angle, spread * length * random(.86, 1.11), spread * lift, spread * drop, tint);
      }
    });
    if (!isFan) {
      coconutFrond(geometry, offset + .25, spread * .59, spread * .09, spread * .66, dryLeaf);
      const fruit = new THREE.InstancedMesh(fruitShape, fruitMaterial, fruitColors.length);
      fruitColors.forEach((tint, i) => {
        const angle = offset + i * 1.95;
        dummy.position.set(Math.cos(angle) * .18, -.11 - .06 * (i % 2), Math.sin(angle) * .18);
        dummy.rotation.set(Math.sin(angle) * .37, angle, Math.cos(angle) * .37);
        dummy.scale.set(.127, .176, .13);
        dummy.updateMatrix();
        fruit.setMatrixAt(i, dummy.matrix);
        fruit.setColorAt(i, tint);
      });
      fruit.castShadow = true;
      fruit.receiveShadow = true;
      crown.add(fruit);
    }
    geometry.mesh(leafMaterial, crown);
    crowns.push({ crown, offset });
  }

  palm(-6.22, -1.80, 5.65, 2.19, -.77, .33);
  palm(-7.14, -3.49, 4.28, 1.79, -.38, -.47);
  palm(-7.56, 1.84, 2.64, 1.37, -.31, .12, true);
  palm(5.96, -2.24, 5.10, 2.12, .75, .32);
  palm(7.35, .39, 3.17, 1.62, .53, -.16, true);
  palm(6.32, -4.19, 3.84, 1.69, .34, -.29);
  palm(1.73, -5.64, 5.05, 1.73, .19, -.38);
  palm(-2.69, -5.48, 4.04, 1.52, -.36, -.18);
  trunks.mesh(trunkMaterial, island);

  return {
    update(time) {
      for (const { crown, offset } of crowns) {
        crown.rotation.x = Math.sin(time * 1.19 + offset) * .042;
        crown.rotation.z = Math.sin(time * .94 + offset * .73) * .058;
      }
    },
  };
}
