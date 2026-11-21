import { landscapeData, shorePoint, terrainHeight } from './topography.js';
import { weatherSurface } from './weather.js';
import { deepWater, waterLight } from './water-optics.js';

function preview(THREE) {
  const data = landscapeData('ground', 64);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.color, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Fixed-format Blender export. One indexed primitive, no loader dependencies or texture requests.
function readTerrain(THREE, bytes) {
  const header = new DataView(bytes);
  if (header.getUint32(0) !== 0x54494445) throw new Error('Invalid tidal landscape');
  const vertices = header.getUint32(4, true), indices = header.getUint32(8, true);
  if (12 + 12 * vertices + 2 * indices !== bytes.byteLength) throw new Error('Incomplete tidal landscape');
  const positions = new Float32Array(vertices * 3);
  const packed = new Int16Array(bytes, 12, positions.length);
  for (let i = 0; i < packed.length; i++) positions[i] = packed[i] / 512;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(bytes, 12 + 6 * vertices, vertices * 3), 3, true));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(bytes, 12 + 9 * vertices, vertices * 3), 3, true));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes, 12 + 12 * vertices, indices), 1));
  return geometry;
}

function surfaceMaterial(THREE, weather, seabed, time) {
  const material = weatherSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91 }), weather);
  const addWeather = material.onBeforeCompile;
  material.customProgramCacheKey = () => seabed ? 'coated-tidal-seafloor' : 'coated-tidal-stone';
  material.onBeforeCompile = shader => {
    addWeather(shader);
    Object.assign(shader.uniforms, waterLight);
    // Apparent depth from Snell's law prevents a grazing view of the back bank from
    // looking like an exposed cliff. Keep real positions for lighting and depth extinction.
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      if (weatherPosition.y < 0.0) {
        vec2 horizontal = cameraPosition.xz-weatherPosition.xz;
        float distanceSquared = dot(horizontal,horizontal);
        float apparentY = 0.0;
        for (int step = 0; step < 3; step++) {
          float height = max(.001,cameraPosition.y-apparentY);
          float cosAir = height * inversesqrt(distanceSquared+height*height);
          apparentY = weatherPosition.y * cosAir * inversesqrt(.778+cosAir*cosAir);
        }
        vec3 apparent = vec3(weatherPosition.x,apparentY,weatherPosition.z);
        mvPosition = viewMatrix * vec4(apparent,1.0);
        gl_Position = projectionMatrix * mvPosition;
      }`);
    shader.fragmentShader = 'uniform float uNight, uDay, uCloud;\n'+deepWater+shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', `
      if (weatherPosition.y < 0.0) {
        float travel = -weatherPosition.y / max(.70,normalize(cameraPosition-weatherPosition).y);
        vec3 transmission = exp(-travel*vec3(.78,.43,.34));
        ${seabed ? `// A slope viewed edge-on gives way to the water behind it.
        // Use the smooth bed normal to avoid outlining the submerged ridge.
        float facing = dot(normal,normalize(vViewPosition));
        float bankVisibility = smoothstep(-.10,.27,facing);
        transmission *= mix(1.0,bankVisibility,smoothstep(.65,2.05,-weatherPosition.y));` : ''}
        gl_FragColor.rgb = mix(deepWaterColor(), gl_FragColor.rgb, transmission);
      }
      #include <colorspace_fragment>`);
    shader.fragmentShader = shader.fragmentShader.replace('cover *= mix', 'cover *= smoothstep(.03, .22, weatherPosition.y);\n        cover *= mix');
    if (!seabed) return;
    shader.uniforms.tideTime = time;
    shader.fragmentShader = 'uniform float tideTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      vec2 shoreUV = weatherPosition.xz;
      float bed = 1.0-smoothstep(-.25,.47,weatherPosition.y);
      float resolve = 1.0-smoothstep(.08,.31,length(fwidth(shoreUV)));
      if (bed * resolve > .001) {
        float ripple = sin(shoreUV.x*9.4 + shoreUV.y*5.8 + 2.8*sin(shoreUV.y*1.6)+1.2*cos(shoreUV.x*.96));
        float beam = abs(sin(shoreUV.x*2.4 + cos(shoreUV.y*2.1+tideTime*.39) + tideTime*.26)
          + .76*cos(shoreUV.y*2.5+sin(shoreUV.x*2.25-tideTime*.34)));
        float submerged = smoothstep(.03,.31,-weatherPosition.y)*(1.0-smoothstep(1.3,3.8,-weatherPosition.y));
        float ribbons = sin(shoreUV.x*.87+shoreUV.y*1.50+.98*cos(shoreUV.x*.65+.27*shoreUV.y));
        diffuseColor.rgb *= 1.0 + resolve * bed * (.064*ripple + (.095*ribbons+.20*(1.0-smoothstep(.03,.18,beam)))*submerged);
      }
      #include <roughnessmap_fragment>`);
  };
  return material;
}

