const atmosphere = `
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  vec4 v = fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),
    dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1),vec2(127.1,311.7))))*43758.5453);
  return mix(mix(v.x,v.y,f.x),mix(v.z,v.w,f.x),f.y);
}
float clouds(vec2 p) {
  float a = 0.55*noise(p);
  p = mat2(1.49,-1.27,1.27,1.49)*p;
  a += 0.25*noise(p);
  p = mat2(1.61,-1.24,1.24,1.61)*p;
  a += 0.13*noise(p) + 0.07*noise(p*2.07);
  return a;
}
uniform float uTime;
uniform float uNight;
uniform float uDay;
uniform float uCloud;
uniform vec3 uSun;
uniform vec3 uMoon;
varying vec3 vWorld;
vec3 horizonColor() {
  vec3 horizon = mix(vec3(.64,.51,.42),vec3(.45,.68,.77),uDay);
  horizon = mix(horizon,vec3(.016,.035,.077),uNight);
  return mix(horizon,mix(vec3(.36,.44,.50),vec3(.023,.043,.076),uNight),uCloud*.52);
}
float twilightStrength() {
  return (1.0-smoothstep(.018,.10,abs(uSun.y)))*smoothstep(-.075,.005,uSun.y)*(1.0-uCloud*.78);
}
vec3 horizonGlow(vec3 ray) {
  vec2 sunBearing = normalize(uSun.xz);
  vec2 bearing = normalize(ray.xz + vec2(.00001,0.0));
  float spread = exp(-23.0*(1.0-clamp(dot(bearing,sunBearing),-1.0,1.0)));
  return vec3(.37,.15,.052)*spread*exp(-abs(ray.y)*48.0)*twilightStrength();
}
`;

const worldVertex = `
varying vec3 vWorld;
void main() {
  vec4 here = modelMatrix*vec4(position,1.0);
  vWorld = here.xyz;
  gl_Position = projectionMatrix*viewMatrix*here;
}
`;

const skyFragment = `
${atmosphere}
${moonSurfaceSource()}
void main() {
  vec3 d = normalize(vWorld-cameraPosition);
  float h = max(d.y, 0.0);
  float proximity = max(0.0,dot(d,uSun));
  float moonProximity = max(0.0,dot(d,uMoon));
  vec3 horizon = horizonColor();
  vec3 zenith = mix(vec3(.135,.32,.55),vec3(.19,.49,.73),uDay);
  zenith = mix(zenith,vec3(.004,.012,.032),uNight);
  zenith = mix(zenith,mix(vec3(.31,.40,.49),vec3(.012,.024,.052),uNight),uCloud*.63);
  vec3 c = mix(horizon,zenith,1.0-exp(-5.2*h));
  float aboveHorizon = smoothstep(.006,.084,h);
  float twilight = twilightStrength();
  float dawn = 1.0-smoothstep(.025,.23,uSun.y);
  float sunlight = smoothstep(-.13,.02,uSun.y)*(1.0-uCloud*.75);
  float moonlight = smoothstep(-.04,.045,uMoon.y)*uNight*(1.0-uCloud*.82);
  float solarGlow = exp(-34.0*(1.0-proximity));
  vec3 solarTint = mix(vec3(.94,.91,.73),vec3(1.0,.42,.15),dawn);
  c += solarTint*solarGlow*sunlight*(.22+dawn*.26)*smoothstep(-.006,.025,d.y)*(1.0-twilight*.75);
  c += vec3(.14,.23,.39)*pow(moonProximity,76.0)*moonlight*.57*aboveHorizon;

  vec2 cloudUV = d.xz/(h+.19)*1.72 + vec2(3.7,uTime*.012);
  float f = clouds(cloudUV);
  float strand = clouds(cloudUV*1.7+vec2(13.2,8.5));
  float coverage = smoothstep(.53-uCloud*.27,.72-uCloud*.17,f+strand*.12)*smoothstep(.012,.085,h);
  vec3 cloud = mix(vec3(.40,.32,.36),vec3(.94,.54,.38),pow(proximity,6.0));
  cloud += vec3(.19,.15,.10)*smoothstep(.40,.70,strand);
  cloud = mix(cloud,vec3(.88,.91,.88),uDay);
  cloud = mix(cloud,vec3(.027,.043,.077),uNight);
  c = mix(c,cloud,coverage*.78);
  float skyMask = smoothstep(-.0015,.0025,d.y);
  float heightGap = d.y-uSun.y;
  float solarCore = exp(-1750.0*(1.0-proximity)-heightGap*heightGap*twilight*3750.0);
  float solarBloom = exp(-220.0*(1.0-proximity)-heightGap*heightGap*twilight*710.0);
  c += (vec3(1.0,.97,.87)*solarCore*.78+solarTint*solarBloom*.31)
    * sunlight*skyMask*(1.0-coverage*.74);
  c += horizonGlow(d);

  if (moonProximity > .9988 && moonlight > .001) {
    vec3 side = normalize(cross(vec3(0.0,1.0,0.0),uMoon));
    vec2 point = vec2(dot(d,side),dot(d,cross(uMoon,side)))/.023;
    float disc = 1.0-smoothstep(.92,1.035,length(point));
    c = mix(c,lunarSurface(point),disc*moonlight*skyMask*(1.0-coverage*.77));
  }

  if (uNight > 0.01) {
    vec2 field = d.xz/(h+.27)*147.0;
    float seed = noise(floor(field)*.94+.5);
    float star = 1.0-smoothstep(.046,.164,length(fract(field)-.5));
    c += vec3(.6,.72,.86)*star*step(.795,seed)*uNight*smoothstep(.045,.16,h)*(1.0-coverage);
  }
  gl_FragColor = vec4(c,1.0);
  #include <colorspace_fragment>
}
`;

