const BACKUP_FORMAT = "my-free-layout-tab-backup";
const BACKUP_VERSION = 1;
const LAYOUT_FORMAT = "my-free-layout-tab-layout";
const LAYOUT_VERSION = 1;
const WIDGET_FORMAT = "my-free-layout-tab-widget";
const WIDGET_VERSION = 1;
const THEME_FORMAT = "my-free-layout-tab-theme";
const THEME_VERSION = 1;
const PREFERENCES_FORMAT = "startspace-user-preferences";
const PREFERENCES_VERSION = 1;

function cleanFileName(value) {
  return String(value).replace(/[^0-9A-Za-z_-]/g, "");
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function downloadJson(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function envelope(format, version, payload) {
  return { format, version, createdAt: new Date().toISOString(), ...payload };
}

function downloadEnvelope(payload, fileName) {
  downloadJson(payload, `${fileName}-${cleanFileName(payload.createdAt.slice(0, 10))}.json`);
}

async function readJsonFile(file, { label, maxBytes = 2 * 1024 * 1024 } = {}) {
  if (!file) throw new Error(`Файл ${label || "JSON"} не выбран.`);
  if (file.size > maxBytes) throw new Error(`Файл ${label || "JSON"} слишком большой.`);
  try { return JSON.parse(await file.text()); }
  catch { throw new Error(`Не удалось прочитать JSON-файл ${label || "данных"}.`); }
}

async function parseEnvelope(file, { label, format, version, maxBytes, kind }) {
  const parsed = await readJsonFile(file, { label, ...(maxBytes === undefined ? {} : { maxBytes }) });
  if (parsed?.format !== format || parsed?.version !== version) {
    throw new Error(`Этот файл не является ${kind}.`);
  }
  return parsed;
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function text(value, fallback, maxLength = 120) {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function knownWidgetType(registry, type) {
  return registry.list().some((definition) => definition.type === type);
}

function normalizeImportedWidget(source, registry) {
  if (!isPlainObject(source) || !knownWidgetType(registry, source.type)) {
    throw new Error("В файле указан неизвестный тип виджета.");
  }
  const base = registry.createWidget(source.type);
  const sourceSize = isPlainObject(source.size) ? source.size : {};
  const sourcePosition = isPlainObject(source.position) ? source.position : {};
  const sourceStyle = isPlainObject(source.style) ? source.style : {};
  return {
    ...base,
    title: text(source.title, base.title, 72),
    position: {
      x: numberInRange(sourcePosition.x, base.position.x, 0, 5000),
      y: numberInRange(sourcePosition.y, base.position.y, 0, 5000),
    },
    size: {
      w: numberInRange(sourceSize.w, base.size.w, 140, 1600),
      h: numberInRange(sourceSize.h, base.size.h, 100, 1200),
    },
    collapsed: Boolean(source.collapsed),
    style: { ...base.style, ...clone(sourceStyle) },
    config: isPlainObject(source.config) ? clone(source.config) : base.config,
  };
}

export function createBackupPayload(state) {
  return envelope(BACKUP_FORMAT, BACKUP_VERSION, { state });
}

export function downloadBackup(state) {
  downloadEnvelope(createBackupPayload(state), "startspace-backup");
}

export function createLayoutPayload(state) {
  return envelope(LAYOUT_FORMAT, LAYOUT_VERSION, { layout: clone(state) });
}

export function downloadLayout(state) {
  downloadEnvelope(createLayoutPayload(state), "startspace-layout");
}

export async function readBackupFile(file) {
  const parsed = await parseEnvelope(file, { label: "резервной копии", format: BACKUP_FORMAT, version: BACKUP_VERSION, maxBytes: 8 * 1024 * 1024, kind: "резервной копией Startspace V5" });
  if (!parsed?.state) {
    throw new Error("Этот файл не является резервной копией Startspace V5.");
  }
  if (!Array.isArray(parsed.state.widgets) || !parsed.state.settings) {
    throw new Error("В резервной копии нет состояния виджетов и настроек.");
  }
  return parsed.state;
}

export async function readLayoutFile(file) {
  const parsed = await readJsonFile(file, { label: "макета", maxBytes: 8 * 1024 * 1024 });
  const isLayout = parsed?.format === LAYOUT_FORMAT && parsed?.version === LAYOUT_VERSION && parsed?.layout;
  const isLegacyBackup = parsed?.format === BACKUP_FORMAT && parsed?.version === BACKUP_VERSION && parsed?.state;
  const layout = isLayout ? parsed.layout : isLegacyBackup ? parsed.state : null;
  if (!layout || !Array.isArray(layout.widgets) || !layout.settings) {
    throw new Error("Этот файл не является макетом Startspace V5.");
  }
  return clone(layout);
}

export function createWidgetPayload(widget) {
  return envelope(WIDGET_FORMAT, WIDGET_VERSION, { widget: clone(widget) });
}

export function exportWidget(widget) {
  if (!widget?.type) throw new Error("Невозможно экспортировать пустой виджет.");
  downloadEnvelope(createWidgetPayload(widget), `my-free-layout-tab-widget-${cleanFileName(widget.type)}`);
}

export async function readWidgetFile(file, registry) {
  const parsed = await parseEnvelope(file, { label: "виджета", format: WIDGET_FORMAT, version: WIDGET_VERSION, kind: "экспортом виджета Startspace V5" });
  if (!parsed?.widget) {
    throw new Error("Этот файл не является экспортом виджета Startspace V5.");
  }
  return normalizeImportedWidget(parsed.widget, registry);
}

export async function importWidget(file, store, registry) {
  const widget = await readWidgetFile(file, registry);
  store.addWidget(widget, "widget-import");
  return widget;
}

export function createThemePackPayload(settings) {
  return envelope(THEME_FORMAT, THEME_VERSION, {
    theme: {
      themeId: text(settings?.themeId, "midnight", 48),
      customTheme: isPlainObject(settings?.customTheme) ? clone(settings.customTheme) : {},
      wallpaper: isPlainObject(settings?.wallpaper) ? clone(settings.wallpaper) : {},
    },
  });
}

export function exportThemePack(settings) {
  const payload = createThemePackPayload(settings);
  downloadEnvelope(payload, `my-free-layout-tab-theme-${cleanFileName(payload.theme.themeId)}`);
}

export async function readThemePackFile(file) {
  const parsed = await parseEnvelope(file, { label: "набора темы", format: THEME_FORMAT, version: THEME_VERSION, maxBytes: 14 * 1024 * 1024, kind: "набором темы Startspace V5" });
  if (!isPlainObject(parsed.theme)) {
    throw new Error("Этот файл не является набором темы Startspace V5.");
  }
  const theme = parsed.theme;
  return {
    themeId: text(theme.themeId, "midnight", 48),
    customTheme: isPlainObject(theme.customTheme) ? clone(theme.customTheme) : {},
    wallpaper: isPlainObject(theme.wallpaper) ? clone(theme.wallpaper) : {},
  };
}

export async function importThemePack(file, store) {
  const theme = await readThemePackFile(file);
  store.updateSettings(theme, "theme-import");
  return theme;
}

function normalizePreferenceWidget(source) {
  if (!isPlainObject(source) || !text(source.type, "", 64)) return null;
  return {
    type: text(source.type, "", 64),
    title: text(source.title, "", 72),
    style: isPlainObject(source.style) ? clone(source.style) : {},
    config: isPlainObject(source.config) ? clone(source.config) : {},
  };
}

function normalizeUserPreferences(source) {
  const payload = isPlainObject(source) ? source : {};
  const theme = isPlainObject(payload.theme) ? payload.theme : {};
  return {
    theme: {
      themeId: text(theme.themeId, "midnight", 48),
      customTheme: isPlainObject(theme.customTheme) ? clone(theme.customTheme) : {},
      wallpaper: isPlainObject(theme.wallpaper) ? clone(theme.wallpaper) : {},
    },
    widgets: Array.isArray(payload.widgets)
      ? payload.widgets.map(normalizePreferenceWidget).filter(Boolean).slice(0, 96)
      : [],
  };
}

/** Saves colors, wallpaper and per-widget custom settings without positions, sizes or workspaces. */
export function createUserPreferencesPayload(state) {
  const settings = state?.settings || {};
  return envelope(PREFERENCES_FORMAT, PREFERENCES_VERSION, {
    preferences: normalizeUserPreferences({
      theme: {
        themeId: settings.themeId,
        customTheme: settings.customTheme,
        wallpaper: settings.wallpaper,
      },
      widgets: Array.isArray(state?.widgets) ? state.widgets.map((widget) => ({
        type: widget?.type,
        title: widget?.title,
        style: widget?.style,
        config: widget?.config,
      })) : [],
    }),
  });
}

export function exportUserPreferences(state) {
  downloadEnvelope(createUserPreferencesPayload(state), "startspace-preferences");
}

export async function readUserPreferencesFile(file) {
  const parsed = await parseEnvelope(file, { label: "пользовательских настроек", format: PREFERENCES_FORMAT, version: PREFERENCES_VERSION, maxBytes: 14 * 1024 * 1024, kind: "пакетом пользовательских настроек Startspace" });
  if (!isPlainObject(parsed.preferences)) {
    throw new Error("Этот файл не является пакетом пользовательских настроек Startspace.");
  }
  return normalizeUserPreferences(parsed.preferences);
}

/**
 * Applies settings to matching widget types in their saved order.
 * Positions, sizes, collapsed state, workspace layout and unrelated current widgets stay intact.
 */
export async function importUserPreferences(file, store) {
  const preferences = await readUserPreferencesFile(file);
  const state = store.getState();
  const preferencesByType = new Map();
  preferences.widgets.forEach((widget) => {
    const list = preferencesByType.get(widget.type) || [];
    list.push(widget);
    preferencesByType.set(widget.type, list);
  });
  const usedByType = new Map();
  let appliedWidgets = 0;
  const widgets = state.widgets.map((widget) => {
    const list = preferencesByType.get(widget.type) || [];
    const index = usedByType.get(widget.type) || 0;
    const imported = list[index];
    usedByType.set(widget.type, index + 1);
    if (!imported) return widget;
    appliedWidgets += 1;
    return {
      ...widget,
      title: imported.title || widget.title,
      style: { ...(widget.style || {}), ...imported.style },
      config: { ...(widget.config || {}), ...imported.config },
    };
  });
  store.replaceState({
    ...state,
    settings: { ...state.settings, ...preferences.theme },
    widgets,
  }, "user-preferences-import");
  return { themeId: preferences.theme.themeId, appliedWidgets };
}

const WEB_PANEL_FORMAT = "my-free-layout-tab-web-panel";
const WEB_PANEL_VERSION = 1;
const WEB_PANEL_WIDGETS = new Set(["clock", "tasks", "note", "timer", "stopwatch", "media", "weather", "translator", "rest"]);
const WEB_PANEL_DEFAULT_HEIGHTS = Object.freeze({ clock: 136, tasks: 220, note: 230, timer: 160, stopwatch: 180, media: 260, weather: 190, translator: 285, rest: 185 });

function normalizeWebPanelData(value) {
  const source = isPlainObject(value) ? value : {};
  const widgets = Array.isArray(source.widgets)
    ? source.widgets.filter((type, index, list) => WEB_PANEL_WIDGETS.has(type) && list.indexOf(type) === index)
    : ["clock", "tasks", "note", "timer", "stopwatch", "media", "weather", "translator", "rest"];
  const sourceHeights = isPlainObject(source.heights) ? source.heights : {};
  const heights = Object.fromEntries([...WEB_PANEL_WIDGETS].map((type) => [type, numberInRange(sourceHeights[type], WEB_PANEL_DEFAULT_HEIGHTS[type], 110, 680)]));
  const sourceTimer = isPlainObject(source.timer) ? source.timer : {};
  return {
    catalogVersion: 5,
    widgets,
    heights,
    note: text(source.note, "", 8000),
    tasks: Array.isArray(source.tasks)
      ? source.tasks.filter((task) => isPlainObject(task) && typeof task.text === "string").slice(0, 80).map((task) => ({ id: text(task.id, crypto.randomUUID?.() || String(Date.now()), 96), text: text(task.text, "", 180), done: Boolean(task.done) }))
      : [],
    timer: {
      remaining: numberInRange(sourceTimer.remaining, 1500, 0, 24 * 60 * 60),
      running: Boolean(sourceTimer.running),
      endsAt: numberInRange(sourceTimer.endsAt, 0, 0, Number.MAX_SAFE_INTEGER),
    },
    stopwatch: {
      elapsed: numberInRange(source.stopwatch?.elapsed, 0, 0, 7 * 24 * 60 * 60),
      running: Boolean(source.stopwatch?.running),
      startedAt: numberInRange(source.stopwatch?.startedAt, 0, 0, Number.MAX_SAFE_INTEGER),
      laps: Array.isArray(source.stopwatch?.laps) ? source.stopwatch.laps.slice(0, 8).map((value) => numberInRange(value, 0, 0, 7 * 24 * 60 * 60)) : [],
    },
    weather: {
      city: text(source.weather?.city, "Москва", 80), location: text(source.weather?.location, "", 120),
      temperature: Number.isFinite(Number(source.weather?.temperature)) ? Number(source.weather.temperature) : null,
      apparent: Number.isFinite(Number(source.weather?.apparent)) ? Number(source.weather.apparent) : null,
      wind: Number.isFinite(Number(source.weather?.wind)) ? Number(source.weather.wind) : null,
      code: Number.isFinite(Number(source.weather?.code)) ? Number(source.weather.code) : null,
      updatedAt: numberInRange(source.weather?.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    },
    translator: {
      text: text(source.translator?.text, "", 1000), translated: text(source.translator?.translated, "", 3000),
      from: ["ru", "en", "de", "fr", "es"].includes(source.translator?.from) ? source.translator.from : "ru",
      to: ["ru", "en", "de", "fr", "es"].includes(source.translator?.to) ? source.translator.to : "en",
      error: text(source.translator?.error, "", 260), match: Number.isFinite(Number(source.translator?.match)) ? Math.max(0, Math.min(1, Number(source.translator.match))) : null,
      pending: false,
    },
    rest: { sound: ["rain", "downpour", "thunder", "sea", "forest", "fire", "wind"].includes(source.rest?.sound) ? source.rest.sound : "rain", volume: numberInRange(source.rest?.volume, 45, 0, 100) },
  };
}

function normalizeWebPanelSettings(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    enabled: source.enabled !== false,
    hidden: Boolean(source.hidden),
    edge: source.edge === "left" ? "left" : "right",
    width: numberInRange(source.width, 340, 280, 420),
    scale: numberInRange(source.scale, 100, 80, 130),
    fontScale: numberInRange(source.fontScale, 100, 80, 160),
    triggerSize: numberInRange(source.triggerSize, 12, 8, 24),
    transparency: numberInRange(source.transparency, 0, 0, 65),
    panelMaterial: ["opaque", "transparent", "blur", "acrylic"].includes(source.panelMaterial) ? source.panelMaterial : (Number(source.transparency) > 0 ? "transparent" : "opaque"),
    weatherCity: text(source.weatherCity, "Москва", 80),
  };
}

export function createWebPanelPayload({ settings, data } = {}) {
  return envelope(WEB_PANEL_FORMAT, WEB_PANEL_VERSION, {
    panel: {
      settings: normalizeWebPanelSettings(settings?.webPanel),
      data: normalizeWebPanelData(data),
      theme: {
        themeId: text(settings?.themeId, "midnight", 48),
        customTheme: isPlainObject(settings?.customTheme) ? clone(settings.customTheme) : {},
      },
    },
  });
}

export function downloadWebPanel(payloadInput) {
  downloadEnvelope(createWebPanelPayload(payloadInput), "startspace-web-panel");
}

export async function readWebPanelFile(file) {
  const parsed = await parseEnvelope(file, { label: "панели сайтов", format: WEB_PANEL_FORMAT, version: WEB_PANEL_VERSION, maxBytes: 2 * 1024 * 1024, kind: "экспортом панели сайтов Startspace" });
  if (!isPlainObject(parsed.panel)) {
    throw new Error("Этот файл не является экспортом панели сайтов Startspace.");
  }
  return {
    settings: normalizeWebPanelSettings(parsed.panel.settings),
    data: normalizeWebPanelData(parsed.panel.data),
    theme: {
      themeId: text(parsed.panel.theme?.themeId, "midnight", 48),
      customTheme: isPlainObject(parsed.panel.theme?.customTheme) ? clone(parsed.panel.theme.customTheme) : {},
    },
  };
}
