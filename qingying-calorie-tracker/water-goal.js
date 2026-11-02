(() => {
  const profileRecommendation = () => {
    const profile = state.profile || {};
    const sexMinimum = profile.sex === "male" ? 1700 : 1500;
    const weightEstimate = Number(profile.weight) > 0 ? Number(profile.weight) * 30 : sexMinimum;
    return Math.min(4000, Math.max(1000, Math.ceil(Math.max(sexMinimum, weightEstimate) / 100) * 100));
  };
  const defaults = { goalMl: profileRecommendation(), cupMl: 250, auto: true };
  state.waterSettings = { ...defaults, ...(state.waterSettings || {}) };
  const dialog = document.querySelector("#waterGoalDialog");
  const form = document.querySelector("#waterGoalForm");
  if (!dialog || !form) return;

  const ITEM_HEIGHT = 38;
  const createWheel = (element, values, input, unit) => {
    const column = document.createElement("div");
    column.className = "wheel-column";
    column.tabIndex = 0;
    column.setAttribute("role", "listbox");
    column.innerHTML = values.map((value) => `<div class="wheel-option" role="option" data-value="${value}">${value}</div>`).join("");
    const unitLabel = document.createElement("span");
    unitLabel.className = "wheel-unit";
    unitLabel.textContent = unit;
    element.append(column, unitLabel);

    const select = (value, smooth = false) => {
      const index = Math.max(0, values.indexOf(Number(value)));
      [...column.children].forEach((option, optionIndex) => {
        const selected = optionIndex === index;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-selected", String(selected));
      });
      input.value = values[index];
      column.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? "smooth" : "auto" });
      updateEstimate();
    };
    let timer = 0;
    column.addEventListener("scroll", () => {
      clearTimeout(timer);
      timer = setTimeout(() => select(values[Math.min(values.length - 1, Math.max(0, Math.round(column.scrollTop / ITEM_HEIGHT)))], true), 70);
    }, { passive: true });
    column.addEventListener("click", (event) => {
      const option = event.target.closest(".wheel-option");
      if (option) select(Number(option.dataset.value), true);
    });
    element.selectValue = select;
  };

  const goalInput = form.elements.goalMl;
  const cupInput = form.elements.cupMl;
  const updateEstimate = () => {
    const recommended = profileRecommendation();
    const cups = Math.ceil(Number(goalInput.value) / Number(cupInput.value));
    document.querySelector("#waterGoalEstimate").innerHTML = `根据当前体重和性别，建议至少 <b>${recommended} ml</b><br>当前目标每天约${cups}杯 · 共${goalInput.value} ml`;
  };
  createWheel(document.querySelector("#waterGoalWheel"), Array.from({ length: 31 }, (_, i) => 1000 + i * 100), goalInput, "ml");
  createWheel(document.querySelector("#waterCupWheel"), Array.from({ length: 9 }, (_, i) => 100 + i * 50), cupInput, "ml");

  let waterFrame = 0;
  const animateConsumed = (target) => {
    const element = document.querySelector("#waterConsumedMl");
    const startValue = Number(element.textContent) || 0;
    cancelAnimationFrame(waterFrame);
    if (startValue === target || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = target;
      return;
    }
    const start = performance.now();
    const duration = 520;
    element.classList.add("is-counting");
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(startValue + (target - startValue) * eased);
      if (progress < 1) waterFrame = requestAnimationFrame(tick);
      else {
        element.textContent = target;
        element.classList.remove("is-counting");
      }
    };
    waterFrame = requestAnimationFrame(tick);
  };

  const renderWaterGoal = () => {
    if (state.waterSettings.auto !== false) state.waterSettings.goalMl = profileRecommendation();
    const { goalMl, cupMl, auto } = state.waterSettings;
    const cups = Number(state.water[today()] || 0);
    const consumed = cups * cupMl;
    const percent = Math.min(100, consumed / goalMl * 100);
    animateConsumed(consumed);
    document.querySelector("#waterGoalMl").textContent = goalMl;
    document.querySelector("#waterProgressBar").style.width = `${percent}%`;
    document.querySelector(".water-controls small").textContent = `每杯约${cupMl}ml`;
    document.querySelector("#waterGoalSummary").innerHTML = `<h3>每日饮水目标</h3><p>${auto !== false ? "自动建议" : "自定义"} · 每天${goalMl} ml · 每杯${cupMl} ml · 约${Math.ceil(goalMl / cupMl)}杯</p><button class="secondary" id="editWaterGoal">设置饮水量</button>`;
    document.querySelector("#editWaterGoal").onclick = openSettings;
  };

  const baseRenderToday = renderToday;
  renderToday = function renderTodayWithWaterGoal() {
    baseRenderToday();
    renderWaterGoal();
  };

  function openSettings() {
    if (state.waterSettings.auto !== false) state.waterSettings.goalMl = profileRecommendation();
    const { goalMl, cupMl } = state.waterSettings;
    goalInput.value = goalMl;
    cupInput.value = cupMl;
    document.querySelector("#waterGoalWheel").selectValue(goalMl);
    document.querySelector("#waterCupWheel").selectValue(cupMl);
    dialog.showModal();
    requestAnimationFrame(() => {
      document.querySelector("#waterGoalWheel").selectValue(goalMl);
      document.querySelector("#waterCupWheel").selectValue(cupMl);
    });
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    const selectedGoal = Number(goalInput.value);
    state.waterSettings = { goalMl: selectedGoal, cupMl: Number(cupInput.value), auto: selectedGoal === profileRecommendation() };
    save();
    dialog.close();
    toast("饮水目标已保存");
  };

  document.querySelector("#editWaterGoal").onclick = openSettings;
  document.querySelector("#useAutoWaterGoal").onclick = () => {
    const recommended = profileRecommendation();
    goalInput.value = recommended;
    document.querySelector("#waterGoalWheel").selectValue(recommended, true);
    updateEstimate();
  };
  document.querySelector("#waterPlus").addEventListener("click", () => {
    const { goalMl, cupMl } = state.waterSettings;
    if ((state.water[today()] || 0) * cupMl >= goalMl) toast("今日饮水目标已完成 🎉");
  });
  renderWaterGoal();
})();
