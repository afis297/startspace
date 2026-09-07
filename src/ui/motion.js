let masonryFrame = 0;

const MAX_FLIP_WIDGETS = 16;
const SPEED_FACTORS = Object.freeze({ fast: 0.72, normal: 1, slow: 1.35 });
const PARALLAX_EASINGS = Object.freeze({
  soft: "cubic-bezier(0.16, 1, 0.3, 1)",
  balanced: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  sharp: "cubic-bezier(0.3, 0, 0.1, 1)",
});
const MOVE_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const EXIT_EASE = "cubic-bezier(0.55, 0.06, 0.68, 0.19)";
const CUBIC_BEZIER = /^cubic-bezier\(\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*,\s*-?(?:\d+|\d*\.\d+)\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*,\s*-?(?:\d+|\d*\.\d+)\s*\)$/i;

function motionProfile(settings) {
  const speed = String(settings?.behavior?.animationSpeed || "normal");
  const reduced = settings?.behavior?.reduceMotion || speed === "off" || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return reduced ? null : { factor: SPEED_FACTORS[speed] || SPEED_FACTORS.normal };
}

function parallaxEase(settings) {
  const behavior = settings?.behavior || {};
  if (behavior.parallaxEasing === "custom" && CUBIC_BEZIER.test(String(behavior.parallaxBezier || "").trim())) {
    return String(behavior.parallaxBezier).trim();
  }
  return PARALLAX_EASINGS[behavior.parallaxEasing] || PARALLAX_EASINGS.soft;
}

function canAnimate() {
  return typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
}

function duration(profile, seconds) {
  return Number((seconds * profile.factor).toFixed(3));
}

function schedule(callback) {
  const frame = globalThis.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  return frame(callback);
}

function cancel(frame) {
  if (!frame) return;
  if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(frame);
  else clearTimeout(frame);
}

function stop(target) {
  target.getAnimations?.().forEach((animation) => animation.cancel());
}

function fadeSlide(targets, profile, { seconds = 0.18, stagger = 0, delay = 0, fromOpacity = 0, fromX = 0, fromY = 7, ease = MOVE_EASE } = {}) {
  const ms = duration(profile, seconds) * 1000;
  if (ms <= 0 || !targets.length) return;
  targets.forEach((target, index) => {
    if (typeof target.animate !== "function") return;
    stop(target);
    target.animate(
      [{ opacity: fromOpacity, transform: `translate(${fromX}px, ${fromY}px)` }, { opacity: 1, transform: "translate(0, 0)" }],
      { duration: ms, delay: duration(profile, delay) * 1000 + index * stagger * 1000, easing: ease, fill: "backwards" },
    );
  });
}

/** One-time staggered rise for dock buttons on startup. */
export function animateDockEnter(root, settings) {
  const profile = motionProfile(settings);
  if (!profile || !root || !canAnimate()) return;
  fadeSlide([...root.children], profile, { seconds: 0.15, stagger: 0.03, fromY: 6 });
}

/** Slide-fade entrance for floating surfaces: side panels glide from the right, dialogs rise. */
export function animatePanel(target, settings, { fromX = 14, fromY = 0, seconds = 0.16 } = {}) {
  const profile = motionProfile(settings);
  if (!profile || !target || !canAnimate()) return;
  fadeSlide([target], profile, { seconds, fromX, fromY });
}

function widgetIcons(widgets) {
  return widgets
    .map((widget) => widget.querySelector(".widget-body [data-widget-icon], .widget-body svg") || widget.querySelector(".widget-drag-handle svg"))
    .filter(Boolean);
}

function widgetKey(widget, index) {
  return widget.dataset?.widgetId || `index:${index}`;
}

export function animateMasonryReflow(root, settings, applyLayout) {
  const profile = motionProfile(settings);
  const before = [...root.querySelectorAll(".desktop-widget")];
  if (!profile || !canAnimate() || !before.length || before.length > MAX_FLIP_WIDGETS) {
    applyLayout();
    return;
  }

  const rects = new Map(before.map((widget, index) => [widgetKey(widget, index), widget.getBoundingClientRect()]));
  const ms = duration(profile, 0.26) * 1000;
  applyLayout();
  cancel(masonryFrame);
  masonryFrame = schedule(() => {
    const after = [...root.querySelectorAll(".desktop-widget")];
    if (!after.length) return;
    const entered = [];
    after.forEach((widget, index) => {
      const from = rects.get(widgetKey(widget, index));
      if (!from) {
        entered.push(widget);
        return;
      }
      const to = widget.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = to.width > 0 ? from.width / to.width : 1;
      const sy = to.height > 0 ? from.height / to.height : 1;
      if (!dx && !dy && sx === 1 && sy === 1) return;
      stop(widget);
      widget.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "translate(0, 0) scale(1, 1)" }],
        { duration: ms, easing: MOVE_EASE },
      );
    });
    fadeSlide(entered, profile, { seconds: 0.16 });
  });
}

export function animateWorkspaceStart(root, settings) {
  const profile = motionProfile(settings);
  if (!profile || !canAnimate()) return;
  const targets = [...root.querySelectorAll(".desktop-widget")];
  fadeSlide(targets, profile, { seconds: 0.19, stagger: targets.length > 14 ? 0.007 : 0.016 });
}

export function animateWorkspaceEnter(root, settings) {
  const profile = motionProfile(settings);
  if (!profile || !canAnimate()) return;
  const targets = [...root.querySelectorAll(".desktop-widget")];
  if (!targets.length) return;
  fadeSlide(targets, profile, { seconds: 0.16, stagger: targets.length > 14 ? 0.006 : 0.014 });
  fadeSlide(widgetIcons(targets), profile, {
    seconds: 0.22, stagger: targets.length > 14 ? 0.007 : 0.014, delay: 0.035, fromOpacity: 0.48, fromY: 11, ease: parallaxEase(settings),
  });
}

export function animateWidgetEnter(target, settings) {
  const profile = motionProfile(settings);
  if (!profile || !target || !canAnimate()) return;
  fadeSlide([target], profile, { seconds: 0.16 });
}

export function animateWidgetExit(target, settings, remove) {
  const profile = motionProfile(settings);
  if (!profile || !target || typeof target.animate !== "function") {
    remove();
    return;
  }
  stop(target);
  const animation = target.animate(
    [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-4px)" }],
    { duration: duration(profile, 0.12) * 1000, easing: EXIT_EASE, fill: "forwards" },
  );
  animation.onfinish = remove;
  animation.oncancel = remove;
}
