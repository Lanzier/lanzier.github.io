import { weatherSurface } from './weather.js';
import { botanicalMesh } from './botanical-mesh.js';

const TAU = Math.PI * 2;

export function createCoastalTrees(THREE, root, terrainHeight, weather, navigation) {
  const positions = [];
  const colors = [];
  const indices = [];
  const crowns = [];
  const bark = new THREE.Color('#795c40');
  const greens = ['#3f6435', '#4c7138', '#57803d', '#668741', '#75954b'];
  const tones = [.75, 1.02, 1.13, .88, .92, .69, .86];

  function stem(points, width, tipWidth) {
    const sides = tones.length;
    const first = positions.length / 3;
    if (navigation) {
      for (let i = 1; i < points.length; i++) {
        const [x,y,z] = points[i-1], [tx,ty,tz] = points[i];
        if (Math.min(y,ty) <= terrainHeight(x,z)+1.48) navigation.barrier(x,z,tx,tz,width*1.10);
      }
    }
    points.forEach(([x, y, z], ring) => {
      const progress = ring / (points.length - 1);
      const radius = THREE.MathUtils.lerp(width, tipWidth, progress);
      tones.forEach((tone, side) => {
        const angle = side * TAU / sides;
        const rib = radius * (1 + .09 * Math.sin(angle * 3 + .5));
        positions.push(x + Math.cos(angle) * rib, y, z + Math.sin(angle) * rib);
        colors.push(bark.r * tone, bark.g * tone, bark.b * tone);
        if (ring === points.length - 1) return;
        const a = first + ring * sides + side;
        const b = first + ring * sides + (side + 1) % sides;
        indices.push(a, a + sides, b, b, a + sides, b + sides);
      });
    });
  }

  const crownShape = [
    // Cross-crown offset, elevation, depth, and the three radii.
    [-.10, .65, -.05, .88, .235, .73, 1],
    [-.65, .66, .24, .53, .177, .47, 0],
    [.63, .69, -.18, .53, .193, .47, 2],
    [.07, .61, .38, .57, .174, .44, 1],
    [-.34, .77, -.34, .52, .191, .50, 3],
    [.24, .79, .15, .52, .193, .45, 3],
    [-.02, .865, -.07, .43, .155, .40, 4],
    [.77, .63, .33, .29, .138, .30, 1],
  ];

  function tree(x, z, height, spread, heading, variation) {
    const floor = terrainHeight(x, z) - .105;
    const cosine = Math.cos(heading);
    const sine = Math.sin(heading);
    function point(dx, y, dz) {
      return [x + (dx * cosine - dz * sine) * spread, floor + y * height, z + (dx * sine + dz * cosine) * spread];
    }
    stem([
      point(0, 0, 0), point(-.05, .13, .021), point(-.08, .37, .062), point(-.04, .55, .046), point(.15, .72, -.02),
    ], height * .048, height * .014);
    const fork = point(-.07, .36, .05);
    stem([fork, point(-.32, .51, .05), point(-.56, .64, .13)], height * .026, height * .009);
    stem([fork, point(.16, .47, -.09), point(.52, .66, -.12)], height * .024, height * .008);

    crownShape.forEach(([dx, y, dz, sx, sy, sz, palette], index) => {
      const width = 1 + .085 * Math.sin(index * 2.3 + variation);
      const center = point(dx + .075 * Math.sin(index * 3.7 + variation), y + .024 * Math.cos(index * 1.7 + variation), dz);
      crowns.push({
        center,
        scale: [sx * spread * width, sy * height, sz * spread],
        spin: heading + variation + index * 1.83,
        tilt: .16 * Math.sin(index * 2.45 - variation),
        tint: greens[palette],
      });
    });
  }

  tree(-7.70, -2.73, 4.60, 1.72, .31, .46);
  tree(-7.18, 1.13, 3.37, 1.52, -.42, 1.66);
  tree(-7.82, 5.48, 2.48, 1.07, .18, 2.43);
  tree(-4.34, -6.08, 3.52, 1.26, .70, .96);

  const woodGeometry = new THREE.BufferGeometry();
  woodGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  woodGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  woodGeometry.setIndex(indices);
  woodGeometry.computeVertexNormals();
  const wood = new THREE.Mesh(woodGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94 }));
  wood.castShadow = wood.receiveShadow = true;
  root.add(wood);

  const leavesGeometry = botanicalMesh(THREE, 'Crown');
  const foliage = new THREE.InstancedMesh(
    leavesGeometry,
    weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), weather, true),
    crowns.length,
  );
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  crowns.forEach(({ center, scale, tilt, spin, tint: color }, index) => {
    transform.position.set(...center);
    transform.scale.set(...scale);
    transform.rotation.set(tilt, spin, -tilt * .72);
    transform.updateMatrix();
    foliage.setMatrixAt(index, transform.matrix);
    foliage.setColorAt(index, tint.set(color));
  });
  foliage.castShadow = foliage.receiveShadow = true;
  root.add(foliage);
  navigation?.blockInstances(foliage);
}
