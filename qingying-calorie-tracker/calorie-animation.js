(() => {
  const ring = document.querySelector("#calorieRing");
  const remaining = document.querySelector("#remainingCal");
  if (!ring || !remaining || typeof renderToday !== "function") return;

  const getAngle = () => {
    const match = ring.style.background.match(/([\d.]+)deg/);
    return match ? Number(match[1]) : 0;
  };
  const getNumber = () => {
    const value = Number(remaining.textContent);
    return Number.isFinite(value) ? value : null;
  };
  const paintRing = (angle) => {
    ring.style.background = `conic-gradient(var(--lime) ${angle}deg,#335a50 0deg)`;
  };
  const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
  const originalRenderToday = renderToday;
  let frame = 0;

  renderToday = function animatedRenderToday() {
    const fromNumber = getNumber();
    const fromAngle = getAngle();
    originalRenderToday();
    const toNumber = getNumber();
    const toAngle = getAngle();
    cancelAnimationFrame(frame);
    if (fromNumber === null || toNumber === null || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (fromNumber === toNumber && Math.abs(fromAngle - toAngle) < 0.01) return;

    remaining.textContent = Math.round(fromNumber);
    paintRing(fromAngle);
    const start = performance.now();
    const duration = 620;
    remaining.classList.add("is-counting");
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);
      remaining.textContent = Math.round(fromNumber + (toNumber - fromNumber) * eased);
      paintRing(fromAngle + (toAngle - fromAngle) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        remaining.textContent = Math.round(toNumber);
        paintRing(toAngle);
        remaining.classList.remove("is-counting");
      }
    };
    frame = requestAnimationFrame(tick);
  };
})();
