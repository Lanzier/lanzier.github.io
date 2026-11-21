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
varying vec3 vWorld;
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
void main() {
  vec3 d = normalize(vWorld-cameraPosition);
  float h = max(d.y, 0.0);
  float proximity = max(0.0,dot(d,uSun));
  vec3 horizon = mix(vec3(.79,.62,.46),vec3(.49,.76,.79),uDay);
  vec3 zenith = mix(vec3(.135,.32,.55),vec3(.19,.49,.73),uDay);
  horizon = mix(horizon,vec3(.09,.17,.25),uNight);
  zenith = mix(zenith,vec3(.022,.046,.105),uNight);
  vec3 c = mix(horizon,zenith,1.0-exp(-5.2*h));
  c = mix(c, mix(vec3(.35,.44,.50),vec3(.048,.084,.14),uNight), uCloud*.63);
  c += vec3(.33,.146,.053)*pow(proximity,12.0)*(1.0-uNight)*(1.0-uDay*.68);
  float sunHalo = pow(proximity,55.0);
  float sunDisc = smoothstep(.99955,.99978,proximity);
  c += vec3(.41,.22,.09)*sunHalo*(1.0-uNight);
  c += vec3(.35,.49,.67)*(sunDisc*.78+sunHalo*.17)*uNight;

  vec2 cloudUV = d.xz/(h+.19)*1.72 + vec2(3.7,uTime*.012);
  float f = clouds(cloudUV);
  float strand = clouds(cloudUV*1.7+vec2(13.2,8.5));
  float coverage = smoothstep(.53-uCloud*.27,.72-uCloud*.17,f+strand*.12)*smoothstep(.012,.085,h);
  vec3 cloud = mix(vec3(.40,.32,.36),vec3(.94,.54,.38),pow(proximity,6.0));
  cloud += vec3(.19,.15,.10)*smoothstep(.40,.70,strand);
  cloud = mix(cloud,vec3(.88,.91,.88),uDay);
  cloud = mix(cloud,vec3(.12,.17,.28),uNight);
  c = mix(c,cloud,coverage*.78);
  c = mix(c,vec3(1.0,.88,.59),sunDisc*(1.0-uNight)*.88*(1.0-uCloud));

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

const oceanFragment = `
${atmosphere}
uniform vec2 uShoreSize;
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
  waves += (vec2(noise(p*3.2+uTime*.30),noise(p*3.5-uTime*.23))-.5)*fine*.06;
  vec3 N = normalize(vec3(waves.x,1.0,waves.y));
  float fresnel = pow(1.0-clamp(dot(eye,N),0.0,1.0),3.0);
  float undulation = sin(p.y*2.6 + p.x*.11 + uTime*1.47 + noise(p*.52)*2.5);
  float micro = sin(p.y*12.5 + sin(p.x*3.4 + uTime*.37) + uTime*1.3);
  float waveLight = undulation*.024 + micro*.008*fine + (noise(p*vec2(.31,1.75)+uTime*.26)-.5)*.044;

  vec3 deep = mix(vec3(.015,.105,.25),vec3(.018,.16,.34),uDay);
  vec3 blue = mix(vec3(.12,.52,.68),vec3(.20,.68,.83),uDay);
  vec3 reflection = mix(vec3(.35,.52,.49),vec3(.36,.63,.71),uDay);
  deep = mix(deep,vec3(.014,.050,.105),uNight);
  blue = mix(blue,vec3(.027,.175,.215),uNight);
  reflection = mix(reflection,vec3(.081,.15,.238),uNight);
  vec2 scaled = p/uShoreSize;
  float a = atan(scaled.y,scaled.x);
  float coast = (1.0 + .077*cos(a*3.0+.8) + .062*sin(a*5.0-.5)
    + .038*cos(a*8.0+1.45) + .031*sin(a*13.0)) * (1.0-.12*pow(max(0.0,sin(a)),4.0));
  float depth = max(0.0,length(scaled)-coast);
  float shoal = 1.0-smoothstep(.025,.76,depth + (noise(p*.49)-.5)*.06);
  vec3 middle = mix(deep,blue,.34);
  vec3 c = mix(mix(deep,middle,1.0-smoothstep(.18,1.35,depth)),blue,shoal);
  c = mix(c,c*vec3(.75,.85,.92),uCloud*.6);
  c *= .99 + waveLight*3.8;
  c = mix(c,reflection,fresnel*.48);
  float glare = pow(max(dot(reflect(-uSun,N),eye),0.0),23.0);
  float spark = pow(max(dot(reflect(-uSun,N),eye),0.0),111.0);
  vec3 shine = mix(vec3(1.0,.59,.30),vec3(.43,.58,.85),uNight);
  c += shine*(.32*glare+.84*spark)*(1.0-uDay*.70)*(1.0-uCloud*.88);
  vec3 farColor = mix(vec3(.61,.66,.59),vec3(.43,.68,.74),uDay);
  farColor = mix(farColor,vec3(.083,.158,.238),uNight);
  c = mix(c,farColor,smoothstep(42.0,410.0,distanceToEye));
  gl_FragColor = vec4(c,1.0);
  #include <colorspace_fragment>
}
`;

export function createCoast(THREE, scene, shorePoint, shoreSize) {
  const uniforms = {
    uTime: { value: 0 },
    uDay: { value: 0 },
    uNight: { value: 0 },
    uCloud: { value: 0 },
    uSun: { value: new THREE.Vector3(-.60, .15, -.79).normalize() },
    uShoreSize: { value: new THREE.Vector2(...shoreSize) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(465, 28, 15),
    new THREE.ShaderMaterial({ uniforms, vertexShader: worldVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(850, 850).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader: worldVertex, fragmentShader: oceanFragment }),
  );
  scene.add(ocean);

  const foam = [];
  if (shorePoint) {
    for (const [offset, width, opacity] of [[.10, .20, .67], [.48, .12, .30], [.83, .13, .17]]) {
      const geometry = new THREE.BufferGeometry();
      const segments = 150;
      const vertices = [], uv = [], indices = [];
      for (let i = 0; i <= segments; i++) {
        const angle = 2 * Math.PI * i / segments;
        const point = shorePoint(angle);
        for (const edge of [0, 1]) {
          const distance = offset + edge * width + Math.sin(angle * 13) * .13;
          vertices.push(point.x + Math.cos(angle) * distance, .025, point.z + Math.sin(angle) * distance);
          uv.push(i / segments, edge);
        }
        if (i < segments) {
          const k = i * 2;
          indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geometry.setIndex(indices);
      const material = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uOpacity: { value: opacity }, uOffset: { value: offset } },
        vertexShader: `varying vec2 vUV;
          void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 vUV;
          uniform float uTime,uNight,uOpacity,uOffset;
          void main(){
            float crest=pow(max(sin(vUV.y*3.14159),0.0),1.65);
            float breakup=sin(vUV.x*144.0+uOffset*16.0-uTime*.76)*.29+
              sin(vUV.x*260.0+uTime*.65)*.17+.60;
            gl_FragColor=vec4(mix(vec3(.78,.94,.87),vec3(.21,.47,.52),uNight),crest*breakup*uOpacity);
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.renderOrder = 1;
      scene.add(ring);
      foam.push(ring);
    }
  }

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

  const sunTarget = new THREE.Vector3();
  return {
    update(time, day, night, cloud) {
      uniforms.uTime.value = time;
      uniforms.uDay.value = day;
      uniforms.uNight.value = night;
      uniforms.uCloud.value = cloud;
      sunTarget.set(-.61 + day*.15 + night*.11, .082 + day*.58 + night*.070, -.79);
      uniforms.uSun.value.copy(sunTarget).normalize();
      foam.forEach((ring, i) => ring.scale.setScalar(1 + .012 * Math.sin(time * 1.3 - i * .7)));
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
