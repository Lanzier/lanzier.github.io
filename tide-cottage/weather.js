const labels = { clear: "晴天", cloudy: "多云", rain: "下雨", snow: "下雪" };
const snowCodes = [71, 73, 75, 77, 85, 86];
const forecast = "https://api.open-meteo.com/v1/forecast?latitude=29.31&longitude=120.08&timezone=Asia%2FShanghai&current=weather_code,cloud_cover,rain,showers,snowfall";

function yiwuMinute() {
  const date = new Date(Date.now() + 8 * 3600000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function createWeatherControls(get) {
  const button = get("light-toggle");
  const panel = get("weather-panel");
  const time = get("weather-time");
  const strength = get("weather-strength");
  const status = get("weather-status");
  const choices = Array.from(panel.querySelectorAll("[data-weather]"));
  const storageKey = "tide-cottage:yiwu-weather";
  let observed = { type: "clear", intensity: .5 };
  let override = {};
  let syncState = "正在同步义乌天气…";
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey));
    if (cached && Object.hasOwn(labels, cached.type) && Number.isFinite(cached.intensity)) {
      observed = cached;
      syncState = "显示上次同步的义乌天气";
    }
  } catch {}

  function current() {
    return {
      minute: override.minute ?? yiwuMinute(),
      type: override.type ?? observed.type,
      intensity: override.intensity ?? observed.intensity,
    };
  }

  function update() {
    const { minute, type, intensity } = current();
    const clock = [Math.floor(minute / 60), minute % 60].map(value => String(value).padStart(2, "0")).join(":");
    button.querySelector("span").textContent = labels[type];
    button.querySelector("use").setAttribute("href", minute < 360 || minute >= 1150 ? "#i-moon" : "#i-sun");
    button.setAttribute("aria-label", `天气，${labels[type]}`);
    time.value = minute;
    const hour = minute / 60;
    const warmth = Math.max(0, Math.min(1, (hour - 5) / 2, (20 - hour) / 2));
    time.style.setProperty("--time-thumb", `hsl(${Math.round(215 - warmth * 176)} 82% ${Math.round(67 + warmth * 14)}%)`);
    strength.value = Math.round(intensity * 100);
    get("weather-clock").value = clock;
    get("weather-percent").value = `${strength.value}%`;
    for (const choice of choices) choice.setAttribute("aria-pressed", String(choice.dataset.weather === type));
    status.textContent = override.type ? "手动天气" : syncState;
    get("time-reset").disabled = override.minute === undefined;
  }

  async function refresh() {
    try {
      const response = await fetch(forecast, { signal: AbortSignal.timeout(8500) });
      if (!response.ok) throw new Error();
      const { current: data } = await response.json();
      if (!Number.isFinite(data?.weather_code)) throw new Error();
      const code = data.weather_code;
      const type = snowCodes.includes(code) ? "snow" : code >= 51 ? "rain" : code >= 2 ? "cloudy" : "clear";
      const amount = type === "snow" ? data.snowfall * 2.2 : type === "rain" ? (data.rain + data.showers) * .65 : data.cloud_cover / 100;
      observed = { type, intensity: Math.max(.22, Math.min(1, amount || .22)) };
      syncState = "与义乌实时同步";
      try { localStorage.setItem(storageKey, JSON.stringify(observed)); } catch {}
    } catch {
      syncState = "实时天气暂不可用 · 义乌时间已同步";
    }
    update();
  }

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    update();
  });
  time.addEventListener("input", () => { override.minute = Number(time.value); update(); });
  get("time-reset").addEventListener("click", () => {
    delete override.minute;
    update();
  });
  strength.addEventListener("input", () => {
    override.type = current().type;
    override.intensity = Number(strength.value) / 100;
    update();
  });
  for (const choice of choices) choice.addEventListener("click", () => {
    override.type = choice.dataset.weather;
    override.intensity ??= .65;
    update();
  });
  get("weather-reset").addEventListener("click", () => {
    override = {};
    update();
    refresh();
  });
  update();
  refresh();
  setInterval(update, 15000);
  setInterval(refresh, 600000);
  return current;
}

