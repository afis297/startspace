import { createInitialState } from "./store.js";

import { callExtensionApi, getExtensionApi } from "../services/extension-api.js";

const STORAGE_KEY = "layoutStateV5";
const LEGACY_KEYS = ["widgets", "settings", "topZIndex", "currencyRates", "currencyCache", "currencyCacheTime"];

const clone = (value) => typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

const memoryStorage = new Map();
const platformStorage = {
  async get(defaults) {
    const storage = getExtensionApi()?.storage?.local;
    if (storage) return callExtensionApi(storage.get, storage, [defaults]);
    const output = { ...defaults };
    Object.keys(defaults).forEach((key) => {
      const saved = localStorage.getItem(`mflt:${key}`);
      if (!saved) return;
      try { output[key] = JSON.parse(saved); } catch { localStorage.removeItem(`mflt:${key}`); }
    });
    return output;
  },
  async set(values) {
    const storage = getExtensionApi()?.storage?.local;
    if (storage) return callExtensionApi(storage.set, storage, [values]);
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(`mflt:${key}`, JSON.stringify(value)));
  },
};

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safePosition(widget) {
  const position = widget.position || widget.pos || {};
  return {
    x: finiteNumber(position.x ?? position.left ?? widget.x, 48),
    y: finiteNumber(position.y ?? position.top ?? widget.y, 48),
  };
}

function safeSize(widget) {
  const size = widget.size || {};
  const width = finiteNumber(size.w ?? size.width ?? widget.width, 280);
  const height = finiteNumber(size.h ?? size.height ?? widget.height, 180);
  return { w: width > 0 ? width : 280, h: height > 0 ? height : 180 };
}

function normalizeLegacyWidget(widget, index) {
  const rawConfig = widget.config || widget.content || {};
  const config = typeof rawConfig === "string" ? { content: rawConfig } : clone(rawConfig);
  const typeAliases = { game2048: "game", links: "link", tasks: "todo", clocks: "clock" };
  const sourceStyle = widget.style || {};
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const modes = new Set(["solid", "soft", "glass", "acrylic", "clear", "custom"]);
  return {
    id: String(widget.id || crypto.randomUUID()),
    type: typeAliases[widget.type] || widget.type || "note",
    title: String(widget.title || ""),
    position: safePosition(widget),
    size: safeSize(widget),
    zIndex: Number(widget.zIndex ?? 100 + index) || 100 + index,
    collapsed: Boolean(widget.collapsed),
    pinned: Boolean(widget.pinned),
    style: {
      surfaceMode: modes.has(sourceStyle.surfaceMode) ? sourceStyle.surfaceMode : "solid",
      opacity: number(sourceStyle.opacity ?? widget.opacity, 1),
      accent: sourceStyle.accent || widget.borderColor || "#d9b45f",
      useThemeAccent: sourceStyle.useThemeAccent !== false,
      background: sourceStyle.background || widget.bgColor || "",
      color: sourceStyle.color || widget.textColor || "",
      borderColor: sourceStyle.borderColor || "",
      borderWidth: number(sourceStyle.borderWidth, 1),
      shadow: number(sourceStyle.shadow, 34),
      blur: number(sourceStyle.blur, 0),
      padding: number(sourceStyle.padding, 13),
      fontScale: number(sourceStyle.fontScale ?? widget.scale, 1),
      interfaceScale: number(sourceStyle.interfaceScale, 1),
      autoScale: sourceStyle.autoScale !== false,
      compactLayout: Boolean(sourceStyle.compactLayout),
      fontWeight: String(sourceStyle.fontWeight ?? 400),
      contentAlign: sourceStyle.contentAlign || "left",
      headerOpacity: number(sourceStyle.headerOpacity, .64),
      headerColor: sourceStyle.headerColor || "",
      headerTextColor: sourceStyle.headerTextColor || "",
    },
    config,
  };
}