function stoneGeometry(THREE, form) {
  const positions = [], colors = [];
  const vertices = [[], [], [], []];
  const sides = 7 + form;
  for (let ring = 0; ring < 4; ring++) {
    for (let i = 0; i < sides; i++) {
      const a = Math.PI * 2 * i / sides;
      const jitter = Math.sin(i * 28.3 + form) * .12;
      const radius = [.71, 1, .84, .50][ring] * (1 + .12 * Math.sin(i * 17.7 + 3 * form) + .09 * Math.cos(i * 6.5));
      const turn = a + jitter + [.19, 0, -.07, -.13][ring];
      vertices[ring].push([
        radius * Math.cos(turn) + ring * .034,
        [-.56, -.18, .35, .62][ring] + .13 * Math.cos(a + form) + jitter * .45,
        radius * Math.sin(turn),
      ]);
    }
  }
  function face(a, b, c, shade) {
    for (const point of [a, b, c]) {
      positions.push(...point);
      colors.push(shade, shade * .992, shade * .965);
    }
  }
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    for (let j = 1; j < 4; j++) {
      const shade = .69 + .08 * j + .052 * Math.sin(i * 7 + form);
      const low = vertices[j - 1], high = vertices[j];
      face(low[i], high[i], low[next], shade);
      face(high[i], high[next], low[next], shade * .985);
    }
    face(vertices[3][i], [.15,.67,-.05], vertices[3][next], .985);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createTidalLandscape(THREE, root, weather, batch, navigation) {
  const time = { value: 0 };
  const ground = new THREE.Mesh(preview(THREE), surfaceMaterial(THREE, weather, true, time));
  ground.name = 'tidal-landscape';
  ground.receiveShadow = true;
  root.add(ground);
  if (location.protocol !== 'file:') {
    fetch('./assets/coast/island-shelf-v1.bin').then(response => {
      if (!response.ok) throw new Error('Island mesh unavailable');
      return response.arrayBuffer();
    }).then(bytes => {
      const detailed = readTerrain(THREE, bytes);
      ground.geometry.dispose();
      ground.geometry = detailed;
      ground.userData.blenderMesh = true;
    }).catch(() => { /* The same coastline is already visible and walkable. */ });
  }

  let seed = 702041;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const forms = [[], [], []];
  const colors = ['#9c9983','#858b79','#b2aa92','#9a9a86','#747f71'];
  const reefs = ['#536a66','#4a605f','#68776a','#526763','#65756b'];
  function rock(x, z, scale, heading, under) {
    if (x > -.8 && x < 3.65 && z > 6.7 && z < 12.6) return;
    const y = terrainHeight(x, z);
    const palette = under ? reefs : colors;
    const type = Math.floor(random() * forms.length);
    forms[type].push({ x, y: y - scale * .075, z,
      sx: scale * (1 + random() * .38), sy: scale * (.57 + random() * .46), sz: scale * (.63 + random() * .47),
      rx: (random() - .5) * .25, ry: heading + (random() - .5) * .64, rz: (random() - .5) * .34,
      tint: palette[Math.floor(random() * palette.length)] });
  }
  for (let i = 0; i < 37; i++) {
    const angle = (i + random() * .85) * Math.PI * 2 / 37;
    const shore = shorePoint(angle);
    const under = i % 3 !== 0;
    const reach = under ? 1.06 + random() ** 1.3 * .51 : .91 + random() * .09;
    const cx = shore.x * reach, cz = shore.z * reach;
    const scale = under ? .44 + random() ** 1.2 * 1.05 : .62 + random() * .82;
    const heading = angle + (random() - .5) * 1.8;
    rock(cx, cz, scale, heading, under);
    const fragments = 2 + Math.floor(random() * 6);
    for (let j = 0; j < fragments; j++) {
      const a = random() * Math.PI * 2;
      const offset = scale * (.58 + random() * 1.2);
      rock(cx + Math.cos(a) * offset, cz + Math.sin(a) * offset, scale * (.13 + random() ** 1.5 * .44), heading, under);
    }
  }
  for (const [x,z,size] of [[6.6,5.4,.93],[7.1,5.92,.72],[7.4,5.34,.80],[-7.72,3.7,.57],[-7.3,4.14,.46],[-6.94,-4.7,.61],[6.25,-4.4,.56],[2.04,5.39,.24],[2.32,5.35,.32]]) {
    rock(x,z,size,random() * 6,false);
  }
  const stoneMaterial = surfaceMaterial(THREE, weather, false, time);
  forms.forEach((items, i) => navigation.blockInstances(batch(root, stoneGeometry(THREE, i), items, stoneMaterial)));
  return time;
}