export function weatherSurface(material, weather, crown = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.weatherSnow = weather.snow;
    shader.uniforms.weatherWet = weather.wet;
    shader.uniforms.weatherCrown = { value: Number(crown) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 weatherPosition;\nvarying float crownHeight;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vec4 weatherLocal = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          weatherLocal = instanceMatrix * weatherLocal;
        #endif
        weatherPosition = (modelMatrix * weatherLocal).xyz;
        crownHeight = position.y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform float weatherSnow, weatherWet, weatherCrown;
        varying vec3 weatherPosition;
        varying float crownHeight;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 coatingPosition = weatherPosition.xz;
        float edge = sin(coatingPosition.x*2.1+sin(coatingPosition.y*3.0))*cos(coatingPosition.y*2.4)
          + .35*sin(coatingPosition.x*7.0+coatingPosition.y*4.5);
        float cover = smoothstep(.01, .50, weatherSnow)
          * smoothstep(.53,.81,weatherSnow*1.2 + edge*.18);
        diffuseColor.rgb *= 1.0 - weatherWet*(.25 + edge*.06);
        float crownCover = smoothstep(.16,.63,crownHeight + edge*.08 - (1.0-weatherSnow)*.28);
        cover *= mix(1.0,crownCover*.92,weatherCrown);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86,.92,.96),cover);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, .20 + .15*edge, weatherWet*(1.0-cover));`);
  };
  return material;
}

export function createWeatherEffects(THREE, scene, roof) {
  const snow = { value: 0 };
  const wet = { value: 0 };
  const snowCount = 560, rainCount = 600, dripCount = 115;
  const makeSeeds = count => Array.from({ length: count }, () => Array.from({ length: 4 }, Math.random));
  const snowSeeds = makeSeeds(snowCount);
  const rainSeeds = makeSeeds(rainCount);
  const dripSeeds = makeSeeds(dripCount);

  function particles(count, material, point) {
    const geometry = new THREE.BufferGeometry();
    const points = new Float32Array(count * (point ? 3 : 6));
    const attribute = new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", attribute);
    const object = point ? new THREE.Points(geometry, material) : new THREE.LineSegments(geometry, material);
    object.frustumCulled = false;
    object.visible = false;
    scene.add(object);
    return { object, geometry, points, attribute, material };
  }

  const flakes = particles(snowCount, new THREE.PointsMaterial({
    color: "#f3f9ff", size: .10, transparent: true, depthWrite: false,
  }), true);
  flakes.material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <alphatest_fragment>",
      "diffuseColor.a *= 1.0-smoothstep(.20,.49,length(gl_PointCoord-.5));\n#include <alphatest_fragment>");
  };
  const drops = particles(rainCount + dripCount,
    new THREE.LineBasicMaterial({ color: "#b7e1fb", transparent: true, depthWrite: false }), false);
  let clouds = 0;
  let rain = 0;
  let snowfall = 0;

  function update(time, delta, type, intensity) {
    const blend = 1 - Math.exp(-delta * 2.4);
    rain = THREE.MathUtils.lerp(rain, type === "rain" ? intensity : 0, blend);
    snowfall = THREE.MathUtils.lerp(snowfall, type === "snow" ? intensity : 0, blend);
    clouds = THREE.MathUtils.lerp(clouds, type === "clear" ? (1 - intensity) * .15 : .28 + intensity * .68, blend);
    snow.value = THREE.MathUtils.clamp(snow.value + (snowfall > .03 ? snowfall / 24 : -1 / 52) * delta, 0, 1);
    wet.value = THREE.MathUtils.lerp(wet.value, rain, 1 - Math.exp(-delta / (rain > wet.value ? 3 : 13)));

    const flakeTotal = Math.round(snowfall * snowCount);
    flakes.object.visible = flakeTotal > 0;
    if (flakeTotal) {
      for (let i = 0; i < flakeTotal; i++) {
        const [a, b, c, d] = snowSeeds[i];
        const x = (a - .5) * 38 + Math.sin(time * .82 + d * 24) * .85;
        const z = (b - .5) * 27;
        const roofFloor = Math.abs(x) < roof.halfWidth && Math.abs(z - roof.center) < roof.span ? roof.eave + 1.7 : .18;
        flakes.points.set([x, roofFloor + (1 - (c + time * (.055 + d * .04)) % 1) * 12, z], i * 3);
      }
      flakes.attribute.needsUpdate = true;
      flakes.geometry.setDrawRange(0, flakeTotal);
      flakes.material.opacity = .78;
    }

    const dropTotal = Math.round(rain * rainCount);
    const dripTotal = Math.round(rain * dripCount);
    drops.object.visible = dropTotal + dripTotal > 0;
    if (drops.object.visible) {
      for (let i = 0; i < dropTotal; i++) {
        const [a, b, c, d] = rainSeeds[i];
        const y = (1 - (c + time * (.86 + d * .48)) % 1) * 16;
        const x = (a - .5) * 38 + y * .17;
        const z = (b - .5) * 27;
        const covered = Math.abs(x) < roof.halfWidth && Math.abs(z - roof.center) < roof.span && y < roof.eave + 1.7;
        const length = covered ? 0 : .20 + rain * .32;
        drops.points.set([x, y, z, x + length * .17, y + length, z], i * 6);
      }
      for (let i = 0; i < dripTotal; i++) {
        const [a, b, c, d] = dripSeeds[i];
        const x = (a - .5) * roof.halfWidth * 2;
        const z = roof.center + (b < .5 ? -1 : 1) * (roof.span + .11);
        const y = roof.eave - ((c + time * (.72 + d * .38)) % 1) ** 1.65 * (roof.eave - .92);
        drops.points.set([x, y, z, x, Math.min(roof.eave, y + .14 + rain * .2), z], (dropTotal + i) * 6);
      }
      drops.attribute.needsUpdate = true;
      drops.geometry.setDrawRange(0, (dropTotal + dripTotal) * 2);
      drops.material.opacity = .28 + rain * .32;
    }
    return clouds;
  }
  return { snow, wet, update };
}