export function migrateLegacyState(legacy) {
  const initial = createInitialState();
  const widgets = Array.isArray(legacy.widgets)
    ? legacy.widgets.map(normalizeLegacyWidget).filter((widget) => !["daily-calendar", "today-tasks"].includes(widget.type))
    : [];
  const oldSettings = legacy.settings || {};
  return {
    ...initial,
    widgets,
    settings: {
      ...initial.settings,
      themeId: oldSettings.themeId || "midnight",
      wallpaper: {
        mode: oldSettings.wallpaper ? "image" : "gradient",
        value: oldSettings.wallpaper || "",
        position: `${oldSettings.wallpaperPosX ?? 0}% ${oldSettings.wallpaperPosY ?? 0}%`,
        size: oldSettings.wallpaperMode || "cover",
      },
      dock: {
        position: oldSettings.dockPosition || "bottom",
        autoHide: Boolean(oldSettings.dockAutoHide),
        compact: false,
        hidden: false,
        autoReveal: false,
      },
      onboarding: { completed: true },
      behavior: {
        snapToGrid: oldSettings.snapToEdges !== false,
        gridSize: 12,
        lockWidgets: Boolean(oldSettings.lockWidgets),
        reduceMotion: oldSettings.smoothAnimations === false,
        animationSpeed: ["off", "fast", "normal", "slow"].includes(oldSettings.animationSpeed) ? oldSettings.animationSpeed : "normal",
        parallaxEasing: ["soft", "balanced", "sharp", "custom"].includes(oldSettings.parallaxEasing) ? oldSettings.parallaxEasing : "soft",
        parallaxBezier: typeof oldSettings.parallaxBezier === "string" ? oldSettings.parallaxBezier : "cubic-bezier(0.16, 1, 0.3, 1)",
        roundedCorners: oldSettings.roundedCorners !== false,
        cornerRadius: Number.isFinite(Number(oldSettings.cornerRadius)) ? Math.min(24, Math.max(0, Number(oldSettings.cornerRadius))) : 8,
        autoAdjustMosaic: oldSettings.autoAdjustMosaic !== false,
        presentationMode: Boolean(oldSettings.presentationMode),
      },
      customTheme: {},
    },
    ui: { nextZIndex: Number(legacy.topZIndex) || Math.max(100, ...widgets.map((widget) => widget.zIndex)) },
  };
}

function normalizeV5(input) {
  const initial = createInitialState();
  const sourceSettings = input?.settings || {};
  const hasOnboardingState = sourceSettings.onboarding && typeof sourceSettings.onboarding === "object";
  return {
    ...initial,
    ...clone(input || {}),
    schemaVersion: 5,
    settings: {
      ...initial.settings,
      ...sourceSettings,
      // Макеты, существовавшие до знакомства, считаем уже освоенными.
      onboarding: hasOnboardingState ? { ...initial.settings.onboarding, ...sourceSettings.onboarding } : { completed: true },
    },
    ui: { ...initial.ui, ...(input?.ui || {}) },
    widgets: Array.isArray(input?.widgets)
      ? input.widgets.map(normalizeLegacyWidget).filter((widget) => !["daily-calendar", "today-tasks"].includes(widget.type))
      : [],
  };
}

export async function loadLayoutState() {
  const data = await platformStorage.get({ [STORAGE_KEY]: null, ...Object.fromEntries(LEGACY_KEYS.map((key) => [key, null])) });
  if (data[STORAGE_KEY]) return { state: normalizeV5(data[STORAGE_KEY]), migrated: false };
  const hasLegacyData = Array.isArray(data.widgets) || data.settings || data.topZIndex;
  if (hasLegacyData) return { state: migrateLegacyState(data), migrated: true };
  return { state: createInitialState(), migrated: false };
}

export function createPersistence(store, { delay = 450 } = {}) {
  let timer = null;
  let destroyed = false;
  let writeChain = Promise.resolve();
  let pendingSnapshot = null;

  const saveNow = () => {
    if (destroyed) return Promise.resolve();
    const snapshot = pendingSnapshot || store.getState();
    pendingSnapshot = null;
    writeChain = writeChain
      .catch(() => undefined)
      .then(() => platformStorage.set({ [STORAGE_KEY]: snapshot }));
    return writeChain;
  };

  const scheduleSave = (snapshot = null) => {
    pendingSnapshot = snapshot || store.getState();
    clearTimeout(timer);
    timer = setTimeout(saveNow, delay);
  };

  const unsubscribe = store.subscribe((snapshot, event) => {
    if (event?.type === "widget-focus") return;
    // The website panel controls must survive a page refresh immediately after
    // the user releases a range slider, rather than waiting for the global debounce.
    if (event?.reason === "web-panel-settings") {
      pendingSnapshot = snapshot;
      clearTimeout(timer);
      saveNow();
      return;
    }
    scheduleSave(snapshot);
  });

  return {
    scheduleSave,
    saveNow,
    async flush() {
      clearTimeout(timer);
      await saveNow();
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      unsubscribe();
    },
  };
}
