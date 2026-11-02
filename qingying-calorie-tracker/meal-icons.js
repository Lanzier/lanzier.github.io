(() => {
  const icons = { 早餐: "🌅", 午餐: "☀️", 晚餐: "🌙", 加餐: "😋" };
  const applyMealIcons = () => {
    document.querySelectorAll(".meal-card").forEach((card) => {
      const meal = card.querySelector("p")?.textContent.split(" · ")[0];
      const icon = card.querySelector(".meal-icon");
      if (icon && icons[meal]) icon.textContent = icons[meal];
    });
  };
  if (typeof renderToday === "function") {
    const originalRenderToday = renderToday;
    renderToday = function renderTodayWithMealIcons() {
      originalRenderToday();
      applyMealIcons();
    };
  }
  applyMealIcons();
})();
