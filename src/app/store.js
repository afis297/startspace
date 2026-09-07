const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export const DEFAULT_SETTINGS = Object.freeze({
  themeId: "midnight",
  customTheme: {},
  wallpaper: { mode: "gradient", value: "", position: "center", size: "cover" },
  dock: { position: "bottom", autoHide: false, compact: false, hidden: false, autoReveal: false },
  behavior: { snapToGrid: true, gridSize: 12, lockWidgets: false, reduceMotion: false, animationSpeed: "normal", parallaxEasing: "soft", parallaxBezier: "cubic-bezier(0.16, 1, 0.3, 1)", roundedCorners: true, cornerRadius: 8, autoAdjustMosaic: true, presentationMode: false },
  webPanel: { enabled: true, hidden: false, edge: "right", width: 340, scale: 100, fontScale: 100, triggerSize: 12, transparency: 0, panelMaterial: "opaque" },
  search: { defaultEngine: "google", openInNewTab: true },
  onboarding: { completed: false },
  locale: "ru-RU",
});

export const createInitialState = () => ({
  schemaVersion: 5,
  widgets: [],
  settings: clone(DEFAULT_SETTINGS),
  ui: { nextZIndex: 100 },
});

function mergeObjects(base, patch) {
  const output = { ...base };
  Object.entries(patch || {}).forEach(([key, value]) => {
    output[key] = isObject(value) && isObject(base?.[key])
      ? mergeObjects(base[key], value)
      : clone(value);
  });
  return output;
}

function normalizeState(input) {
  const initial = createInitialState();
  const state = input || initial;
  const settings = mergeObjects(initial.settings, state.settings || {});
  const animationSpeed = String(settings.behavior?.animationSpeed || "normal");
  settings.behavior.animationSpeed = ["off", "fast", "normal", "slow"].includes(animationSpeed) ? animationSpeed : "normal";
  const parallaxEasing = String(settings.behavior?.parallaxEasing || "soft");
  settings.behavior.parallaxEasing = ["soft", "balanced", "sharp", "custom"].includes(parallaxEasing) ? parallaxEasing : "soft";
  const parallaxBezier = String(settings.behavior?.parallaxBezier || "").trim();
  settings.behavior.parallaxBezier = /^cubic-bezier\(\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*,\s*-?(?:\d+|\d*\.\d+)\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*,\s*-?(?:\d+|\d*\.\d+)\s*\)$/i.test(parallaxBezier)
    ? parallaxBezier
    : "cubic-bezier(0.16, 1, 0.3, 1)";
  const sourcePanel = isObject(state.settings?.webPanel) ? state.settings.webPanel : {};
  if (!["opaque", "transparent", "blur", "acrylic"].includes(sourcePanel.panelMaterial)) {
    settings.webPanel.panelMaterial = Number(sourcePanel.transparency) > 0 ? "transparent" : "opaque";
  }
  settings.webPanel.transparency = Math.round(Math.max(0, Math.min(65, Number(settings.webPanel.transparency) || 0)));

  return {
    schemaVersion: 5,
    widgets: Array.isArray(state.widgets)
      ? clone(state.widgets).map((widget) => ({ ...widget, pinned: Boolean(widget?.pinned) }))
      : [],
    settings,
    ui: mergeObjects(initial.ui, state.ui || {}),
  };
}

export function createStore(initialState = createInitialState()) {
  let state = normalizeState(initialState);
  const subscribers = new Set();
  let batchDepth = 0;
  let pendingEvent = null;

  const emit = (event) => {
    if (batchDepth > 0) {
      pendingEvent = pendingEvent || { type: "batch", changes: [] };
      pendingEvent.changes.push(event);
      return;
    }
    const snapshot = clone(state);
    subscribers.forEach((listener) => listener(snapshot, event));
  };

  const commit = (nextState, event) => {
    state = normalizeState(nextState);
    emit(event);
    return clone(state);
  };

  const api = {
    getState: () => clone(state),
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    replaceState(nextState, reason = "replace") {
      return commit(nextState, { type: "replace", reason });
    },
    batch(callback, reason = "batch") {
      batchDepth += 1;
      try {
        return callback(api);
      } finally {
        batchDepth -= 1;
        if (batchDepth === 0 && pendingEvent) {
          const event = { ...pendingEvent, reason };
          pendingEvent = null;
          const snapshot = clone(state);
          subscribers.forEach((listener) => listener(snapshot, event));
        }
      }
    },
    updateSettings(patch, reason = "settings") {
      return commit(
        { ...state, settings: mergeObjects(state.settings, patch) },
        { type: "settings", patch: clone(patch), reason },
      );
    },
    updateWidget(id, patch, reason = "widget") {
      const index = state.widgets.findIndex((widget) => widget.id === id);
      if (index < 0) return null;
      const previous = state.widgets[index];
      const nextWidget = mergeObjects(previous, patch);
      const widgets = [...state.widgets];
      widgets[index] = nextWidget;
      commit({ ...state, widgets }, { type: "widget", id, patch: clone(patch), reason });
      return clone(nextWidget);
    },
    addWidget(widget, reason = "widget-add") {
      if (!widget?.id || state.widgets.some((item) => item.id === widget.id)) {
        throw new Error("Невозможно добавить виджет без уникального идентификатора.");
      }
      const zIndex = Math.max(state.ui.nextZIndex + 1, Number(widget.zIndex) || 0);
      const next = { ...clone(widget), zIndex };
      commit(
        { ...state, widgets: [...state.widgets, next], ui: { ...state.ui, nextZIndex: zIndex } },
        { type: "widget-add", id: next.id, reason },
      );
      return clone(next);
    },
    removeWidget(id, reason = "widget-remove") {
      if (!state.widgets.some((widget) => widget.id === id)) return false;
      commit(
        { ...state, widgets: state.widgets.filter((widget) => widget.id !== id) },
        { type: "widget-remove", id, reason },
      );
      return true;
    },
    bringToFront(id, reason = "widget-focus") {
      const widget = state.widgets.find((item) => item.id === id);
      if (!widget) return null;
      const zIndex = state.ui.nextZIndex + 1;
      const widgets = state.widgets.map((item) => item.id === id ? { ...item, zIndex } : item);
      commit(
        { ...state, widgets, ui: { ...state.ui, nextZIndex: zIndex } },
        { type: "widget-focus", id, reason },
      );
      return clone(widgets.find((item) => item.id === id));
    },
  };

  return Object.freeze(api);
}