function moonSurfaceSource() {
  return `
vec3 lunarSurface(vec2 point) {
  float radius = length(point);
  float surface = sqrt(max(0.0,1.0-radius*radius));
  float maria = smoothstep(.36,.68,clouds(point*3.0+vec2(6.3,1.9)));
  float craters = 0.0;
  for (int i=0;i<22;i++) {
    float n = float(i)+1.0;
    vec2 center = vec2(noise(vec2(n*3.37,8.1)),noise(vec2(n*1.51,19.3)))*1.87-.91;
    float size = .032 + .13*noise(vec2(n*3.09,6.1));
    float d = length(point-center)/size;
    float floorShade = 1.0-smoothstep(.27,.82,d);
    float rim = smoothstep(.70,.91,d)*(1.0-smoothstep(.97,1.17,d));
    craters += rim*.046-floorShade*.049;
  }
  float grain = (noise(point*32.0)-.5)*.078;
  float lunarShade = clamp(.78 + surface*.20 - maria*.30 + craters + grain,.33,1.0);
  return vec3(.72,.83,1.0)*lunarShade;
}
`;
}

const oceanFragment = `
${atmosphere}
uniform vec2 uShoreSize;
uniform float uWaveDetail;
uniform sampler2D uReefs;
void main() {
  vec2 p = vWorld.xz;
  float distanceToEye = length(vWorld-cameraPosition);
  float fine = 1.0-smoothstep(42.0,105.0,distanceToEye);
  vec3 eye = normalize(cameraPosition-vWorld);
  vec2 waves = vec2(
    sin(dot(p,vec2(1.1,.47))+uTime*.81)*.073+
    sin(dot(p,vec2(.37,-2.8))-uTime*1.22)*.038,
    sin(dot(p,vec2(.18,1.18))+uTime*.92)*.057+
    sin(dot(p,vec2(1.31,3.77))-uTime*1.51)*.028
  );
  waves += (vec2(noise(p*3.2+uTime*.30),noise(p*3.5-uTime*.23))-.5)*fine*.018;
  float detail = uWaveDetail * (1.0-smoothstep(62.0,148.0,distanceToEye));
  vec3 N = normalize(vec3(waves.x*detail,1.0,waves.y*detail));
  float fresnel = pow(1.0-clamp(dot(eye,N),0.0,1.0),3.0);
  float undulation = sin(p.y*2.6 + p.x*.11 + uTime*1.47 + noise(p*.52)*2.5);
  float micro = sin(p.y*12.5 + sin(p.x*3.4 + uTime*.37) + uTime*1.3);
  float waveLight = undulation*.024 + micro*.002*fine + (noise(p*vec2(.31,1.75)+uTime*.26)-.5)*.014;

  vec3 deep = mix(vec3(.015,.105,.25),vec3(.018,.16,.34),uDay);
  vec3 blue = mix(vec3(.12,.52,.68),vec3(.20,.68,.83),uDay);
  vec3 reflection = mix(vec3(.35,.52,.49),vec3(.36,.63,.71),uDay);
  deep = mix(deep,vec3(.006,.019,.049),uNight);
  blue = mix(blue,vec3(.020,.105,.145),uNight);
  reflection = mix(reflection,vec3(.025,.058,.105),uNight);
  vec2 scaled = p/uShoreSize;
  float a = atan(scaled.y,scaled.x);
  float coast = (1.0 + .077*cos(a*3.0+.8) + .062*sin(a*5.0-.5)
    + .038*cos(a*8.0+1.45) + .031*sin(a*13.0)) * (1.0-.12*pow(max(0.0,sin(a)),4.0));
  float depth = max(0.0,length(scaled)-coast);
  float sandGrain = noise(p*.49);
  float shoal = 1.0-smoothstep(.05,.66,depth + (sandGrain-.5)*.075);
  float clarity = 1.0-smoothstep(.065,.55,depth);
  vec3 middle = mix(deep,blue,.38);
  vec3 c = mix(mix(deep,middle,1.0-smoothstep(.19,1.27,depth)),blue,shoal);
  vec3 sand = mix(vec3(.21,.65,.65),vec3(.32,.81,.74),uDay);
  sand = mix(sand,vec3(.034,.23,.26),uNight);
  c = mix(c,sand,(1.0-smoothstep(.02,.28,depth))*.62);
  if (depth < .80) {
    float shelfWidth = .46+.10*sin(a*4.0+.7)+.052*cos(a*7.0-1.2)+(noise(p*.37)-.5)*.10;
    float seabed = depth/max(shelfWidth,.22);
    float floorVisibility = (1.0-smoothstep(.39,1.36,seabed))*(1.0-fresnel*.34);
    float grain = mix(sandGrain,noise(p*2.45),clarity*.53);
    float gully = sin(a*23.0 + sin(a*9.0)*2.6 + seabed*3.8)*.16
      + sin(a*39.0-seabed*2.2)*.066;
    float slopeShade = 1.0 + (gully+(grain-.5)*.56)*(1.0-smoothstep(.20,1.1,seabed));
    vec3 rimSand = mix(vec3(.40,.47,.31),vec3(.57,.66,.43),uDay);
    vec3 submergedRock = mix(vec3(.062,.27,.25),vec3(.10,.36,.31),uDay);
    vec3 slope = mix(rimSand,submergedRock,smoothstep(.035,.88,seabed+gully*.65))*slopeShade;
    slope = mix(slope,vec3(.018,.113,.13)*slopeShade,uNight*.86);
    c = mix(c,slope,floorVisibility*.96);
    vec4 stone = texture2D(uReefs,p/vec2(56.0,44.0)+.5);
    float visibility = 1.0-smoothstep(.10,.69,depth);
    vec3 reef = mix(vec3(.009,.038,.054),vec3(.078,.23,.23),stone.r);
    c = mix(c,reef,stone.a*visibility*.82*(1.0-fresnel*.46));
  }
  c = mix(c,c*vec3(.75,.85,.92),uCloud*.6);
  c = mix(c * vec3(.54,.64,.82),c,max(uWaveDetail,shoal));
  c *= .99 + waveLight*3.8*detail*(1.0-clarity*.36);
  c = mix(c,reflection,fresnel*.48*(1.0-clarity*.68));
  float glare = pow(max(dot(reflect(-uSun,N),eye),0.0),23.0);
  float spark = pow(max(dot(reflect(-uSun,N),eye),0.0),111.0);
  vec3 shine = mix(vec3(1.0,.49,.24),vec3(.96,.91,.74),smoothstep(.015,.26,uSun.y));
  float reflectionStrength = (1.0-uCloud*.88)*mix(.10,1.0,uWaveDetail)*(1.0-clarity*.63);
  c += shine*(.32*glare+.84*spark*detail)*smoothstep(-.025,.055,uSun.y)*(1.0-uDay*.56)*reflectionStrength;
  vec2 moonDirection = normalize(uMoon.xz);
  vec2 towardViewer = normalize(eye.xz + vec2(.00001,0.0));
  float moonLane = pow(max(dot(-moonDirection,towardViewer),0.0),68.0);
  float strips = smoothstep(.39,.77,noise(vec2(dot(p,moonDirection)*1.45,dot(p,vec2(-moonDirection.y,moonDirection.x))*.24)+uTime*.41));
  float lunarAlignment = max(dot(reflect(-uMoon,N),eye),0.0);
  float moonGlints = moonLane * (.085*pow(lunarAlignment,25.0) + pow(lunarAlignment,106.0)*(.28+strips*.48)*detail);
  c += vec3(.39,.52,.76)*moonGlints*uNight*smoothstep(-.02,.04,uMoon.y)*reflectionStrength;
  float foamAA = max(fwidth(depth)*1.1,.0045);
  float foamLine = 0.0;
  for (int i=0;i<3;i++) {
    float line = float(i);
    float ripple = .030 + line*.024 + sin(a*13.0)*.008 + sin(uTime*1.3+line*1.6)*.004;
    float band = 1.0-smoothstep(.003,.005+foamAA,abs(depth-ripple));
    float breakup = .39 + noise(vec2(a*19.0,line+uTime*.19))*.55;
    foamLine += band*breakup*(.50-line*.14)*min(1.0,.007/foamAA);
  }
  c = mix(c,mix(vec3(.60,.87,.83),vec3(.14,.27,.31),uNight),foamLine*uWaveDetail);
  float twilight = twilightStrength();
  float horizonMist = max(smoothstep(mix(100.0,190.0,twilight),680.0,distanceToEye),1.0-smoothstep(.003,mix(.10,.041,twilight),eye.y));
  c = mix(c,horizonColor()+horizonGlow(-eye),horizonMist);
  gl_FragColor = vec4(c,1.0);
  #include <colorspace_fragment>
}
`;

