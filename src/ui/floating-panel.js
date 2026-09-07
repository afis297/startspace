const MIN_SIZE = Object.freeze({ w: 300, h: 280 });

const toNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalize(frame, { edge = 8 } = {}) {
  const maxW = Math.max(MIN_SIZE.w, window.innerWidth - edge * 2);
  const maxH = Math.max(MIN_SIZE.h, window.innerHeight - edge * 2);
  const w = clamp(toNumber(frame?.w, 370), MIN_SIZE.w, maxW);
  const h = clamp(toNumber(frame?.h, Math.min(620, maxH)), MIN_SIZE.h, maxH);
  return {
    x: clamp(toNumber(frame?.x, window.innerWidth - w - edge), edge, Math.max(edge, window.innerWidth - w - edge)),
    y: clamp(toNumber(frame?.y, edge), edge, Math.max(edge, window.innerHeight - h - edge)),
    w: Math.round(w),
    h: Math.round(h),
    ...(frame?.layoutMode ? { layoutMode: frame.layoutMode } : {}),
  };
}

export function mountFloatingPanel({ root, store, key }) {
  let active = null;
  let frameId = null;
  let resizeHandle = null;
  const normalizeFrame = (frame) => normalize(frame, { edge: key === "widgetPicker" ? 4 : 8 });

  const defaultFrame = () => {
    if (key === "settings") return { x: window.innerWidth - 786, y: 16, w: 370, h: Math.min(680, window.innerHeight - 32) };
    if (key === "widgetPicker") {
      const edge = 4;
      const w = Math.max(MIN_SIZE.w, window.innerWidth - edge * 2);
      const h = Math.min(620, Math.max(MIN_SIZE.h, window.innerHeight - edge * 2));
      return { x: edge, y: edge, w, h, layoutMode: "viewport" };
    }
    return { x: window.innerWidth - 386, y: 16, w: 370, h: Math.min(680, window.innerHeight - 32) };
  };
  const getFrame = () => {
    const stored = store.getState().settings.panels?.[key];
    const isLegacyPickerFrame = key === "widgetPicker" && stored && stored.layoutMode !== "viewport";
    return normalizeFrame(isLegacyPickerFrame ? defaultFrame() : (stored || defaultFrame()));
  };
  const syncResizeHandle = () => {
    const candidate = root.querySelector(".panel-resize-handle");
    if (candidate && candidate !== resizeHandle) {
      resizeHandle?.remove();
      resizeHandle = candidate;
      resizeHandle.classList.add("panel-resize-handle-fixed");
      resizeHandle.addEventListener("pointerdown", onResizeHandlePointerDown);
      document.body.append(resizeHandle);
    }
    if (!resizeHandle) return;
    const rect = root.getBoundingClientRect();
    const scrollbarWidth = Math.max(0, root.offsetWidth - root.clientWidth);
    const scrollbarHeight = Math.max(0, root.offsetHeight - root.clientHeight);
    resizeHandle.style.left = `${Math.round(rect.right - scrollbarWidth - 20)}px`;
    resizeHandle.style.top = `${Math.round(rect.bottom - scrollbarHeight - 20)}px`;
  };
  const apply = (frame = getFrame()) => {
    root.style.left = `${frame.x}px`;
    root.style.top = `${frame.y}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.style.transform = "none";
    root.style.width = `${frame.w}px`;
    root.style.height = `${frame.h}px`;
    root.style.maxHeight = "none";
    requestAnimationFrame(syncResizeHandle);
  };
  const save = (frame, reason) => {
    const state = store.getState();
    store.updateSettings({ panels: { ...(state.settings.panels || {}), [key]: frame } }, reason);
  };

  const begin = (event, mode) => {
    if (event.button !== undefined && event.button !== 0) return;
    const start = getFrame();
    active = { mode, pointerId: event.pointerId, start, origin: { x: event.clientX, y: event.clientY }, preview: start };
    root.setPointerCapture?.(event.pointerId);
    root.classList.add("is-panel-interacting");
    document.documentElement.classList.add("is-pointer-interacting");
    event.preventDefault();
  };
  const onResizeHandlePointerDown = (event) => { begin(event, "resize"); };
  const onPointerDown = (event) => {
    const resize = event.target.closest("[data-action='resize-panel']");
    if (resize) { begin(event, "resize"); return; }
    const dragRegion = event.target.closest("[data-role='panel-drag']");
    if (!dragRegion || event.target.closest("button, input, select, textarea, a")) return;
    begin(event, "move");
  };
  const onPointerMove = (event) => {
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = { x: event.clientX - active.origin.x, y: event.clientY - active.origin.y };
    const candidate = active.mode === "resize"
      ? { ...active.start, w: active.start.w + delta.x, h: active.start.h + delta.y }
      : { ...active.start, x: active.start.x + delta.x, y: active.start.y + delta.y };
    active.preview = normalizeFrame(candidate);
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => apply(active.preview));
  };
  const finish = (event) => {
    if (!active || active.pointerId !== event.pointerId) return;
    const completed = active;
    active = null;
    cancelAnimationFrame(frameId);
    root.classList.remove("is-panel-interacting");
    document.documentElement.classList.remove("is-pointer-interacting");
    save(completed.preview, completed.mode === "resize" ? "panel-resize" : "panel-move");
  };
  const onResize = () => apply(getFrame());
  const unsubscribe = store.subscribe((state, event) => {
    if (event?.type === "settings" || event?.type === "replace" || event?.type === "batch") {
      if (!active) apply(normalizeFrame(state.settings.panels?.[key] || defaultFrame()));
    }
  });

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("panel-content-rendered", syncResizeHandle);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  window.addEventListener("resize", onResize);
  apply();

  return {
    apply,
    reset() {
      const frame = normalizeFrame(defaultFrame());
      save(frame, "panel-reset");
    },
    destroy() {
      unsubscribe();
      cancelAnimationFrame(frameId);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("panel-content-rendered", syncResizeHandle);
      resizeHandle?.removeEventListener("pointerdown", onResizeHandlePointerDown);
      resizeHandle?.remove();
      window.removeEventListener("pointermove", onPointerMove, { passive: false });   window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("resize", onResize);
    },
  };
}
