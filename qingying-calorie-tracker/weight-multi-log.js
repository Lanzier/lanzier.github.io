(() => {
  const form = document.querySelector("#weightForm");
  if (!form || typeof renderToday !== "function" || typeof renderTrend !== "function") return;

  const latestTodayWeight = () => state.weights
    .filter((entry) => entry.date === today())
    .sort((a, b) => (a.recordedAt || a.date).localeCompare(b.recordedAt || b.date))
    .at(-1);

  const baseRenderToday = renderToday;
  renderToday = function renderTodayWithLatestWeight() {
    baseRenderToday();
    const latest = latestTodayWeight();
    if (latest) document.querySelector("#todayWeight").textContent = `${latest.value} kg`;
  };

  const baseRenderTrend = renderTrend;
  renderTrend = function renderTrendWithTimes() {
    baseRenderTrend();
    const entries = [...state.weights].sort((a, b) => (b.recordedAt || b.date).localeCompare(a.recordedAt || a.date));
    const history = document.querySelector("#weightHistory");
    if (!history) return;
    history.innerHTML = entries.map((entry) => {
      const time = entry.recordedAt
        ? new Date(entry.recordedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "";
      return `<div class="history-item"><span>${entry.date}${time ? ` ${time}` : ""}</span><strong>${entry.value} kg</strong></div>`;
    }).join("");
  };

  form.onsubmit = (event) => {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get("weight");
    if (raw === "") {
      document.querySelector("#weightDialog").close();
      return toast("未填写体重，已跳过");
    }
    const value = Number(raw);
    const now = new Date();
    state.weights.push({
      id: crypto.randomUUID(),
      date: today(),
      recordedAt: now.toISOString(),
      value
    });
    if (state.profile) state.profile.weight = value;
    save();
    document.querySelector("#weightDialog").close();
    toast("体重已记录，已加入趋势");
  };
})();
