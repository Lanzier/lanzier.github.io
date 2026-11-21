import { terrainHeight } from './topography.js';
import { weatherSurface } from './weather.js';

export function createMeadowPath(THREE, root, pathX, weather, batch, navigation) {
  const vertices = [], colors = [], indices = [];
  const soil = new THREE.Color('#937954');
  function point(x, z, opacity) {
    vertices.push(x, terrainHeight(x, z) + .013, z);
    colors.push(soil.r, soil.g, soil.b, opacity);
    return vertices.length / 3 - 1;
  }
  // Feather the worn ground between the stones into the surrounding meadow.
  for (let row = 0; row <= 32; row++) {
    const z = 2.48 + row * .161;
    const width = .68 + .05 * Math.sin(3.8 * z);
    for (const lateral of [-1, -.62, 0, .62, 1]) {
      const x = pathX(z) + width * lateral;
      const i = point(x, z, (1 - Math.abs(lateral) ** 2) * .52);
      if (row && lateral > -1) indices.push(i - 6, i - 1, i - 5, i - 5, i - 1, i);
    }
  }
  // The sheltered patch inside the pickets has trampled soil with a soft uneven margin.
  const center = point(5.37, 3.70, .79);
  const sides = 24;
  for (let ring = 1; ring <= 3; ring++) {
    for (let i = 0; i < sides; i++) {
      const a = Math.PI * 2 * i / sides;
      const radius = ring / 3 * (1 + .09 * Math.sin(a * 3 - .4) + .06 * Math.cos(a * 5));
      point(5.37 + Math.cos(a) * radius * 1.24, 3.70 + Math.sin(a) * radius * .75, [0, .81, .60, 0][ring]);
      const here = center + 1 + (ring - 1) * sides + i, next = center + 1 + (ring - 1) * sides + (i + 1) % sides;
      if (ring === 1) indices.push(center, next, here);
      else indices.push(here - sides, next - sides, here, next - sides, next, here);
    }
  }
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  ground.setIndex(indices);
  ground.computeVertexNormals();
  const wash = weatherSurface(new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }), weather);
  const earth = new THREE.Mesh(ground, wash);
  earth.receiveShadow = true;
  root.add(earth);
  navigation.support(earth);

  const outline = [[-.94,-.54],[-1,.18],[-.54,.87],[.18,.94],[.88,.45],[.98,-.25],[.52,-.83],[-.31,-.94]];
  const shape = new THREE.BufferGeometry();
  const positions = [], faceColors = [], faces = [];
  for (const [y, radius, shade] of [[0, .99, .64], [.65, 1, .79], [1, .86, 1]]) {
    for (const [x,z] of outline) {
      positions.push(x * radius, y + .04 * x, z * radius);
      faceColors.push(shade, shade, shade * .985);
    }
  }
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    for (let r = 0; r < 16; r += 8) faces.push(r+i, r+j, r+i+8, r+j, r+j+8, r+i+8);
    if (i > 0 && i < 7) faces.push(16, 16+i, 16+j);
  }
  shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute('color', new THREE.Float32BufferAttribute(faceColors, 3));
  shape.setIndex(faces);
  shape.computeVertexNormals();
  const palette = ['#b5a18b','#b5a78c','#a99b86','#c1ae96','#b4a48b'];
  const stones = [];
  for (let i = 0; i < 15; i++) {
    const z = 2.65 + i * .338;
    const x = pathX(z) + .065 * Math.cos(i * 2.8);
    stones.push({ x, y: terrainHeight(x,z) + .018, z,
      sx: .41 + .088 * Math.sin(i * 1.51), sy: .065, sz: .144 + .025 * Math.cos(i * 2.1),
      ry: .24 * Math.sin(i * 2.31) + (i % 3 === 1 ? Math.PI : 0), tint: palette[i % 5] });
  }
  navigation.support(batch(root, shape, stones, weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94 }), weather)));
}
