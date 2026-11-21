export const coastX = 14.55;
export const coastZ = 9.15;
const tau = Math.PI * 2;
const clamp = n => Math.max(0, Math.min(1, n));
function smooth(low, high, value) {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
}

function coastline(a) {
  const radius = 1 + .077 * Math.cos(a * 3 + .8) + .062 * Math.sin(a * 5 - .5)
    + .038 * Math.cos(a * 8 + 1.45) + .031 * Math.sin(a * 13);
  return radius * (1 - .12 * Math.max(0, Math.sin(a)) ** 4);
}

export function shorePoint(angle) {
  const r = coastline(angle);
  return { x: Math.cos(angle) * coastX * r, z: Math.sin(angle) * coastZ * r };
}

export function islandRadius(x, z) {
  const nx = x / coastX, nz = z / coastZ;
  return Math.hypot(nx, nz) / coastline(Math.atan2(nz, nx));
}

function geology(a) {
  return .48 + .23 * Math.sin(3 * a + .8) + .15 * Math.cos(5 * a - 1.2) + .11 * Math.sin(8 * a);
}

function surface(r, a, x, z) {
  if (r <= 1) {
    const meadow = .88 - .13 * r + Math.sin(x * .29 + z * .16) * .023 + Math.sin(x * .17 - z * .31) * .015;
    const headland = smooth(.57, .82, r) * (.18 * geology(a) - .035);
    return (meadow + headland) * (1 - Math.max(0, (r - .79) / .21) ** 1.35);
  }
  // Distance in world metres makes opposite sides of an elliptical bay read at the same scale.
  const offshore = Math.hypot(x, z) * (1 - 1 / r);
  const stone = geology(a);
  const shelfEdge = 2.5 + 3.85 * (1 - stone) + .65 * Math.cos(a * 4 + .2);
  const lip = Math.max(0, offshore - shelfEdge);
  const channels = (.17 * Math.sin(a * 13 + offshore * .45) + .075 * Math.cos(a * 21 - offshore * .65))
    * smooth(0, 2, offshore) * stone;
  return -Math.min(14, offshore * (.205 + .19 * stone) + .014 * offshore ** 2 + .115 * lip ** 2 + channels);
}

export function terrainHeight(x, z) {
  const a = Math.atan2(z / coastZ, x / coastX);
  return surface(Math.hypot(x / coastX, z / coastZ) / coastline(a), a, x, z);
}

function linearColor(hex) {
  return [16, 8, 0].map(shift => {
    const v = ((hex >> shift) & 255) / 255;
    return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  });
}
const meadow = linearColor(0x799255), grass = linearColor(0x678451), oat = linearColor(0xa4a467);
const dune = linearColor(0xdbc799), damp = linearColor(0xb6a77c), floorSand = linearColor(0xd2c79d);
const shale = linearColor(0x58756a), deepShelf = linearColor(0x325854);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function groundColor(x, y, z, r, a) {
  const patch = Math.sin(.54 * x + .27 * z) * Math.cos(.49 * z - .14 * x);
  const grain = Math.sin(1.37 * x + .68 * z) * Math.sin(.97 * z - .51 * x);
  const fringe = r + .019 * patch + .009 * grain;
  if (r > 1) {
    const stone = geology(a);
    const strata = smooth(.39, .81, stone + patch * .12 + grain * .055);
    const mottled = mix(floorSand, shale, strata * smooth(.12, 1.4, -y) * .88);
    return mix(mix(damp, mottled, smooth(0, .6, -y)), deepShelf, smooth(1.3, 6, -y));
  }
  const moss = mix(grass, meadow, .54 + .43 * patch);
  const straw = mix(moss, oat, smooth(.69, .86, fringe) * .66);
  return mix(mix(straw, dune, smooth(.79, .94, fringe)), damp, 1 - smooth(.015, .29, y));
}

const groundRings = [.095,.22,.36,.49,.60,.69,.75,.79,.835,.87,.90,.93,.958,.98,1,1.025,1.06,1.11,1.17,1.24,1.33,1.43,1.55,1.69,1.85,2.08,2.42,2.88];
const waterRings = [.72,.91,.97,1,1.035,1.09,1.16,1.24,1.34,1.46,1.62,1.84,2.13,2.55,3.1,440];

// The Blender export, immediate preview, water opacity and walker all sample this profile.
export function landscapeData(kind, segments) {
  const water = kind === 'water';
  const rings = water ? waterRings : groundRings;
  const position = [], color = [], depth = [], indices = [];
  function vertex(x, z, r, a) {
    const y = surface(r, a, x, z);
    position.push(x, water ? 0 : y, z);
    if (water) depth.push(Math.min(13, Math.max(0, -y)));
    else color.push(...groundColor(x, y, z, r, a));
  }
  vertex(0, 0, 0, 0);
  for (let row = 0; row < rings.length; row++) {
    const r = rings[row];
    for (let i = 0; i < segments; i++) {
      const a = tau * (i + (row % 2) * .28) / segments;
      const shore = shorePoint(a);
      vertex(shore.x * r, shore.z * r, r, a);
      const here = 1 + row * segments + i;
      const next = 1 + row * segments + (i + 1) % segments;
      if (row === 0) indices.push(0, next, here);
      else indices.push(here - segments, next - segments, here, next - segments, next, here);
    }
  }
  return { position, color, depth, indices };
}
