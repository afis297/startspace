(() => {
  "use strict";

  const PANEL_BUILD = "2026.08.19.32";
  if (window.top !== window) return;
  const documentRoot = document.documentElement;
  if (documentRoot.dataset.mfltWebPanelBuild === PANEL_BUILD) return;
  // A new script injection must replace an older panel left in an already-open tab.
  document.getElementById("mflt-web-panel-host")?.remove();
  documentRoot.dataset.mfltWebPanelBuild = PANEL_BUILD;
  const api = globalThis.chrome || globalThis.browser;
  const storage = api?.storage?.local;
  if (!storage) return;

  const LAYOUT_KEY = "layoutStateV5";
  const DATA_KEY = "mfltWebPanelDataV1";
  const CONTENT_DIAGNOSTICS_KEY = "mfltWebPanelContentDiagnosticsV1";
  const SHARED_THEME_KEY = "mfltWebPanelThemeV1";
  const DEFAULT_PANEL = Object.freeze({ enabled: true, hidden: false, edge: "right", width: 340, scale: 100, fontScale: 100, triggerSize: 12, transparency: 0, panelMaterial: "opaque", widgets: null, weatherCity: "Москва" });
  const DEFAULT_DATA = Object.freeze({
    catalogVersion: 5,
    widgets: ["clock", "tasks", "note", "timer", "stopwatch", "media", "weather", "translator", "rest"],
    heights: { clock: 136, tasks: 220, note: 230, timer: 160, stopwatch: 180, media: 260, weather: 190, translator: 285, rest: 185 },
    note: "",
    tasks: [],
    timer: { remaining: 1500, running: false, endsAt: 0 },
    stopwatch: { elapsed: 0, running: false, startedAt: 0, laps: [] },
    weather: { city: "Москва", location: "", temperature: null, apparent: null, wind: null, code: null, updatedAt: 0 },
    translator: { text: "", translated: "", from: "ru", to: "en", error: "", match: null, pending: false },
    rest: { sound: "rain", volume: 45 },
  });
  const WIDGET_LABELS = Object.freeze({ clock: "Часы", tasks: "Задачи", note: "Заметка", timer: "Таймер", stopwatch: "Секундомер", media: "Управление воспроизведением", weather: "Погода", translator: "Переводчик", rest: "Отдых" });
  const DEFAULT_CARD_HEIGHTS = Object.freeze({ clock: 136, tasks: 220, note: 230, timer: 160, stopwatch: 180, media: 260, weather: 190, translator: 285, rest: 185 });
  const PALETTES = Object.freeze({
    midnight: { bg: "#121b2e", strong: "#090d16", hover: "#1a2740", text: "#d9e5ff", muted: "#9ab1da", line: "#2d8cff", accent: "#2d8cff", contrast: "#071018", shadow: "rgba(0,0,0,.58)" },
    paper: { bg: "#faf5ec", strong: "#f6f1e8", hover: "#e7ded0", text: "#292720", muted: "#68645b", line: "#8a5a43", accent: "#8a5a43", contrast: "#ffffff", shadow: "rgba(65,53,37,.24)" },
    forest: { bg: "#203126", strong: "#111b14", hover: "#2c4030", text: "#eff3ea", muted: "#aab7a6", line: "#a9c86b", accent: "#a9c86b", contrast: "#17210f", shadow: "rgba(5,13,8,.54)" },
    ocean: { bg: "#1d3c45", strong: "#0d1d25", hover: "#274e57", text: "#edf7f5", muted: "#b0c6c5", line: "#72d0c1", accent: "#72d0c1", contrast: "#092724", shadow: "rgba(3,13,17,.55)" },
    violet: { bg: "#35263e", strong: "#201927", hover: "#46324f", text: "#f4eff4", muted: "#c6b8c6", line: "#d7a8d6", accent: "#d7a8d6", contrast: "#2a1d30", shadow: "rgba(12,6,16,.56)" },
    ember: { bg: "#3c2820", strong: "#211612", hover: "#503429", text: "#f8eee6", muted: "#ceb7a6", line: "#e0a167", accent: "#e0a167", contrast: "#301d0d", shadow: "rgba(22,9,5,.56)" },
    "green-console": { bg: "#000000", strong: "#000000", hover: "#001906", text: "#70ff92", muted: "#00b92f", line: "#008f24", accent: "#00ff41", contrast: "#000000", shadow: "rgba(0,0,0,.86)" },
    "color-blue": { bg: "#000000", strong: "#000000", hover: "#090909", text: "#d8eaff", muted: "#9aa1aa", line: "#2d8cff", accent: "#2d8cff", contrast: "#071018", shadow: "rgba(0,0,0,.86)" },
    "color-cyan": { bg: "#000000", strong: "#000000", hover: "#090909", text: "#d4f8ff", muted: "#9aa1aa", line: "#00d9ff", accent: "#00d9ff", contrast: "#071018", shadow: "rgba(0,0,0,.86)" },
    "color-orange": { bg: "#000000", strong: "#000000", hover: "#090909", text: "#ffe0c7", muted: "#9aa1aa", line: "#ff862f", accent: "#ff862f", contrast: "#071018", shadow: "rgba(0,0,0,.86)" },
    "color-violet": { bg: "#000000", strong: "#000000", hover: "#090909", text: "#f0dcff", muted: "#9aa1aa", line: "#a34dff", accent: "#a34dff", contrast: "#000000", shadow: "rgba(0,0,0,.86)" },
    "color-red": { bg: "#000000", strong: "#000000", hover: "#090909", text: "#ffd8df", muted: "#9aa1aa", line: "#ff3b5b", accent: "#ff3b5b", contrast: "#071018", shadow: "rgba(0,0,0,.86)" },
    "color-yellow": { bg: "#000000", strong: "#000000", hover: "#090909", text: "#fff3b5", muted: "#9aa1aa", line: "#f5d542", accent: "#f5d542", contrast: "#071018", shadow: "rgba(0,0,0,.86)" },
    "color-pink": { bg: "#000000", strong: "#000000", hover: "#090909", text: "#ffd8ee", muted: "#9aa1aa", line: "#ff4fa6", accent: "#ff4fa6", contrast: "#071018", shadow: "rgba(0,0,0,.86)" },
  });

  let settings = {};
  let sharedTheme = null;
  let browserZoom = 1;
  let mediaSession = null;
  let restAudio = null;
  let restAudioSound = "";
  let timerAudioContext = null;
  let themeRecoveryAttempts = 0;
  let panelSettings = { ...DEFAULT_PANEL };
  let data = clone(DEFAULT_DATA);
  let closeTimer = 0;
  let draggedWidget = "";
  let isDraggingWidget = false;
  let resizingWidget = "";
  let panelPointerInside = false;
  let dragCloseHoldUntil = 0;
  let catalogOpen = false;
  let noteSaveTimer = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function readStorage(defaults) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value || {});
      };
      try {
        const returned = storage.get(defaults, done);
        if (returned && typeof returned.then === "function") returned.then(done, () => done({}));
      } catch {
        done({});
      }
    });
  }

  function writeStorage(values) {
    try {
      const returned = storage.set(values, () => undefined);
      if (returned && typeof returned.catch === "function") returned.catch(() => undefined);
    } catch {
      // The panel remains usable even if browser storage is temporarily unavailable.
    }
  }

  function contentOrigin() {
    return location.protocol === "file:" ? "локальный файл" : location.origin;
  }

  function recordContentDiagnostic(status, detail) {
    writeStorage({
      [CONTENT_DIAGNOSTICS_KEY]: {
        status,
        detail: String(detail || "").slice(0, 220),
        origin: contentOrigin(),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      const runtime = api?.runtime;
      if (!runtime?.sendMessage) { resolve({ ok: false, snapshot: { found: false, message: "Фоновый модуль расширения недоступен." } }); return; }
      let settled = false;
      const finish = (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(response || { ok: false, snapshot: { found: false, message: "Ответ фонового модуля не получен." } });
      };
      const timeout = window.setTimeout(() => finish({ ok: false, snapshot: { found: false, message: "Фоновый модуль не ответил вовремя." } }), 9000);
      const callback = (response) => {
        const lastError = runtime.lastError;
        if (lastError) { finish({ ok: false, snapshot: { found: false, message: lastError.message || "Не удалось связаться с фоновым модулем." } }); return; }
        // В Vivaldi и части Chromium-сборок Promise может завершиться пустым
        // значением раньше фактического callback. Ждём содержательный ответ.
        if (response !== undefined) finish(response);
      };
      try {
        const result = runtime.sendMessage(message, callback);
        if (result && typeof result.then === "function") {
          result.then((response) => { if (response !== undefined) finish(response); }, (error) => finish({ ok: false, snapshot: { found: false, message: error?.message || "Не удалось связаться с фоновым модулем." } }));
        }
      } catch (error) { finish({ ok: false, snapshot: { found: false, message: error?.message || "Не удалось связаться с фоновым модулем." } }); }
    });
  }

  function sendMediaMessage(message) {
    // В собственной вкладке расширения есть прямой мост к тому же сервису,
    // который использует основной медиавиджет. На обычных сайтах остаётся фоновой порт.
    if (location.protocol === "chrome-extension:" && window.__myFreeLayoutTab) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (response) => { if (!settled) { settled = true; resolve(response); } };
        document.dispatchEvent(new CustomEvent("mflt-web-panel-media-request", { detail: { message, respond: finish } }));
        window.setTimeout(() => finish({ ok: false, snapshot: { found: false, message: "Прямой медиамост не ответил." } }), 8000);
      });
    }
    // На обычных сайтах используем тот же request/response-маршрут, что уже
    // обслуживает фоновый модуль. Это исключает закрытие короткоживущего порта
    // в отдельных Chromium-браузерах и сохраняет одинаковый поиск во всех вкладках.
    return sendRuntimeMessage(message);
  }

  function normalizeWidgetTypes(value, fallback = []) {
    const allowed = Object.keys(WIDGET_LABELS);
    if (!Array.isArray(value)) return clone(fallback);
    return value.filter((type, index, list) => allowed.includes(type) && list.indexOf(type) === index);
  }

  function sameWidgetTypes(left, right) {
    const a = Array.isArray(left) ? left : null;
    const b = Array.isArray(right) ? right : null;
    return a === b || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((type, index) => type === b[index]));
  }

  function visibleWidgetTypes() {
    return Array.isArray(panelSettings.widgets) ? panelSettings.widgets : data.widgets;
  }

  function normalizeData(value) {
    const source = value && typeof value === "object" ? value : {};
    const sourceTimer = source.timer && typeof source.timer === "object" ? source.timer : {};
    const allowed = Object.keys(WIDGET_LABELS);
    const widgets = normalizeWidgetTypes(source.widgets, DEFAULT_DATA.widgets);
    // Existing users receive the new media card once; later manual removal stays respected.
    if (Number(source.catalogVersion || 0) < 2 && !widgets.includes("media")) widgets.push("media");
    if (Number(source.catalogVersion || 0) < 4) ["weather", "rest"].forEach((type) => { if (!widgets.includes(type)) widgets.push(type); });
    if (Number(source.catalogVersion || 0) < 5) ["stopwatch", "translator"].forEach((type) => { if (!widgets.includes(type)) widgets.push(type); });
    const sourceHeights = source.heights && typeof source.heights === "object" ? source.heights : {};
    const heights = Object.fromEntries(allowed.map((type) => [type, Math.round(clamp(sourceHeights[type], 110, 680, DEFAULT_CARD_HEIGHTS[type] || 180))]));
    if (Number(source.catalogVersion || 0) < 3 && Number(sourceHeights.timer) === 190) heights.timer = 160;
    return {
      catalogVersion: 5,
      widgets,
      heights,
      note: typeof source.note === "string" ? source.note.slice(0, 8000) : "",
      tasks: Array.isArray(source.tasks)
        ? source.tasks.filter((task) => task && typeof task.text === "string").slice(0, 80).map((task) => ({ id: String(task.id || makeId()), text: task.text.slice(0, 180), done: Boolean(task.done) }))
        : [],
      timer: {
        remaining: Math.round(clamp(sourceTimer.remaining, 0, 24 * 60 * 60, 1500)),
        running: Boolean(sourceTimer.running),
        endsAt: Math.max(0, Number(sourceTimer.endsAt) || 0),
      },
      stopwatch: {
        elapsed: Math.round(clamp(source.stopwatch?.elapsed, 0, 7 * 24 * 60 * 60, 0)),
        running: Boolean(source.stopwatch?.running),
        startedAt: Math.max(0, Number(source.stopwatch?.startedAt) || 0),
        laps: Array.isArray(source.stopwatch?.laps) ? source.stopwatch.laps.map((value) => Math.round(clamp(value, 0, 7 * 24 * 60 * 60, 0))).slice(0, 8) : [],
      },
      weather: {
        city: typeof source.weather?.city === "string" ? source.weather.city.slice(0, 80) : "Москва",
        location: typeof source.weather?.location === "string" ? source.weather.location.slice(0, 120) : "",
        temperature: Number.isFinite(Number(source.weather?.temperature)) ? Number(source.weather.temperature) : null,
        apparent: Number.isFinite(Number(source.weather?.apparent)) ? Number(source.weather.apparent) : null,
        wind: Number.isFinite(Number(source.weather?.wind)) ? Number(source.weather.wind) : null,
        code: Number.isFinite(Number(source.weather?.code)) ? Number(source.weather.code) : null,
        updatedAt: Math.max(0, Number(source.weather?.updatedAt) || 0),
      },
      translator: {
        text: typeof source.translator?.text === "string" ? source.translator.text.slice(0, 1000) : "",
        translated: typeof source.translator?.translated === "string" ? source.translator.translated.slice(0, 3000) : "",
        from: ["ru", "en", "de", "fr", "es"].includes(source.translator?.from) ? source.translator.from : "ru",
        to: ["ru", "en", "de", "fr", "es"].includes(source.translator?.to) ? source.translator.to : "en",
        error: typeof source.translator?.error === "string" ? source.translator.error.slice(0, 260) : "",
        match: Number.isFinite(Number(source.translator?.match)) ? Math.max(0, Math.min(1, Number(source.translator.match))) : null,
        pending: false,
      },
      rest: { sound: ["rain", "downpour", "thunder", "sea", "forest", "fire", "wind"].includes(source.rest?.sound) ? source.rest.sound : "rain", volume: Math.round(clamp(source.rest?.volume, 0, 100, 45)) },
    };
  }

  function normalizePanel(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      enabled: source.enabled !== false,
      hidden: Boolean(source.hidden),
      edge: source.edge === "left" ? "left" : "right",
      width: Math.round(clamp(source.width, 280, 420, DEFAULT_PANEL.width)),
      scale: Math.round(clamp(source.scale, 80, 130, DEFAULT_PANEL.scale)),
      fontScale: Math.round(clamp(source.fontScale, 80, 160, DEFAULT_PANEL.fontScale)),
      triggerSize: Math.round(clamp(source.triggerSize, 8, 24, DEFAULT_PANEL.triggerSize)),
      transparency: Math.round(clamp(source.transparency, 0, 65, DEFAULT_PANEL.transparency)),
      panelMaterial: ["opaque", "transparent", "blur", "acrylic"].includes(source.panelMaterial) ? source.panelMaterial : (Number(source.transparency) > 0 ? "transparent" : "opaque"),
      widgets: Array.isArray(source.widgets) ? normalizeWidgetTypes(source.widgets) : null,
      weatherCity: typeof source.weatherCity === "string" && source.weatherCity.trim() ? source.weatherCity.trim().slice(0, 80) : DEFAULT_PANEL.weatherCity,
    };
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `panel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getMainTabPalette() {
    const root = document.documentElement;
    if (!root?.dataset?.theme) return null;
    const computed = getComputedStyle(root);
    const token = (name) => computed.getPropertyValue(name).trim();
    const palette = {
      bg: token("--surface"),
      strong: token("--surface-strong"),
      hover: token("--surface-hover"),
      text: token("--text"),
      muted: token("--muted"),
      line: token("--line"),
      accent: token("--accent"),
      contrast: token("--accent-contrast"),
      shadow: token("--shadow"),
    };
    return Object.values(palette).every(Boolean) ? palette : null;
  }

  function currentPalette() {
    // On the extension desktop, take the resolved values from the real theme
    // contract instead of maintaining a second visual approximation.
    const mainTabPalette = getMainTabPalette();
    if (mainTabPalette) return mainTabPalette;

    // Ordinary websites read the exact resolved palette published by the desktop.
    if (sharedTheme && typeof sharedTheme === "object" && Object.values(sharedTheme).every(Boolean)) return { ...sharedTheme };

    // Before the desktop has published once, fall back to the persisted preset.
    const fallback = PALETTES.midnight;
    const base = { ...(PALETTES[settings.themeId] || fallback) };
    const custom = settings.customTheme && typeof settings.customTheme === "object" ? settings.customTheme : {};
    if (typeof custom["--surface"] === "string" && custom["--surface"].trim()) base.bg = custom["--surface"];
    if (typeof custom["--bg-0"] === "string" && custom["--bg-0"].trim()) base.strong = custom["--bg-0"];
    if (typeof custom["--text"] === "string" && custom["--text"].trim()) base.text = custom["--text"];
    if (typeof custom["--accent"] === "string" && custom["--accent"].trim()) {
      base.accent = custom["--accent"];
      base.line = custom["--accent"];
    }
    return base;
  }

  const host = document.createElement("div");
  host.id = "mflt-web-panel-host";
  host.setAttribute("aria-hidden", "true");
  document.documentElement.dataset.mfltWebPanelMounted = "true";
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: "closed" });
  const panelStyle = document.createElement("style");
  panelStyle.textContent = `
      :host { all: initial; position: fixed; z-index: 2147483646; pointer-events: none; }
      *, *::before, *::after { box-sizing: border-box; }
      #panel { position: fixed; zoom: var(--mflt-browser-zoom, 1); top: calc(12px * var(--mflt-scale)); bottom: calc(12px * var(--mflt-scale)); right: 0; display: flex; width: calc(var(--mflt-width) * var(--mflt-scale)); overflow: hidden; flex-direction: column; border: 1px solid var(--mflt-line); border-right: 0; border-radius: 10px 0 0 10px; color: var(--mflt-text); background: linear-gradient(145deg, color-mix(in srgb, var(--mflt-accent) var(--mflt-material-tint), transparent), color-mix(in srgb, var(--mflt-strong) var(--mflt-material-sheen), transparent)), color-mix(in srgb, var(--mflt-bg) var(--mflt-panel-opacity), transparent); box-shadow: -18px 0 42px var(--mflt-shadow); -webkit-backdrop-filter: blur(var(--mflt-backdrop-blur)) saturate(var(--mflt-backdrop-saturation)); backdrop-filter: blur(var(--mflt-backdrop-blur)) saturate(var(--mflt-backdrop-saturation)); font-family: "IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; pointer-events: auto; transform: translateX(calc(100% - var(--mflt-trigger))); transition: transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease, background 180ms ease; }
      :host([data-edge="left"]) #panel { right: auto; left: 0; border-right: 1px solid var(--mflt-line); border-left: 0; border-radius: 0 10px 10px 0; box-shadow: 18px 0 42px var(--mflt-shadow); transform: translateX(calc(-100% + var(--mflt-trigger))); }
      :host([data-open="true"]) #panel { transform: translateX(0); }
      :host([data-disabled="true"]) { display: none; }
      #tab { position: absolute; top: 48%; left: 2px; display: grid; width: 10px; height: 48px; place-items: center; border: 1px solid var(--mflt-line); border-left: 0; border-radius: 0 7px 7px 0; color: var(--mflt-accent); background: color-mix(in srgb, var(--mflt-strong) var(--mflt-card-opacity), transparent); font-size: 9px; line-height: 1; pointer-events: none; }
      :host([data-edge="left"]) #tab { right: 2px; left: auto; border-right: 0; border-left: 1px solid var(--mflt-line); border-radius: 7px 0 0 7px; }
      #app { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; padding: calc(10px * var(--mflt-scale)); background: linear-gradient(180deg, color-mix(in srgb, var(--mflt-accent) var(--mflt-app-accent-tint), transparent), transparent 32%), color-mix(in srgb, var(--mflt-bg) var(--mflt-panel-opacity), transparent); }
      .header { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; min-height: 31px; padding: 0 0 8px; border-bottom: 1px solid var(--mflt-line); }
      .eyebrow { display: block; margin-bottom: 2px; color: var(--mflt-muted); font-size: calc(8px * var(--mflt-font-scale)); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      h1 { margin: 0; color: var(--mflt-text); font-size: calc(12px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: .04em; }
      .header-actions { display: flex; gap: 4px; }
      button { appearance: none; -webkit-appearance: none; font: inherit; }
      .icon-button { display: grid; width: 27px; height: 27px; place-items: center; border: 1px solid transparent; border-radius: 5px; cursor: pointer; color: var(--mflt-muted); background: transparent; font-size: 16px; line-height: 1; }
      .icon-button:hover, .icon-button[aria-pressed="true"] { border-color: var(--mflt-line); color: var(--mflt-text); background: var(--mflt-hover); }
      #catalog { display: none; margin-top: 9px; padding: 8px; border: 1px solid var(--mflt-line); border-radius: 6px; background: var(--mflt-strong); }
      #catalog.is-open { display: grid; gap: 5px; }
      .catalog-title { color: var(--mflt-muted); font-size: calc(9px * var(--mflt-font-scale)); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .catalog-choice { display: grid; grid-template-columns: 17px 1fr; align-items: center; gap: 7px; padding: 5px 0; cursor: pointer; color: var(--mflt-text); font-size: calc(10px * var(--mflt-font-scale)); }
      .catalog-choice input { width: 14px; height: 14px; margin: 0; accent-color: var(--mflt-accent); }
      .catalog-hint { margin: 2px 0 0; color: var(--mflt-muted); font-size: calc(9px * var(--mflt-font-scale)); line-height: 1.35; }
      #widgets { display: grid; min-height: 0; flex: 1; align-content: start; grid-auto-rows: max-content; gap: 8px; padding: 10px 0 0; overflow: auto; scrollbar-color: var(--mflt-line) transparent; }
      #widgets::-webkit-scrollbar { width: 7px; }
      #widgets::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 10px; background: var(--mflt-line); background-clip: padding-box; }
      .card { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr); align-content: start; gap: 8px; min-width: 0; min-height: 110px; padding: 9px 9px 16px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--mflt-line) 80%, transparent); border-radius: 6px; background: linear-gradient(145deg, color-mix(in srgb, var(--mflt-accent) var(--mflt-card-tint), transparent), color-mix(in srgb, var(--mflt-strong) var(--mflt-card-sheen), transparent)), color-mix(in srgb, var(--mflt-strong) var(--mflt-card-opacity), transparent); }
      .card-body { min-height: 0; height: 100%; display: flex; flex-direction: column; }
      .card-body-note > textarea { flex: 1; min-height: 0; height: 100%; resize: none; }
      .card-body-clock .clock { flex: 1; display: grid; align-content: center; gap: 9px; }
      .card-body-tasks > div, .card-body-timer > div, .card-body-media > div { min-height: 0; height: 100%; display: flex; flex: 1; flex-direction: column; }
      .card-body-tasks .task-list { flex: 1; max-height: none; }
      .card-body-timer > div, .card-body-media > div { justify-content: space-between; }
      .card-resize-handle { position: absolute; right: 3px; bottom: 2px; display: grid; width: 18px; height: 13px; padding: 0; place-items: center; border: 0; cursor: ns-resize; color: var(--mflt-accent); background: transparent; font: 700 15px/1 ui-monospace, monospace; }
      .card-resize-handle:hover, .card.is-resizing .card-resize-handle { color: var(--mflt-text); }
      .card.is-dragging { opacity: .44; }
      .card.is-drop-target { border-color: var(--mflt-accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--mflt-accent) 45%, transparent); }
      .card-header { display: grid; grid-template-columns: 16px 1fr; align-items: center; gap: 6px; color: var(--mflt-muted); font-size: calc(9px * var(--mflt-font-scale)); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .grip { cursor: grab; color: var(--mflt-accent); letter-spacing: -2px; }
      .card:active .grip { cursor: grabbing; }
      .clock-time { color: var(--mflt-accent); font-size: calc(30px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: -.09em; line-height: 1; font-variant-numeric: tabular-nums; }
      .clock-date { color: var(--mflt-muted); font-size: calc(10px * var(--mflt-font-scale)); }
      .task-add { display: grid; grid-template-columns: minmax(0, 1fr) 29px; gap: 5px; }
      input, textarea { width: 100%; min-width: 0; border: 1px solid var(--mflt-line); border-radius: 4px; outline: 0; color: var(--mflt-text); background: var(--mflt-strong); font: calc(11px * var(--mflt-font-scale))/1.35 "IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      input { height: 30px; padding: 6px 7px; }
      textarea { min-height: 88px; padding: 7px; resize: vertical; }
      input::placeholder, textarea::placeholder { color: var(--mflt-muted); opacity: .82; }
      input:focus, textarea:focus { border-color: var(--mflt-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--mflt-accent) 22%, transparent); }
      .small-action { display: grid; min-width: 29px; height: 30px; place-items: center; border: 1px solid var(--mflt-line); border-radius: 4px; cursor: pointer; color: var(--mflt-accent); background: transparent; font-size: 16px; }
      .small-action:hover { color: var(--mflt-contrast); background: var(--mflt-accent); }
      .task-list { display: grid; gap: 4px; max-height: 145px; overflow: auto; }
      .task { display: grid; grid-template-columns: 15px minmax(0, 1fr) 17px; align-items: center; gap: 6px; min-height: 22px; padding: 3px 4px; border: 1px solid transparent; color: var(--mflt-text); font-size: calc(10px * var(--mflt-font-scale)); }
      .task:hover { border-color: color-mix(in srgb, var(--mflt-line) 68%, transparent); background: var(--mflt-hover); }
      .task input { width: 13px; height: 13px; margin: 0; accent-color: var(--mflt-accent); }
      .task-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .task.is-done .task-text { color: var(--mflt-muted); text-decoration: line-through; }
      .task-remove { width: 17px; height: 17px; padding: 0; border: 0; cursor: pointer; color: var(--mflt-muted); background: transparent; font-size: 13px; line-height: 1; }
      .task-remove:hover { color: var(--mflt-accent); }
      .empty-panel { display: grid; gap: 8px; min-height: 190px; padding: 15px; align-content: center; border: 1px dashed color-mix(in srgb, var(--mflt-accent) 68%, var(--mflt-line)); border-radius: 6px; background: color-mix(in srgb, var(--mflt-accent) 5%, transparent); text-align: left; }
      .empty-kicker { color: var(--mflt-accent); font-size: calc(9px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: .11em; }
      .empty-panel h2 { margin: 0; color: var(--mflt-text); font-size: calc(14px * var(--mflt-font-scale)); letter-spacing: .02em; }
      .empty-panel p { margin: 0; color: var(--mflt-muted); font-size: calc(10px * var(--mflt-font-scale)); line-height: 1.5; }
      .empty-action { min-height: 30px; justify-self: start; margin-top: 3px; padding: 0 9px; border: 1px solid var(--mflt-accent); border-radius: 4px; cursor: pointer; color: var(--mflt-accent); background: transparent; font: 700 calc(9px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .empty-action:hover, .empty-action:focus-visible { color: var(--mflt-contrast); outline: none; background: var(--mflt-accent); }
      .timer-widget { display: grid; align-content: start; gap: 0; }
      .timer-readout { margin-bottom: 7px; color: var(--mflt-accent); font-size: calc(27px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: -.09em; line-height: 1; text-align: center; font-variant-numeric: tabular-nums; }
      .timer-mode-row { display: grid; min-height: 29px; }
      .timer-mode-row > .timer-set-row,
      .timer-mode-row > .timer-adjustments { grid-area: 1 / 1; }
      .timer-set-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px; }
      .timer-set-row.is-hidden { visibility: hidden; }
      .timer-minutes { min-width: 0; height: 29px; padding: 0 8px; border: 1px solid var(--mflt-line); border-radius: 4px; outline: 0; color: var(--mflt-text); background: color-mix(in srgb, var(--mflt-strong) 72%, transparent); font: 700 calc(10px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .timer-minutes:focus { border-color: var(--mflt-accent); background: var(--mflt-hover); }
      .timer-apply { min-height: 29px; padding: 0 7px; border: 1px solid var(--mflt-line); border-radius: 4px; cursor: pointer; color: var(--mflt-accent); background: transparent; font: 700 calc(9px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .timer-apply:hover { border-color: var(--mflt-accent); background: var(--mflt-hover); }
      .timer-actions, .timer-adjustments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
      .timer-actions button, .timer-adjustments button { min-height: 29px; padding: 0 3px; border: 1px solid var(--mflt-line); border-radius: 4px; cursor: pointer; color: var(--mflt-text); background: transparent; font-size: calc(9px * var(--mflt-font-scale)); font-weight: 700; }
      .timer-actions button:hover, .timer-adjustments button:hover { border-color: var(--mflt-accent); background: var(--mflt-hover); }
      .timer-actions button[data-action="timer-start"] { color: var(--mflt-contrast); background: var(--mflt-accent); }
      .timer-actions button[data-action="timer-start"]:hover { filter: brightness(1.1); }
      .timer-adjustments { min-height: 29px; visibility: hidden; }
      .timer-adjustments.is-active { visibility: visible; }
      .timer-adjustments button { color: var(--mflt-accent); }
      .stopwatch-widget { display: grid; height: 100%; grid-template-rows: auto auto minmax(0, 1fr); gap: 8px; }
      .stopwatch-readout { color: var(--mflt-accent); font-size: calc(29px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: -.06em; line-height: 1; text-align: center; font-variant-numeric: tabular-nums; }
      .stopwatch-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
      .stopwatch-actions button { min-height: 29px; border: 1px solid var(--mflt-line); border-radius: 4px; cursor: pointer; color: var(--mflt-text); background: transparent; font: 700 calc(9px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .stopwatch-actions button[data-action="stopwatch-start"] { color: var(--mflt-contrast); background: var(--mflt-accent); border-color: var(--mflt-accent); }
      .stopwatch-laps { display: grid; align-content: start; gap: 3px; overflow: auto; color: var(--mflt-muted); font-size: calc(9px * var(--mflt-font-scale)); }
      .stopwatch-lap { display: flex; justify-content: space-between; gap: 10px; padding-top: 3px; border-top: 1px solid color-mix(in srgb, var(--mflt-line) 45%, transparent); }
      .translator-widget { display: grid; height: 100%; grid-template-rows: auto minmax(46px, 1fr) minmax(46px, 1fr) auto; gap: 7px; }
      .translator-languages { display: grid; grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); gap: 5px; }
      .translator-select, .translator-input, .translator-output { min-width: 0; box-sizing: border-box; border: 1px solid var(--mflt-line); border-radius: 4px; outline: 0; color: var(--mflt-text); background: color-mix(in srgb, var(--mflt-strong) 74%, transparent); font: 700 calc(9px * var(--mflt-font-scale))/1.35 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .translator-select { height: 29px; padding: 0 5px; }
      .translator-input, .translator-output { width: 100%; resize: none; padding: 7px; }
      .translator-input:focus { border-color: var(--mflt-accent); background: var(--mflt-hover); }
      .translator-swap { border: 1px solid var(--mflt-line); border-radius: 4px; cursor: pointer; color: var(--mflt-accent); background: transparent; font-weight: 800; }
      .translator-footer { display: grid; grid-template-columns: minmax(0, 1fr) 88px; align-items: center; gap: 7px; }
      .translator-status { overflow: hidden; color: var(--mflt-muted); font-size: calc(8px * var(--mflt-font-scale)); text-overflow: ellipsis; white-space: nowrap; }
      .translator-translate { min-height: 29px; border: 1px solid var(--mflt-accent); border-radius: 4px; cursor: pointer; color: var(--mflt-contrast); background: var(--mflt-accent); font: 700 calc(9px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .weather-widget, .rest-widget { display: grid; align-content: start; gap: 8px; height: 100%; }
      .weather-city, .rest-select { width: 100%; min-width: 0; height: 30px; padding: 0 8px; border: 1px solid var(--mflt-line); border-radius: 4px; outline: 0; color: var(--mflt-text); background: color-mix(in srgb, var(--mflt-strong) 74%, transparent); font: 700 calc(10px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .weather-city:focus, .rest-select:focus { border-color: var(--mflt-accent); background: var(--mflt-hover); }
      .weather-city-name { color: var(--mflt-accent); font-size: calc(9px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: .08em; text-align: center; }
      .weather-main { color: var(--mflt-accent); font-size: calc(27px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: -.06em; text-align: center; }
      .weather-detail { min-height: 32px; color: var(--mflt-muted); font-size: calc(9px * var(--mflt-font-scale)); line-height: 1.35; text-align: center; }
      .weather-updated { color: var(--mflt-muted); font-size: calc(8px * var(--mflt-font-scale)); letter-spacing: .04em; text-align: center; }
      .weather-refresh, .rest-play { min-height: 29px; border: 1px solid var(--mflt-accent); border-radius: 4px; cursor: pointer; color: var(--mflt-contrast); background: var(--mflt-accent); font: 700 calc(10px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .weather-refresh:hover:not(:disabled), .rest-play:hover { filter: brightness(1.08); }
      .rest-kicker { color: var(--mflt-accent); font-size: calc(8px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: .12em; }
      .rest-controls { display: grid; grid-template-columns: 86px minmax(0, 1fr) 30px; align-items: center; gap: 7px; }
      .rest-volume { width: 100%; accent-color: var(--mflt-accent); }
      .rest-volume-value { color: var(--mflt-muted); font-size: calc(8px * var(--mflt-font-scale)); text-align: right; }
      .media-widget { display: grid; container-type: inline-size; min-width: 0; min-height: 0; height: 100%; grid-template-rows: auto minmax(58px, 1fr) auto auto auto; gap: 9px; }
      .media-widget.is-busy { opacity: .82; }
      .media-widget.is-busy .media-locate, .media-widget.is-busy .media-control, .media-widget.is-busy .media-icon-button { pointer-events: none; }
      .media-head, .media-footer, .media-volume-wrap, .media-controls { display: flex; align-items: center; }
      .media-head { justify-content: space-between; gap: 8px; }
      .media-head-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 5px; }
      .media-kicker { color: var(--mflt-accent); font-size: calc(8px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: .12em; }
      .media-status { flex: 0 0 auto; padding: 3px 6px; border: 1px solid color-mix(in srgb, var(--mflt-line) 72%, transparent); border-radius: 4px; color: var(--mflt-muted); font-size: calc(7px * var(--mflt-font-scale)); font-weight: 800; letter-spacing: .08em; }
      .media-widget.has-media .media-status { border-color: color-mix(in srgb, var(--mflt-accent) 55%, var(--mflt-line)); color: var(--mflt-accent); background: color-mix(in srgb, var(--mflt-accent) 8%, transparent); }
      .media-icon-button { display: grid; width: 28px; height: 28px; place-items: center; padding: 0; border: 1px solid color-mix(in srgb, var(--mflt-line) 72%, transparent); border-radius: 4px; cursor: pointer; color: var(--mflt-muted); background: transparent; }
      .media-icon-button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--mflt-accent) 58%, var(--mflt-line)); color: var(--mflt-accent); background: color-mix(in srgb, var(--mflt-accent) 8%, transparent); }
      .media-now { display: grid; align-content: center; min-width: 0; padding: 10px 11px; border: 1px solid color-mix(in srgb, var(--mflt-line) 82%, transparent); border-radius: 5px; background: color-mix(in srgb, var(--mflt-strong) 62%, transparent); }
      .media-source { overflow: hidden; color: var(--mflt-text); font-size: calc(11px * var(--mflt-font-scale)); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
      .media-timeline { display: -webkit-box; margin-top: 4px; overflow: hidden; color: var(--mflt-muted); font-size: calc(8px * var(--mflt-font-scale)); line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
      .media-locate { width: 100%; min-height: 35px; border: 1px solid var(--mflt-accent); border-radius: 4px; cursor: pointer; color: var(--mflt-contrast); background: var(--mflt-accent); font: 700 calc(10px * var(--mflt-font-scale))/1 "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace; }
      .media-controls { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); width: 100%; gap: 6px; }
      .media-control { display: grid; width: 100%; min-width: 0; height: 38px; min-height: 38px; place-items: center; padding: 0; border: 1px solid color-mix(in srgb, var(--mflt-line) 78%, transparent); border-radius: 4px; cursor: pointer; color: var(--mflt-text); background: color-mix(in srgb, var(--mflt-strong) 60%, transparent); }
      .media-control.is-primary { border-color: var(--mflt-accent); color: var(--mflt-contrast); background: var(--mflt-accent); }
      .media-control:hover:not(:disabled) { transform: translateY(-1px); }
      .media-footer { justify-content: space-between; gap: 8px; }
      .media-volume-wrap { min-width: 0; flex: 1; gap: 7px; }
      .media-volume { width: 100%; min-width: 48px; accent-color: var(--mflt-accent); }
      .media-widget button:disabled, .media-widget input:disabled { cursor: not-allowed; opacity: .42; }
      .footer { margin-top: 8px; padding-top: 7px; border-top: 1px solid color-mix(in srgb, var(--mflt-line) 58%, transparent); color: var(--mflt-muted); font-size: calc(8px * var(--mflt-font-scale)); letter-spacing: .05em; text-align: center; }
      @media (prefers-reduced-motion: reduce) { #panel { transition: none; } }
  `;
  shadow.append(panelStyle);
  const panelShell = document.createElement("aside");
  panelShell.id = "panel";
  panelShell.setAttribute("aria-label", "Выдвижная панель виджетов");
  const panelTab = document.createElement("span");
  panelTab.id = "tab";
  panelTab.setAttribute("aria-hidden", "true");
  panelTab.textContent = "||";
  const appHost = document.createElement("div");
  appHost.id = "app";
  panelShell.append(panelTab, appHost);
  shadow.append(panelShell);

  const panel = shadow.getElementById("panel");
  const app = shadow.getElementById("app");

  function setOpen(open) {
    clearTimeout(closeTimer);
    host.dataset.open = String(Boolean(open));
    host.setAttribute("aria-hidden", String(!open));
  }

  function queueClose() {
    if (isDraggingWidget || Date.now() < dragCloseHoldUntil) return;
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (!isDraggingWidget && !panelPointerInside) setOpen(false);
    }, 220);
  }

  panel.addEventListener("pointerenter", () => { panelPointerInside = true; setOpen(true); });
  panel.addEventListener("pointerleave", () => { panelPointerInside = false; queueClose(); });
  shadow.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  function persistData() {
    writeStorage({ [DATA_KEY]: data });
  }

  function timerRemaining() {
    if (!data.timer.running) return data.timer.remaining;
    return Math.max(0, Math.ceil((data.timer.endsAt - Date.now()) / 1000));
  }

  function prepareTimerAlarm() {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      timerAudioContext ||= new AudioContextClass();
      if (timerAudioContext.state === "suspended") timerAudioContext.resume().catch(() => undefined);
      return timerAudioContext;
    } catch { return null; }
  }

  function playTimerAlarm() {
    const context = prepareTimerAlarm();
    if (!context) return;
    const startAt = context.currentTime + 0.02;
    [0, 0.23, 0.46].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(index === 2 ? 1047 : 784, startAt + offset);
      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, startAt + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.17);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.18);
    });
  }

  function formatSeconds(value) {
    const total = Math.max(0, Math.round(value));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function updateDynamicValues() {
    const locale = settings.locale || navigator.language || "ru-RU";
    const now = new Date();
    const clock = shadow.getElementById("mflt-clock-time");
    const date = shadow.getElementById("mflt-clock-date");
    if (clock) clock.textContent = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
    if (date) date.textContent = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short" }).format(now);
    const timer = shadow.getElementById("mflt-timer-readout");
    const stopwatch = shadow.getElementById("mflt-stopwatch-readout");
    const start = shadow.querySelector("[data-action='timer-start']");
    const configuration = shadow.querySelector("[data-role='timer-configuration']");
    const adjustments = shadow.querySelector("[data-role='timer-adjustments']");
    const minutesInput = shadow.querySelector("[data-role='timer-minutes']");
    let remaining = timerRemaining();
    if (data.timer.running && remaining <= 0) {
      playTimerAlarm();
      data.timer = { remaining: 0, running: false, endsAt: 0 };
      remaining = 0;
      persistData();
    }
    if (timer) timer.textContent = formatSeconds(remaining);
    if (stopwatch) stopwatch.textContent = formatStopwatch(stopwatchElapsed());
    if (start) start.textContent = data.timer.running ? "Пауза" : "Старт";
    configuration?.classList.toggle("is-hidden", data.timer.running);
    adjustments?.classList.toggle("is-active", data.timer.running);
    if (minutesInput && !data.timer.running && shadow.activeElement !== minutesInput) minutesInput.value = String(Math.max(1, Math.ceil(remaining / 60)));
  }

  function element(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = options.text;
    if (options.attrs) Object.entries(options.attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
    children.forEach((child) => node.append(child));
    return node;
  }

  function makeCard(type, content) {
    const card = element("section", { className: "card", attrs: { draggable: "true", "data-widget": type, "aria-label": WIDGET_LABELS[type] } });
    card.style.height = `${Math.round(clamp(data.heights?.[type], 110, 680, DEFAULT_CARD_HEIGHTS[type] || 180))}px`;
    card.append(element("div", { className: "card-header" }, [element("span", { className: "grip", text: "::", attrs: { "aria-hidden": "true" } }), element("span", { text: WIDGET_LABELS[type] })]));
    card.append(element("div", { className: `card-body card-body-${type}` }, [content]));
    const resizeHandle = element("button", { className: "card-resize-handle", text: "⌟", attrs: { type: "button", draggable: "false", title: "Изменить высоту виджета", "aria-label": "Изменить высоту виджета" } });
    resizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resizingWidget = type;
      const startY = event.clientY;
      const startHeight = card.getBoundingClientRect().height;
      card.classList.add("is-resizing");
      clearTimeout(closeTimer);
      setOpen(true);
      const move = (moveEvent) => {
        const nextHeight = Math.round(clamp(startHeight + moveEvent.clientY - startY, 110, 680, DEFAULT_CARD_HEIGHTS[type] || 180));
        data.heights = { ...(data.heights || {}), [type]: nextHeight };
        card.style.height = `${nextHeight}px`;
      };
      const finish = () => {
        resizingWidget = "";
        card.classList.remove("is-resizing");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", finish);
        document.removeEventListener("pointercancel", finish);
        try { resizeHandle.releasePointerCapture(event.pointerId); } catch { /* Pointer can leave the document. */ }
        persistData();
      };
      try { resizeHandle.setPointerCapture(event.pointerId); } catch { /* Older Chromium builds may not expose pointer capture here. */ }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", finish, { once: true });
      document.addEventListener("pointercancel", finish, { once: true });
    });
    card.append(resizeHandle);
    card.addEventListener("dragstart", (event) => {
      if (resizingWidget) { event.preventDefault(); return; }
      draggedWidget = type;
      isDraggingWidget = true;
      clearTimeout(closeTimer);
      setOpen(true);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", type);
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      draggedWidget = "";
      isDraggingWidget = false;
      dragCloseHoldUntil = Date.now() + 700;
      card.classList.remove("is-dragging");
      window.setTimeout(() => { if (!panelPointerInside) queueClose(); }, 710);
    });
    card.addEventListener("dragover", (event) => { if (draggedWidget && draggedWidget !== type) { event.preventDefault(); card.classList.add("is-drop-target"); } });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-drop-target");
      const source = event.dataTransfer.getData("text/plain") || draggedWidget;
      if (!source || source === type) return;
      const next = [...data.widgets];
      const from = next.indexOf(source);
      const targetIndex = next.indexOf(type);
      if (from < 0 || targetIndex < 0) return;
      const targetBounds = card.getBoundingClientRect();
      const insertAfter = event.clientY > targetBounds.top + targetBounds.height / 2;
      next.splice(from, 1);
      const currentTargetIndex = next.indexOf(type);
      next.splice(currentTargetIndex + (insertAfter ? 1 : 0), 0, source);
      data.widgets = next;
      persistData();
      render();
    });
    return card;
  }

  function clockWidget() {
    const content = element("div", { className: "clock" }, [element("div", { className: "clock-time", attrs: { id: "mflt-clock-time" } }), element("div", { className: "clock-date", attrs: { id: "mflt-clock-date" } })]);
    return makeCard("clock", content);
  }

  function tasksWidget() {
    const input = element("input", { attrs: { type: "text", maxlength: "180", placeholder: "Новая задача" } });
    const add = element("button", { className: "small-action", text: "+", attrs: { type: "button", title: "Добавить задачу" } });
    const addTask = () => {
      const text = input.value.trim();
      if (!text) return;
      data.tasks.unshift({ id: makeId(), text, done: false });
      input.value = "";
      persistData();
      render();
    };
    add.addEventListener("click", addTask);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addTask(); } });
    const list = element("div", { className: "task-list" });
    if (!data.tasks.length) list.append(element("div", { className: "empty", text: "Список задач пуст" }));
    data.tasks.forEach((task) => {
      const checkbox = element("input", { attrs: { type: "checkbox", "aria-label": `Отметить: ${task.text}` } });
      checkbox.checked = task.done;
      checkbox.addEventListener("change", () => {
        const target = data.tasks.find((item) => item.id === task.id);
        if (target) target.done = checkbox.checked;
        persistData();
        render();
      });
      const remove = element("button", { className: "task-remove", text: "×", attrs: { type: "button", title: "Удалить задачу", "aria-label": "Удалить задачу" } });
      remove.addEventListener("click", () => {
        data.tasks = data.tasks.filter((item) => item.id !== task.id);
        persistData();
        render();
      });
      const item = element("div", { className: `task${task.done ? " is-done" : ""}` }, [checkbox, element("span", { className: "task-text", text: task.text, attrs: { title: task.text } }), remove]);
      list.append(item);
    });
    return makeCard("tasks", element("div", {}, [element("div", { className: "task-add" }, [input, add]), list]));
  }

  function noteWidget() {
    const note = element("textarea", { attrs: { maxlength: "8000", placeholder: "Быстрая заметка…", "aria-label": "Быстрая заметка" } });
    note.value = data.note;
    note.addEventListener("input", () => {
      data.note = note.value;
      clearTimeout(noteSaveTimer);
      noteSaveTimer = window.setTimeout(persistData, 280);
    });
    return makeCard("note", note);
  }

  function timerWidget() {
    const readout = element("div", { className: "timer-readout", attrs: { id: "mflt-timer-readout" } });
    const minutes = element("input", { className: "timer-minutes", attrs: { type: "number", min: "1", max: "1440", step: "1", inputmode: "numeric", "data-role": "timer-minutes", "aria-label": "Минуты таймера" } });
    minutes.value = String(Math.max(1, Math.ceil(timerRemaining() / 60)));
    const setSeconds = (seconds) => {
      const next = Math.round(clamp(seconds, 0, 24 * 60 * 60, 0));
      data.timer.remaining = next;
      if (data.timer.running) data.timer.endsAt = Date.now() + next * 1000;
      minutes.value = String(Math.max(1, Math.ceil(next / 60)));
      persistData();
      updateDynamicValues();
    };
    const apply = element("button", { className: "timer-apply", text: "Установить", attrs: { type: "button", title: "Установить указанное число минут" } });
    const applyMinutes = () => setSeconds(Math.round(clamp(minutes.value, 1, 1440, 25)) * 60);
    apply.addEventListener("click", applyMinutes);
    minutes.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); applyMinutes(); } });
    const start = element("button", { text: data.timer.running ? "Пауза" : "Старт", attrs: { type: "button", "data-action": "timer-start" } });
    start.addEventListener("click", () => {
      // Инициализация аудиоконтекста в пользовательском действии снимает
      // блокировку автовоспроизведения для сигнала по завершении таймера.
      prepareTimerAlarm();
      if (data.timer.running) {
        data.timer.remaining = timerRemaining(); data.timer.running = false; data.timer.endsAt = 0;
      } else {
        if (data.timer.remaining <= 0) data.timer.remaining = Math.round(clamp(minutes.value, 1, 1440, 25)) * 60;
        data.timer.running = true; data.timer.endsAt = Date.now() + data.timer.remaining * 1000;
      }
      persistData(); updateDynamicValues();
    });
    const minus = element("button", { text: "−1 мин", attrs: { type: "button", title: "Уменьшить оставшееся время на 1 минуту" } });
    minus.addEventListener("click", () => { if (data.timer.running) setSeconds(timerRemaining() - 60); });
    const plus = element("button", { text: "+1 мин", attrs: { type: "button", title: "Увеличить оставшееся время на 1 минуту" } });
    plus.addEventListener("click", () => { if (data.timer.running) setSeconds(timerRemaining() + 60); });
    const reset = element("button", { text: "Сброс", attrs: { type: "button" } });
    reset.addEventListener("click", () => { data.timer = { remaining: 1500, running: false, endsAt: 0 }; minutes.value = "25"; persistData(); updateDynamicValues(); });
    const configuration = element("div", { className: `timer-set-row${data.timer.running ? " is-hidden" : ""}`, attrs: { "data-role": "timer-configuration" } }, [minutes, apply]);
    const adjustments = element("div", { className: `timer-adjustments${data.timer.running ? " is-active" : ""}`, attrs: { "data-role": "timer-adjustments" } }, [minus, plus]);
    const modeRow = element("div", { className: "timer-mode-row" }, [configuration, adjustments]);
    return makeCard("timer", element("div", { className: "timer-widget" }, [readout, modeRow, element("div", { className: "timer-actions" }, [start, reset])]));
  }

  function stopwatchElapsed() {
    if (!data.stopwatch.running) return data.stopwatch.elapsed;
    return Math.max(0, Math.round(data.stopwatch.elapsed + (Date.now() - data.stopwatch.startedAt) / 1000));
  }

  function formatStopwatch(value) {
    const total = Math.max(0, Math.round(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function stopwatchWidget() {
    const readout = element("div", { className: "stopwatch-readout", attrs: { id: "mflt-stopwatch-readout", "aria-live": "polite" } });
    const laps = element("div", { className: "stopwatch-laps" });
    const renderLaps = () => {
      laps.replaceChildren();
      const entries = [...data.stopwatch.laps].reverse();
      if (!entries.length) laps.append(element("span", { text: "Круги появятся здесь" }));
      entries.forEach((value, index) => laps.append(element("div", { className: "stopwatch-lap" }, [element("span", { text: `КРУГ ${entries.length - index}` }), element("strong", { text: formatStopwatch(value) })])));
    };
    const start = element("button", { text: data.stopwatch.running ? "Пауза" : "Старт", attrs: { type: "button", "data-action": "stopwatch-start" } });
    const lap = element("button", { text: "Круг", attrs: { type: "button" } });
    const reset = element("button", { text: "Сброс", attrs: { type: "button" } });
    start.addEventListener("click", () => {
      if (data.stopwatch.running) { data.stopwatch.elapsed = stopwatchElapsed(); data.stopwatch.running = false; data.stopwatch.startedAt = 0; }
      else { data.stopwatch.running = true; data.stopwatch.startedAt = Date.now(); }
      start.textContent = data.stopwatch.running ? "Пауза" : "Старт"; persistData(); updateDynamicValues();
    });
    lap.addEventListener("click", () => { const value = stopwatchElapsed(); if (!value) return; data.stopwatch.laps = [...data.stopwatch.laps, value].slice(-8); persistData(); renderLaps(); });
    reset.addEventListener("click", () => { data.stopwatch = { elapsed: 0, running: false, startedAt: 0, laps: [] }; start.textContent = "Старт"; persistData(); renderLaps(); updateDynamicValues(); });
    renderLaps(); updateDynamicValues();
    return makeCard("stopwatch", element("div", { className: "stopwatch-widget" }, [readout, element("div", { className: "stopwatch-actions" }, [start, lap, reset]), laps]));
  }

  const TRANSLATOR_LANGUAGES = Object.freeze([["ru", "Русский"], ["en", "English"], ["de", "Deutsch"], ["fr", "Français"], ["es", "Español"]]);

  function translatorWidget() {
    const from = element("select", { className: "translator-select", attrs: { "aria-label": "Язык исходного текста" } });
    const to = element("select", { className: "translator-select", attrs: { "aria-label": "Язык перевода" } });
    TRANSLATOR_LANGUAGES.forEach(([code, label]) => { from.append(element("option", { text: label, attrs: { value: code } })); to.append(element("option", { text: label, attrs: { value: code } })); });
    from.value = data.translator.from; to.value = data.translator.to;
    const swap = element("button", { className: "translator-swap", text: "↔", attrs: { type: "button", title: "Поменять языки местами", "aria-label": "Поменять языки местами" } });
    const input = element("textarea", { className: "translator-input", attrs: { maxlength: "1000", placeholder: "Текст для перевода", "aria-label": "Текст для перевода" } });
    const output = element("textarea", { className: "translator-output", attrs: { readonly: "", placeholder: "Перевод появится здесь", "aria-label": "Переведённый текст" } });
    const status = element("span", { className: "translator-status", attrs: { "aria-live": "polite" } });
    const translate = element("button", { className: "translator-translate", text: "Перевести", attrs: { type: "button" } });
    input.value = data.translator.text; output.value = data.translator.translated || data.translator.error;
    const sync = () => { status.textContent = data.translator.pending ? "MyMemory · перевод…" : data.translator.error ? `MyMemory · ${data.translator.error}` : data.translator.match !== null ? `MyMemory · совпадение ${Math.round(data.translator.match * 100)}%` : `MyMemory · ${new TextEncoder().encode(input.value).length}/500 байт`; translate.disabled = data.translator.pending; };
    const updateTranslationDraft = () => { data.translator = { ...data.translator, text: input.value, from: from.value, to: to.value, error: "", pending: false }; sync(); };
    const persistTranslation = () => { updateTranslationDraft(); persistData(); };
    // Набор не пишет в storage: иначе storage.onChanged пересоздаёт карточку и
    // сбрасывает поле после первого символа. Сохраняем текст при уходе из поля
    // либо при выполнении перевода.
    input.addEventListener("input", updateTranslationDraft);
    input.addEventListener("blur", persistTranslation);
    from.addEventListener("change", persistTranslation); to.addEventListener("change", persistTranslation);
    swap.addEventListener("click", () => { const oldFrom = from.value; from.value = to.value; to.value = oldFrom; const oldInput = input.value; input.value = output.value; output.value = oldInput; persistTranslation(); });
    translate.addEventListener("click", async () => {
      const source = input.value.trim(); const bytes = new TextEncoder().encode(source).length;
      if (!source) { status.textContent = "Введите текст для перевода."; return; }
      if (bytes > 500) { status.textContent = `MyMemory принимает до 500 байт. Сейчас: ${bytes}.`; return; }
      if (from.value === to.value) { output.value = source; data.translator = { ...data.translator, text: input.value, translated: source, from: from.value, to: to.value, error: "", match: 1, pending: false }; persistData(); sync(); return; }
      data.translator = { ...data.translator, text: input.value, from: from.value, to: to.value, error: "", pending: true }; sync();
      try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(source)}&langpair=${encodeURIComponent(`${from.value}|${to.value}`)}&mt=1`);
        const payload = await response.json();
        if (!response.ok || Number(payload.responseStatus || 200) !== 200) throw new Error(payload.responseDetails || "перевод временно недоступен");
        const translated = String(payload.responseData?.translatedText || "").trim(); if (!translated) throw new Error("сервис не вернул перевод");
        output.value = translated; data.translator = { ...data.translator, translated, error: "", match: Number.isFinite(Number(payload.responseData?.match)) ? Math.max(0, Math.min(1, Number(payload.responseData.match))) : null, pending: false }; persistData();
      } catch (error) { data.translator = { ...data.translator, error: error?.message || "перевод недоступен", pending: false }; output.value = data.translator.error; persistData(); }
      sync();
    });
    sync();
    return makeCard("translator", element("div", { className: "translator-widget" }, [element("div", { className: "translator-languages" }, [from, swap, to]), input, output, element("div", { className: "translator-footer" }, [status, translate])]));
  }

  function weatherSymbol(code) {
    if (code === 0) return "☀";
    if ([1, 2].includes(code)) return "⛅";
    if ([3, 45, 48].includes(code)) return "☁";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
    if ([95, 96, 99].includes(code)) return "ϟ";
    return "◌";
  }

  function weatherWidget() {
    const city = String(panelSettings.weatherCity || DEFAULT_PANEL.weatherCity);
    const cityName = element("div", { className: "weather-city-name", text: `ГОРОД: ${city}` });
    const main = element("div", { className: "weather-main" });
    const detail = element("div", { className: "weather-detail" });
    const updated = element("div", { className: "weather-updated", attrs: { "aria-live": "polite" } });
    const refresh = element("button", { className: "weather-refresh", text: "Обновить", attrs: { type: "button", title: "Получить текущую погоду" } });
    const paint = (message = "") => {
      const weather = data.weather;
      main.textContent = Number.isFinite(weather.temperature) ? `${weatherSymbol(weather.code)} ${Math.round(weather.temperature)}°` : "Погода не загружена";
      detail.textContent = message || (weather.location ? `${weather.location} · ощущается ${Math.round(weather.apparent)}° · ветер ${Math.round(weather.wind)} км/ч` : "Укажите город и нажмите «Обновить».");
      updated.textContent = weather.updatedAt ? `ОБНОВЛЕНО ${new Intl.DateTimeFormat(settings.locale || navigator.language || "ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(weather.updatedAt))}` : "";
    };
    refresh.addEventListener("click", async () => {
        const query = city.trim();
        if (!query) { paint("Укажите город в настройках панели."); return; }
      refresh.disabled = true; paint("Получаем погоду…");
      try {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=ru&format=json`);
        const place = (await geo.json()).results?.[0];
        if (!place) throw new Error("Город не найден.");
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(place.latitude)}&longitude=${encodeURIComponent(place.longitude)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
        const current = (await response.json()).current;
        if (!current) throw new Error("Сервис погоды не вернул данные.");
        data.weather = { city: query, location: [place.name, place.country].filter(Boolean).join(", "), temperature: Math.round(current.temperature_2m), apparent: Math.round(current.apparent_temperature), wind: Math.round(current.wind_speed_10m), code: current.weather_code, updatedAt: Date.now() };
        persistData(); paint();
      } catch (error) { paint(error?.message || "Не удалось загрузить погоду."); }
      finally { refresh.disabled = false; }
    });
    paint();
    return makeCard("weather", element("div", { className: "weather-widget" }, [cityName, main, detail, updated, refresh]));
  }

  const REST_AUDIO = Object.freeze({ rain: "assets/audio/rest-rain-nps.mp3", downpour: "assets/audio/rest-downpour-natural.ogg", thunder: "assets/audio/rest-thunder-natural.ogg", sea: "assets/audio/rest-sea-nps.mp3", forest: "assets/audio/rest-forest-nps.mp3", fire: "assets/audio/rest-fire-commons.ogg", wind: "assets/audio/rest-wind-natural.ogg" });
  const REST_SOUNDS = Object.freeze({ rain: "Дождь", downpour: "Ливень", thunder: "Гроза", sea: "Море", forest: "Лес", fire: "Камин", wind: "Ветер" });

  function restWidget() {
    const select = element("select", { className: "rest-select", attrs: { "aria-label": "Звук отдыха" } });
    Object.entries(REST_SOUNDS).forEach(([id, label]) => select.append(element("option", { text: label, attrs: { value: id } })));
    select.value = data.rest.sound;
    const volume = element("input", { className: "rest-volume", attrs: { type: "range", min: "0", max: "100", step: "1", "aria-label": "Громкость звука отдыха" } });
    volume.value = String(data.rest.volume);
    const play = element("button", { className: "rest-play", text: "Включить", attrs: { type: "button" } });
    const volumeValue = element("span", { className: "rest-volume-value", text: `${data.rest.volume}%` });
    const ensureAudio = () => {
      const sound = data.rest.sound;
      if (!restAudio || restAudioSound !== sound) {
        restAudio?.pause();
        restAudio = new Audio(api?.runtime?.getURL?.(REST_AUDIO[sound]) || REST_AUDIO[sound]);
        restAudio.loop = true; restAudioSound = sound;
      }
      restAudio.volume = Math.max(0, Math.min(1, Number(data.rest.volume) / 100));
      return restAudio;
    };
    const sync = () => { play.textContent = restAudio && !restAudio.paused ? "Пауза" : "Включить"; };
    select.addEventListener("change", () => { data.rest.sound = select.value; persistData(); if (restAudio && !restAudio.paused) { ensureAudio().play().catch(() => undefined); } sync(); });
    volume.addEventListener("input", () => { data.rest.volume = Number(volume.value); volumeValue.textContent = `${data.rest.volume}%`; if (restAudio) restAudio.volume = Math.max(0, Math.min(1, data.rest.volume / 100)); persistData(); });
    play.addEventListener("click", () => { const audio = ensureAudio(); if (audio.paused) audio.play().catch(() => undefined); else audio.pause(); sync(); });
    sync();
    return makeCard("rest", element("div", { className: "rest-widget" }, [element("span", { className: "rest-kicker", text: "ФОНОВЫЙ ЗВУК" }), select, element("div", { className: "rest-controls" }, [play, volume, volumeValue])]));
  }

  function formatMediaTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function mediaProviderLabel(provider) {
    const labels = { youtube: "YouTube", "vk-video": "VK Видео", rutube: "RuTube", twitch: "Twitch", vimeo: "Vimeo", "yandex-music": "Яндекс Музыка", spotify: "Spotify", "apple-music": "Apple Music", deezer: "Deezer", soundcloud: "SoundCloud" };
    return labels[provider] || "Браузерный плеер";
  }

  function panelIcon(name, size = 16) {
    const paths = {
      skipBack: [["path", "M7 6v12"], ["path", "m17 6-6 6 6 6"]],
      skipForward: [["path", "M17 6v12"], ["path", "m7 6 6 6-6 6"]],
      left: [["path", "m14 6-6 6 6 6"]], right: [["path", "m10 6 6 6-6 6"]],
      play: [["path", "m9 6 8 6-8 6Z"]], pause: [["path", "M9 6v12M15 6v12"]],
      swap: [["path", "M5 8h12l-3-3M19 16H7l3 3"]],
      volume: [["path", "M5 10h4l5-4v12l-5-4H5z"], ["path", "M17 9.5a4 4 0 0 1 0 5"], ["path", "M19.5 7a7.5 7.5 0 0 1 0 10"]],
      volumeOff: [["path", "M5 10h4l5-4v12l-5-4H5z"], ["path", "m17 10 4 4m0-4-4 4"]],
      external: [["path", "M14 5h5v5M19 5l-8 8"], ["path", "M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"]],
    };
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("width", String(size)); icon.setAttribute("height", String(size));
    icon.setAttribute("fill", "none"); icon.setAttribute("stroke", "currentColor"); icon.setAttribute("stroke-width", "1.7"); icon.setAttribute("stroke-linecap", "round"); icon.setAttribute("stroke-linejoin", "round"); icon.setAttribute("aria-hidden", "true");
    (paths[name] || paths.play).forEach(([tag, d]) => { const node = document.createElementNS("http://www.w3.org/2000/svg", tag); node.setAttribute("d", d); icon.append(node); });
    return icon;
  }

  function mediaWidget() {
    const source = element("strong", { className: "media-source" });
    const timeline = element("span", { className: "media-timeline", attrs: { "aria-live": "polite" } });
    const status = element("span", { className: "media-status" });
    const switchSource = element("button", { className: "media-icon-button", attrs: { type: "button", title: "Выбрать другой источник", "aria-label": "Выбрать другой источник" } }, [panelIcon("swap", 15)]);
    const locate = element("button", { className: "media-locate", text: "Найти воспроизведение", attrs: { type: "button" } });
    const previous = element("button", { className: "media-control", attrs: { type: "button", title: "Предыдущий трек", "aria-label": "Предыдущий трек" } }, [panelIcon("skipBack", 17)]);
    const back = element("button", { className: "media-control", attrs: { type: "button", title: "Назад на 5 секунд", "aria-label": "Назад на 5 секунд" } }, [panelIcon("left", 18)]);
    const toggle = element("button", { className: "media-control is-primary", attrs: { type: "button", title: "Воспроизвести или поставить на паузу", "aria-label": "Воспроизвести или поставить на паузу" } }, [panelIcon("play", 18)]);
    const forward = element("button", { className: "media-control", attrs: { type: "button", title: "Вперёд на 5 секунд", "aria-label": "Вперёд на 5 секунд" } }, [panelIcon("right", 18)]);
    const next = element("button", { className: "media-control", attrs: { type: "button", title: "Следующий трек", "aria-label": "Следующий трек" } }, [panelIcon("skipForward", 17)]);
    const volume = element("input", { className: "media-volume", attrs: { type: "range", min: "0", max: "100", step: "1", "aria-label": "Громкость воспроизведения" } });
    const mute = element("button", { className: "media-icon-button", attrs: { type: "button", title: "Выключить звук", "aria-label": "Выключить звук" } }, [panelIcon("volume", 16)]);
    const focus = element("button", { className: "media-icon-button", attrs: { type: "button", title: "Открыть вкладку с воспроизведением", "aria-label": "Открыть вкладку с воспроизведением" } }, [panelIcon("external", 16)]);
    const root = element("div", { className: "media-widget" }, [
      element("div", { className: "media-head" }, [element("span", { className: "media-kicker", text: "БРАУЗЕРНЫЙ ПЛЕЕР" }), element("div", { className: "media-head-actions" }, [status, focus, switchSource])]),
      element("div", { className: "media-now" }, [source, timeline]),
      locate,
      element("div", { className: "media-controls" }, [previous, back, toggle, forward, next]),
      element("div", { className: "media-footer" }, [element("div", { className: "media-volume-wrap" }, [mute, volume])]),
    ]);
    const sync = (snapshot = mediaSession, preserveSession = false) => {
      const keepSession = preserveSession && mediaSession?.found && !snapshot?.found;
      mediaSession = snapshot?.found
        ? { ...(mediaSession || {}), ...snapshot, sourceCount: Number(snapshot.sourceCount ?? mediaSession?.sourceCount ?? 1) }
        : keepSession ? { ...mediaSession, message: String(snapshot?.message || "Команда не подтверждена. Повторите попытку."), stale: true } : null;
      const found = Boolean(mediaSession?.found && Number.isInteger(mediaSession.tabId));
      root.classList.toggle("has-media", found);
      source.textContent = found ? String(mediaSession.title || mediaProviderLabel(mediaSession.provider)) : "Нет найденного воспроизведения";
      source.title = source.textContent;
      status.textContent = found ? (mediaSession.paused ? "ПАУЗА" : "В ЭФИРЕ") : "ОЖИДАНИЕ";
      const details = found ? (mediaSession.duration ? `${mediaProviderLabel(mediaSession.provider)} · ${formatMediaTime(mediaSession.currentTime)} / ${formatMediaTime(mediaSession.duration)}` : `${mediaProviderLabel(mediaSession.provider)} · ${mediaSession.message || "Прямой поток"}`) : String(snapshot?.message || "Нажмите кнопку, чтобы найти вкладку с видео или звуком.");
      timeline.textContent = found && mediaSession.sourceCount > 1 ? `${details} · ${mediaSession.sourceCount} источника` : details;
      toggle.replaceChildren(panelIcon(found && !mediaSession.paused ? "pause" : "play", 18));
      toggle.title = found && !mediaSession.paused ? "Поставить на паузу" : "Продолжить воспроизведение";
      toggle.setAttribute("aria-label", toggle.title);
      volume.value = String(Math.max(0, Math.min(100, Number(mediaSession?.volume ?? 100))));
      [previous, back, toggle, forward, next].forEach((node) => { node.disabled = false; });
      [volume, mute, focus].forEach((node) => { node.disabled = !found; });
      switchSource.disabled = !found || Number(mediaSession?.sourceCount || 1) < 2;
      switchSource.title = mediaSession?.sourceCount > 1 ? `Другой источник (${mediaSession.sourceCount})` : "Другой источник недоступен";
      switchSource.setAttribute("aria-label", switchSource.title);
      mute.replaceChildren(panelIcon(mediaSession?.muted ? "volumeOff" : "volume", 16));
      mute.title = mediaSession?.muted ? "Включить звук" : "Выключить звук";
      mute.setAttribute("aria-label", mute.title);
      locate.textContent = found ? "Обновить состояние" : "Найти воспроизведение";
    };
    const setBusy = (busy) => root.classList.toggle("is-busy", busy);
    const discover = async (cycle = false) => {
      setBusy(true);
      timeline.textContent = cycle ? "Ищем другой источник…" : "Ищем воспроизведение…";
      try {
        const response = await sendMediaMessage({ type: "mflt-web-panel-media-discover", session: mediaSession || {}, cycle, requestPermission: true });
        sync(response?.snapshot || { found: false, message: "Не удалось найти воспроизведение." });
      } finally { setBusy(false); }
    };
    const command = async (action, value = null) => {
      setBusy(true);
      timeline.textContent = "Обновляем источник воспроизведения…";
      try {
        const discovery = await sendMediaMessage({ type: "mflt-web-panel-media-discover", session: mediaSession || {}, cycle: false, requestPermission: true });
        sync(discovery?.snapshot || { found: false, message: "Не удалось найти воспроизведение." });
        if (!mediaSession) return;
        timeline.textContent = "Передаём команду…";
        const response = await sendMediaMessage({ type: "mflt-web-panel-media-command", session: mediaSession, action, value });
        sync(response?.snapshot || { found: false, message: "Команда не выполнена." }, true);
      } finally { setBusy(false); }
    };
    locate.addEventListener("click", () => discover(false));
    switchSource.addEventListener("click", () => discover(true));
    previous.addEventListener("click", () => command("previous")); back.addEventListener("click", () => command("seek", -5));
    toggle.addEventListener("click", () => command("toggle")); forward.addEventListener("click", () => command("seek", 5)); next.addEventListener("click", () => command("next"));
    mute.addEventListener("click", () => command("mute")); focus.addEventListener("click", () => command("focus"));
    let volumeTimer = 0;
    const sendVolume = () => command("volume", Number(volume.value));
    volume.addEventListener("input", () => { clearTimeout(volumeTimer); volumeTimer = window.setTimeout(sendVolume, 120); });
    volume.addEventListener("change", () => { clearTimeout(volumeTimer); sendVolume(); });
    sync();
    queueMicrotask(() => discover(false));
    return makeCard("media", root);
  }

  function makeCatalog() {
    const catalog = element("div", { attrs: { id: "catalog" }, className: catalogOpen ? "is-open" : "" });
    catalog.append(element("span", { className: "catalog-title", text: "Виджеты текущего рабочего стола" }));
    const visible = visibleWidgetTypes();
    Object.entries(WIDGET_LABELS).forEach(([type, label]) => {
      const checkbox = element("input", { attrs: { type: "checkbox", disabled: "" } });
      checkbox.checked = visible.includes(type);
      catalog.append(element("label", { className: "catalog-choice" }, [checkbox, element("span", { text: label })]));
    });
    catalog.append(element("p", { className: "catalog-hint", text: "Состав задаётся в настройках панели сайтов и сохраняется отдельно для каждого рабочего стола." }));
    return catalog;
  }

  function openPanelSettings() {
    const url = api?.runtime?.getURL?.("index.html#web-panel");
    if (url) window.open(url, "_blank");
  }

  function makeEmptyPanel() {
    const configure = element("button", { className: "empty-action", text: "Настроить панель", attrs: { type: "button" } });
    configure.addEventListener("click", openPanelSettings);
    return element("section", { className: "empty-panel", attrs: { "aria-label": "Панель пока пуста" } }, [
      element("span", { className: "empty-kicker", text: "ПАНЕЛЬ / ПУСТО" }),
      element("h2", { text: "Нет выбранных карточек" }),
      element("p", { text: "Для этого рабочего стола в панели сайтов пока нет виджетов. Выберите нужные карточки в настройках — состав сохраняется отдельно для каждого пространства." }),
      configure,
    ]);
  }

  function render() {
    const wasFocused = shadow.activeElement;
    const focusedId = wasFocused?.id || "";
    app.replaceChildren();
    const title = element("div", {}, [element("span", { className: "eyebrow", text: "Startspace" }), element("h1", { text: "Панель сайта" })]);
    const edit = element("button", { className: "icon-button", text: "+", attrs: { type: "button", title: "Показать виджеты текущего рабочего стола", "aria-label": "Показать виджеты текущего рабочего стола", "aria-pressed": String(catalogOpen) } });
    edit.addEventListener("click", () => { catalogOpen = !catalogOpen; render(); });
    const close = element("button", { className: "icon-button", text: "×", attrs: { type: "button", title: "Скрыть панель", "aria-label": "Скрыть панель" } });
    close.addEventListener("click", () => setOpen(false));
    app.append(element("header", { className: "header" }, [title, element("div", { className: "header-actions" }, [edit, close])]), makeCatalog());
    const grid = element("main", { attrs: { id: "widgets" } });
    const visibleWidgets = visibleWidgetTypes();
    if (!visibleWidgets.includes("rest") && restAudio) { restAudio.pause(); restAudio = null; restAudioSound = ""; }
    const renderers = { clock: clockWidget, tasks: tasksWidget, note: noteWidget, timer: timerWidget, stopwatch: stopwatchWidget, media: mediaWidget, weather: weatherWidget, translator: translatorWidget, rest: restWidget };
    visibleWidgets.forEach((type) => { if (renderers[type]) grid.append(renderers[type]()); });
    if (!visibleWidgets.length) grid.append(makeEmptyPanel());
    app.append(grid, element("footer", { className: "footer", text: "Наведите на край экрана · Esc скрывает панель" }));
    updateDynamicValues();
    if (focusedId) shadow.getElementById(focusedId)?.focus();
  }

  function applySettings(nextSettings) {
    settings = nextSettings && typeof nextSettings === "object" ? nextSettings : {};
    panelSettings = normalizePanel(settings.webPanel);
    const palette = currentPalette();
    host.dataset.edge = panelSettings.edge;
    host.dataset.material = panelSettings.panelMaterial;
    host.dataset.disabled = String(!panelSettings.enabled || panelSettings.hidden);
    host.style.setProperty("--mflt-width", `${panelSettings.width}px`);
    host.style.setProperty("--mflt-scale", String(panelSettings.scale / 100));
    host.style.setProperty("--mflt-browser-zoom", String(Math.max(0.5, Math.min(2, 1 / browserZoom))));
    host.style.setProperty("--mflt-font-scale", String(panelSettings.fontScale / 100));
    host.style.setProperty("--mflt-trigger", `${panelSettings.triggerSize}px`);
    const material = panelSettings.panelMaterial;
    const transparency = material === "opaque" ? 0 : panelSettings.transparency;
    const materialStyle = material === "acrylic"
      ? { panelOpacity: Math.max(42, 100 - transparency), cardOpacity: Math.max(44, 86 - transparency), blur: Math.round(14 + transparency * 0.22), saturation: "1.18", tint: "13%", sheen: "8%", cardTint: "9%", cardSheen: "6%", appTint: "11%" }
      : material === "blur"
        ? { panelOpacity: Math.max(34, 100 - transparency), cardOpacity: Math.max(38, 88 - transparency), blur: Math.round(9 + transparency * 0.18), saturation: "1.08", tint: "2%", sheen: "3%", cardTint: "2%", cardSheen: "2%", appTint: "8%" }
        : material === "transparent"
          ? { panelOpacity: Math.max(28, 100 - transparency), cardOpacity: Math.max(36, 90 - transparency), blur: 0, saturation: "1", tint: "0%", sheen: "0%", cardTint: "0%", cardSheen: "0%", appTint: "7%" }
          : { panelOpacity: 100, cardOpacity: 92, blur: 0, saturation: "1", tint: "0%", sheen: "0%", cardTint: "0%", cardSheen: "0%", appTint: "7%" };
    host.style.setProperty("--mflt-panel-opacity", `${materialStyle.panelOpacity}%`);
    host.style.setProperty("--mflt-card-opacity", `${materialStyle.cardOpacity}%`);
    host.style.setProperty("--mflt-backdrop-blur", `${materialStyle.blur}px`);
    host.style.setProperty("--mflt-backdrop-saturation", materialStyle.saturation);
    host.style.setProperty("--mflt-material-tint", materialStyle.tint);
    host.style.setProperty("--mflt-material-sheen", materialStyle.sheen);
    host.style.setProperty("--mflt-card-tint", materialStyle.cardTint);
    host.style.setProperty("--mflt-card-sheen", materialStyle.cardSheen);
    host.style.setProperty("--mflt-app-accent-tint", materialStyle.appTint);
    host.style.setProperty("--mflt-bg", palette.bg);
    host.style.setProperty("--mflt-strong", palette.strong);
    host.style.setProperty("--mflt-hover", palette.hover);
    host.style.setProperty("--mflt-text", palette.text);
    host.style.setProperty("--mflt-muted", palette.muted);
    host.style.setProperty("--mflt-line", palette.line);
    host.style.setProperty("--mflt-accent", palette.accent);
    host.style.setProperty("--mflt-contrast", palette.contrast);
    host.style.setProperty("--mflt-shadow", palette.shadow);
    if (!panelSettings.enabled) setOpen(false);
  }

  async function refreshBrowserZoom() {
    const response = await sendRuntimeMessage({ type: "mflt-web-panel-page-zoom" });
    const zoom = Number(response?.zoom);
    browserZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    applySettings(settings);
  }

  api.runtime?.onMessage?.addListener((message) => {
    if (message?.type === "mflt-web-panel-settings-update") {
      const previousWidgets = panelSettings.widgets;
      applySettings(message.settings || {});
      if (!sameWidgetTypes(previousWidgets, panelSettings.widgets)) render();
    }
    if (message?.type === "mflt-web-panel-theme-update" && message.palette) { sharedTheme = message.palette; applySettings(settings); }
  });

  api.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[LAYOUT_KEY]) {
      const previousCity = panelSettings.weatherCity;
      const previousWidgets = panelSettings.widgets;
      applySettings(changes[LAYOUT_KEY].newValue?.settings || {});
      if ((previousCity !== panelSettings.weatherCity && visibleWidgetTypes().includes("weather")) || !sameWidgetTypes(previousWidgets, panelSettings.widgets)) render();
    }
    if (changes[SHARED_THEME_KEY]) { sharedTheme = changes[SHARED_THEME_KEY].newValue || null; applySettings(settings); }
    if (changes[DATA_KEY]) {
      data = normalizeData(changes[DATA_KEY].newValue);
      render();
    }
  });

  window.addEventListener("error", (event) => recordContentDiagnostic("error", event.error?.message || event.message || "Ошибка контентной панели"), { capture: true });
  window.addEventListener("unhandledrejection", (event) => recordContentDiagnostic("error", event.reason?.message || event.reason || "Необработанное обещание контентной панели"));

  Promise.all([readStorage({ [LAYOUT_KEY]: null }), readStorage({ [DATA_KEY]: null }), readStorage({ [SHARED_THEME_KEY]: null })]).then(([layoutStore, dataStore, themeStore]) => {
    settings = layoutStore[LAYOUT_KEY]?.settings || {};
    sharedTheme = themeStore[SHARED_THEME_KEY] || null;
    data = normalizeData(dataStore[DATA_KEY]);
    applySettings(settings);
    render();
    refreshBrowserZoom();
    // В Vivaldi storage и content script могут стартовать в разном порядке.
    // Запрашиваем сохранённую палитру ещё и напрямую у service worker, чтобы
    // новая вкладка не оставалась на запасном оформлении до ручного действия.
    const recoverTheme = () => sendRuntimeMessage({ type: "mflt-web-panel-theme-read" }).then((response) => {
      if (response?.palette && typeof response.palette === "object") {
        sharedTheme = response.palette;
        applySettings(settings);
        return;
      }
      if (themeRecoveryAttempts++ < 2) window.setTimeout(recoverTheme, 700 + themeRecoveryAttempts * 500);
    }).catch(() => { if (themeRecoveryAttempts++ < 2) window.setTimeout(recoverTheme, 700 + themeRecoveryAttempts * 500); });
    recoverTheme();
    recordContentDiagnostic(panelSettings.enabled ? "ready" : "disabled", panelSettings.enabled ? "Панель создана и ожидает наведения к краю" : "Панель отключена в настройках");
  }).catch((error) => recordContentDiagnostic("error", error?.message || "Не удалось инициализировать панель"));

  // The desktop theme manager updates data attributes and CSS variables in place.
  // Observe those mutations so the panel changes colour at the same moment.
  new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === "data-theme" || record.attributeName === "style")) applySettings(settings);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });

  let zoomRefreshTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(zoomRefreshTimer);
    zoomRefreshTimer = window.setTimeout(refreshBrowserZoom, 120);
  });
  window.setInterval(updateDynamicValues, 1000);
})();