function makeReefTexture(THREE, shorePoint) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 604;
  const context = canvas.getContext("2d");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(canvas.width / 56, -canvas.height / 44);
  let seed = 184731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function rock(x, z, width) {
    const corners = 5 + Math.floor(random() * 4);
    const rotation = random() * Math.PI * 2;
    const narrowness = .39 + random() * .65;
    const outline = [];
    for (let i = 0; i < corners; i++) {
      const angle = (i + random() * .51) * Math.PI * 2 / corners;
      const radius = width * (.67 + random() * .48);
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius * narrowness;
      outline.push([x + dx * Math.cos(rotation) - dz * Math.sin(rotation),
        z + dx * Math.sin(rotation) + dz * Math.cos(rotation)]);
    }
    context.beginPath();
    context.moveTo(...outline[0]);
    outline.slice(1).forEach(point => context.lineTo(...point));
    context.closePath();
    context.fillStyle = `rgba(27,27,27,${.61 + random() * .39})`;
    context.fill();
    context.beginPath();
    context.moveTo(x - width * .16, z + width * .07);
    outline.slice(0, Math.ceil(corners / 2)).forEach(point => context.lineTo(...point));
    context.closePath();
    context.fillStyle = "rgba(144,144,144,.46)";
    context.fill();
  }

  function reefCenter(extraDepth) {
    const angle = random() * Math.PI * 2;
    const { x, z } = shorePoint(angle);
    const reach = 1.045 + random() ** 1.65 * extraDepth;
    return [x * reach, z * reach];
  }

  for (let i = 0; i < 23; i++) {
    const [x, z] = reefCenter(.53);
    const size = .27 + random() ** 1.9 * .89;
    rock(x, z, size);
    const count = 3 + Math.floor(random() * 6);
    const spread = .75 + random() * 1.35;
    for (let j = 0; j < count; j++) {
      const angle = random() * Math.PI * 2;
      const offset = .25 + random() * spread;
      rock(x + Math.cos(angle) * offset, z + Math.sin(angle) * offset, .11 + random() ** 1.7 * size * .72);
    }
  }
  for (let i = 0; i < 57; i++) {
    const [x, z] = reefCenter(.67);
    rock(x, z, .13 + random() ** 2.1 * .62);
  }
  return new THREE.CanvasTexture(canvas);
}

