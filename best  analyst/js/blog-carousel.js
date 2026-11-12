const stage = document.querySelector("#storyStage");
const track = document.querySelector("#storyTrack");
const seats = Array.from(document.querySelectorAll(".story-seat"));
const launchCurtain = document.querySelector("#storyLaunchCurtain");

if (stage && track && seats.length) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const baseSpeed = reducedMotion.matches ? 0 : 0.14;
  const damping = 1.45;
  const pauseResponse = 3.8;
  let angle = 0;
  let wheelMomentum = 0;
  let pauseAmount = 0;
  let pointerOnCard = false;
  let manuallyScrollingUntil = 0;
  let lastFrame = 0;
  let radius = 0;

  function updateRadius() {
    const card = seats[0].querySelector(".story-card");
    if (!card) return;
    const width = card.offsetWidth;
    radius = width / (2 * Math.sin(Math.PI / seats.length)) + width * 0.12;
    seats.forEach((seat, index) => {
      const seatAngle = index * 360 / seats.length;
      seat.style.transform = `translate(-50%, -50%) rotateY(${seatAngle}deg) translateZ(${radius}px)`;
    });
  }

  function animate(timestamp) {
    const deltaTime = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;

    wheelMomentum *= Math.exp(-damping * deltaTime);
    const manualScrollActive = timestamp < manuallyScrollingUntil;
    const shouldPause = pointerOnCard && !manualScrollActive;
    const pauseTarget = shouldPause ? 1 : 0;
    pauseAmount += (pauseTarget - pauseAmount) * (1 - Math.exp(-pauseResponse * deltaTime));

    angle += (baseSpeed + wheelMomentum) * (1 - pauseAmount) * deltaTime;
    if (Math.abs(angle) > Math.PI * 2) angle %= Math.PI * 2;
    track.style.transform = `rotateY(${-angle}rad)`;
    requestAnimationFrame(animate);
  }

  function addMomentum(amount) {
    wheelMomentum = Math.max(-2.6, Math.min(2.6, wheelMomentum + amount));
  }

  function resetLaunchAnimation() {
    document.querySelectorAll(".story-card.is-launching").forEach((card) => {
      card.classList.remove("is-launching");
    });
    launchCurtain?.classList.remove("is-active");
  }

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? stage.clientHeight
        : 1;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    addMomentum(delta * scale * 0.0015);
    manuallyScrollingUntil = performance.now() + 850;
  }, { passive: false });

  seats.forEach((seat) => {
    seat.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") pointerOnCard = true;
    });
    seat.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") pointerOnCard = false;
    });
    seat.addEventListener("focusin", () => { pointerOnCard = true; });
    seat.addEventListener("focusout", (event) => {
      if (!seat.contains(event.relatedTarget)) pointerOnCard = false;
    });

    const card = seat.querySelector(".story-card");
    const image = seat.querySelector(".story-cover img");
    image?.addEventListener("error", () => {
      image.hidden = true;
    }, { once: true });

    card?.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();

      const destination = card.href;
      card.classList.add("is-launching");
      launchCurtain?.classList.add("is-active");
      const delay = reducedMotion.matches ? 40 : 620;
      window.setTimeout(() => {
        const newTab = window.open(destination, "_blank");
        if (newTab && !newTab.closed) {
          newTab.opener = null;
        } else {
          window.location.assign(destination);
        }
      }, delay);
      window.setTimeout(resetLaunchAnimation, delay + 900);
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetLaunchAnimation();
  });
  window.addEventListener("pageshow", resetLaunchAnimation);

  window.addEventListener("resize", updateRadius);
  updateRadius();
  requestAnimationFrame(animate);
}
