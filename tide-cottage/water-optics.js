export const waterLight = { uDay: { value: 0 }, uNight: { value: 0 }, uCloud: { value: 0 } };

export const deepWater = `
vec3 deepWaterColor() {
  vec3 water = mix(vec3(.012,.075,.152),vec3(.016,.106,.215),uDay);
  return mix(water,vec3(.006,.019,.049),uNight) * (1.0-uCloud*.09);
}
`;