export function createCoast(THREE, scene, shorePoint, shoreSize) {
  const uniforms = {
    uTime: { value: 0 },
    uDay: { value: 0 },
    uNight: { value: 0 },
    uCloud: { value: 0 },
    uSun: { value: new THREE.Vector3(-.60, .15, -.79).normalize() },
    uMoon: { value: new THREE.Vector3(.12, .2, -.94).normalize() },
    uShoreSize: { value: new THREE.Vector2(...shoreSize) },
    uWaveDetail: { value: 1 },
    uReefs: { value: makeReefTexture(THREE, shorePoint) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(465, 28, 15),
    new THREE.ShaderMaterial({ uniforms, vertexShader: worldVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(6400, 6400).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader: worldVertex, fragmentShader: oceanFragment }),
  );
  scene.add(ocean);

  const birds = Array.from({ length: 4 }, (_, index) => {
    const wing = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, 0, .44, .035, -.105, .86, 0, .11,
      0, 0, 0, .86, 0, .11, .39, -.025, .105,
    ], 3));
    const material = new THREE.MeshBasicMaterial({ color: "#525b53", side: THREE.DoubleSide });
    const right = new THREE.Mesh(wing, material);
    const left = new THREE.Mesh(wing, material);
    left.scale.x = -1;
    const flock = new THREE.Group();
    flock.scale.setScalar(.62 + index * .055);
    flock.add(left, right);
    scene.add(flock);
    return { flock, left, right };
  });

  function moveCelestialBody(direction, minute, rise, height, offset) {
    const phase = (minute - rise) * Math.PI / 720;
    direction.set(offset - .78 * Math.cos(phase), height * Math.sin(phase), -.87).normalize();
  }
  return {
    update(time, minute, day, night, cloud, cameraDistance) {
      uniforms.uTime.value = time;
      uniforms.uDay.value = day;
      uniforms.uNight.value = night;
      uniforms.uCloud.value = cloud;
      const detail = 1 - THREE.MathUtils.smoothstep(cameraDistance, 44, 83);
      uniforms.uWaveDetail.value = detail;
      moveCelestialBody(uniforms.uSun.value, minute, 360, .145, .19);
      moveCelestialBody(uniforms.uMoon.value, minute, 1080, .163, .19);
      birds.forEach(({ flock, left, right }, i) => {
        const angle = time * .16 + i * .2;
        flock.position.set(Math.sin(angle) * 18 - 1.8, 7.3 + Math.sin(angle * 2 + i) * .58 + i*.34, -13 + Math.cos(angle) * 8);
        flock.rotation.y = angle + Math.PI * .5;
        flock.visible = night < .72;
        left.rotation.z = -(right.rotation.z = Math.sin(time * 4.2 + i) * .52);
      });
    },
  };
}
