const waterMinus = document.querySelector("#waterMinus");
const waterPlus = document.querySelector("#waterPlus");
const waterCount = document.querySelector("#waterCount");

function syncWaterControls() {
  waterMinus.disabled = Number(waterCount.textContent) <= 0;
}

waterPlus.addEventListener("click", () => {
  state.water[today()] = (state.water[today()] || 0) + 1;
  save();
  toast("已增加一杯水");
});

waterMinus.addEventListener("click", () => {
  state.water[today()] = Math.max(0, (state.water[today()] || 0) - 1);
  save();
  toast("已撤回一杯水");
});

new MutationObserver(syncWaterControls).observe(waterCount, { childList: true });
syncWaterControls();
