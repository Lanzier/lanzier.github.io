const numberOr = (value, fallback) => value === "" || value == null ? fallback : Number(value);

document.querySelector("#profileForm").onsubmit = (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(event.currentTarget));
  const old = state.profile || {};
  const weight = numberOr(raw.weight, old.weight || 65);
  state.profile = {
    sex: raw.sex || old.sex || "female",
    age: numberOr(raw.age, old.age || 30),
    height: numberOr(raw.height, old.height || 165),
    weight,
    goalWeight: numberOr(raw.goalWeight, old.goalWeight || weight),
    activity: numberOr(raw.activity, old.activity || 1.2),
    pace: numberOr(raw.pace, old.pace || 0.5)
  };
  if (!state.weights.length) state.weights.push({ date: today(), value: weight });
  save();
  document.querySelector("#profileDialog").close();
  toast("目标已保存，资料可随时补充");
};

document.querySelector("#foodForm").onsubmit = (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(event.currentTarget));
  const food = foods().find((item) => item.id === raw.foodId) || foods()[0];
  if (!food) return toast("食物库暂时为空");
  const grams = Math.max(1, numberOr(raw.grams, 100));
  const multiplier = grams / 100;
  (state.logs[today()] ??= []).push({
    id: crypto.randomUUID(), meal: raw.meal || "加餐", name: food.name, grams,
    cal: food.calories * multiplier, protein: food.protein * multiplier,
    carbs: food.carbs * multiplier, fat: food.fat * multiplier
  });
  save();
  document.querySelector("#foodDialog").close();
  toast("已加入今日饮食");
};

document.querySelector("#customFoodForm").onsubmit = (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(event.currentTarget));
  state.customFoods.push({
    id: `custom-${Date.now()}`, name: raw.name.trim() || "自定义食物",
    calories: Math.max(0, numberOr(raw.calories, 0)),
    protein: Math.max(0, numberOr(raw.protein, 0)),
    carbs: Math.max(0, numberOr(raw.carbs, 0)),
    fat: Math.max(0, numberOr(raw.fat, 0))
  });
  save();
  event.currentTarget.reset();
  document.querySelector("#customFoodDialog").close();
  toast("自定义食物已保存");
};

document.querySelector("#weightForm").onsubmit = (event) => {
  event.preventDefault();
  const raw = new FormData(event.currentTarget).get("weight");
  if (raw === "") {
    document.querySelector("#weightDialog").close();
    return toast("未填写体重，已跳过");
  }
  const value = Number(raw);
  const found = state.weights.find((item) => item.date === today());
  if (found) found.value = value; else state.weights.push({ date: today(), value });
  if (state.profile) state.profile.weight = value;
  save();
  document.querySelector("#weightDialog").close();
  toast("体重已记录");
};
