(() => {
  const ITEM_HEIGHT = 38;
  const form = document.querySelector("#profileForm");
  const dialog = document.querySelector("#profileDialog");
  if (!form || !dialog) return;

  const range = (min, max) => Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const buildColumn = (values, className = "") => {
    const column = document.createElement("div");
    column.className = `wheel-column ${className}`.trim();
    column.tabIndex = 0;
    column.setAttribute("role", "listbox");
    column.innerHTML = values.map((value) => `<div class="wheel-option" role="option" data-value="${value}">${value}</div>`).join("");
    return column;
  };

  const setColumn = (column, value, smooth = false) => {
    const options = [...column.querySelectorAll(".wheel-option")];
    const index = Math.max(0, options.findIndex((option) => Number(option.dataset.value) === Number(value)));
    options.forEach((option, optionIndex) => {
      const selected = optionIndex === index;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
    });
    column.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? "smooth" : "auto" });
  };

  document.querySelectorAll(".number-wheel").forEach((wheel) => {
    const name = wheel.dataset.wheel;
    const min = Number(wheel.dataset.min);
    const max = Number(wheel.dataset.max);
    const fallback = Number(wheel.dataset.default);
    const input = form.elements[name];
    const whole = buildColumn(range(min, max), "wheel-whole");
    let fraction = null;

    wheel.append(whole);
    if (wheel.classList.contains("decimal-wheel")) {
      const mark = document.createElement("span");
      mark.className = "wheel-decimal-mark";
      mark.textContent = ".";
      fraction = buildColumn(range(0, 9), "wheel-fraction");
      wheel.append(mark, fraction);
    }
    const unit = document.createElement("span");
    unit.className = "wheel-unit";
    unit.textContent = wheel.dataset.unit;
    wheel.append(unit);

    const updateInput = () => {
      const wholeValue = Number(whole.querySelector(".is-selected")?.dataset.value ?? fallback);
      const fractionValue = fraction ? Number(fraction.querySelector(".is-selected")?.dataset.value ?? 0) : 0;
      input.value = fraction ? (wholeValue + fractionValue / 10).toFixed(1) : String(wholeValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    const bindColumn = (column, values) => {
      let timer = 0;
      column.addEventListener("scroll", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const index = clamp(Math.round(column.scrollTop / ITEM_HEIGHT), 0, values.length - 1);
          setColumn(column, values[index], true);
          updateInput();
        }, 70);
      }, { passive: true });
      column.addEventListener("click", (event) => {
        const option = event.target.closest(".wheel-option");
        if (!option) return;
        setColumn(column, Number(option.dataset.value), true);
        updateInput();
      });
      column.addEventListener("keydown", (event) => {
        if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const current = Number(column.querySelector(".is-selected")?.dataset.value ?? values[0]);
        setColumn(column, clamp(current + (event.key === "ArrowDown" ? 1 : -1), values[0], values.at(-1)), true);
        updateInput();
      });
    };

    bindColumn(whole, range(min, max));
    if (fraction) bindColumn(fraction, range(0, 9));

    wheel.syncFromInput = () => {
      const value = clamp(Number(input.value || fallback), min, max);
      const wholeValue = Math.floor(value);
      const fractionValue = Math.round((value - wholeValue) * 10);
      setColumn(whole, wholeValue);
      if (fraction) setColumn(fraction, fractionValue);
    };
    wheel.syncFromInput();
  });

  const syncAll = () => document.querySelectorAll(".number-wheel").forEach((wheel) => wheel.syncFromInput?.());
  dialog.addEventListener("toggle", () => {
    if (dialog.open) requestAnimationFrame(syncAll);
  });
})();
