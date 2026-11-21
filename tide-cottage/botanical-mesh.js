import models from './assets/coastal-botany.js';

function unpack(encoded, ArrayType) {
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  return new ArrayType(bytes.buffer);
}

// Geometry is shared by every instance. The web build contains only positions,
// pigment and triangles, and does not fetch the editable Blender source.
export function botanicalMesh(THREE, name) {
  const { positions, colors, indices, colorScale = 1 } = models[name];
  const geometry = new THREE.BufferGeometry();
  geometry.name = name;
  const packed = unpack(positions, Int16Array);
  geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(packed, value => value / 4096), 3));
  const pigments = unpack(colors, Uint8Array);
  geometry.setAttribute('color', colorScale === 1
    ? new THREE.BufferAttribute(pigments, 3, true)
    : new THREE.Float32BufferAttribute(Float32Array.from(pigments, value => value * colorScale / 255), 3));
  geometry.setIndex(new THREE.BufferAttribute(unpack(indices, Uint16Array), 1));
  geometry.computeVertexNormals();
  return geometry;
}
