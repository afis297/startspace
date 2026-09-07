import { callExtensionApi, extensionUrl, getExtensionApi } from "../services/extension-api.js";
import { controlBrowserMedia, discoverBrowserMedia, ensureBrowserMediaPermission, focusBrowserMediaTab } from "../services/browser-media-controller.js";

const api = getExtensionApi();
const workspaceUrl = extensionUrl("index.html");
const WEB_PANEL_FILE = "src/overlay/web-panel.js";
const DIAGNOSTICS_KEY = "mfltWebPanelInjectionDiagnosticsV1";
const WEB_PANEL_THEME_KEY = "mfltWebPanelThemeV1";
const WEB_PANEL_THEME_FIELDS = Object.freeze(["bg", "strong", "hover", "text", "muted", "line", "accent", "contrast", "shadow"]);

function canInjectInto(url) {
  return /^(https?|file):/i.test(String(url || ""));
}

function originLabel(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "file:" ? "локальный файл" : parsed.origin;
  } catch {
    return "адрес недоступен";
  }
}

async function saveDiagnostics(value) {
  const storage = api?.storage?.local;
  if (!storage) return;
  try {
    await callExtensionApi(storage.set, storage, [{ [DIAGNOSTICS_KEY]: value }]);
  } catch {
    // Diagnostics must never interfere with normal panel injection.
  }
}

async function injectWebPanel(tab) {
  const origin = originLabel(tab?.url);
  if (!Number.isInteger(tab?.id) || !canInjectInto(tab.url)) {
    return { tabId: Number.isInteger(tab?.id) ? tab.id : null, origin, status: "skipped", detail: "Служебная или защищённая страница браузера" };
  }
  try {
    await callExtensionApi(api?.scripting?.executeScript, api?.scripting, [{
      target: { tabId: tab.id, allFrames: false },
      files: [WEB_PANEL_FILE],
    }]);
    return { tabId: tab.id, origin, status: "injected", detail: "Скрипт передан во вкладку" };
  } catch (error) {
    return { tabId: tab.id, origin, status: "error", detail: String(error?.message || error || "Неизвестная ошибка").slice(0, 220) };
  }
}

async function injectWebPanelIntoOpenTabs(reason = "manual") {
  try {
    const tabs = await callExtensionApi(api?.tabs?.query, api?.tabs, [{}]);
    const results = await Promise.all((tabs || []).map(injectWebPanel));
    const injected = results.filter((item) => item.status === "injected").length;
    const failed = results.filter((item) => item.status === "error").length;
    const diagnostics = {
      updatedAt: new Date().toISOString(),
      lastRun: { reason, total: results.length, injected, failed, skipped: results.length - injected - failed },
      entries: results.slice(-12),
    };
    await saveDiagnostics(diagnostics);
    return diagnostics;
  } catch (error) {
    const diagnostics = {
      updatedAt: new Date().toISOString(),
      lastRun: { reason, total: 0, injected: 0, failed: 1, skipped: 0 },
      entries: [{ tabId: null, origin: "неизвестно", status: "error", detail: String(error?.message || error || "Не удалось запросить вкладки").slice(0, 220) }],
    };
    await saveDiagnostics(diagnostics);
    return diagnostics;
  }
}

api?.action?.onClicked?.addListener(() => {
  callExtensionApi(api.tabs?.create, api.tabs, [{ url: workspaceUrl, active: true }]).catch((error) => {
    console.error("Не удалось открыть рабочий стол расширения.", error);
  });
});

// Reloading an unpacked extension does not reload every already-opened tab.
// This path makes the panel available immediately after a reload.
api?.runtime?.onInstalled?.addListener(() => { injectWebPanelIntoOpenTabs("extension-reload"); });
api?.runtime?.onStartup?.addListener(() => { injectWebPanelIntoOpenTabs("browser-start"); });
// Vivaldi может запускать content script позже события создания вкладки. Повторная
// отправка уже сохранённой палитры после полной загрузки делает оформление панели
// независимым от порядка запуска storage и service worker.
api?.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  // Внедряем актуальный файл явно: это не позволяет Chromium/Vivaldi оставить
  // старый content script в уже существующей вкладке после обновления расширения.
  injectWebPanel(tab).catch(() => undefined).finally(() => sendWebPanelThemeToTab(tabId, tab?.url).catch(() => undefined));
});

async function broadcastWebPanelSettings(settings) {
  const tabs = await callExtensionApi(api?.tabs?.query, api?.tabs, [{}]);
  const eligible = (tabs || []).filter((tab) => Number.isInteger(tab.id) && canInjectInto(tab.url));
  const results = await Promise.allSettled(
    eligible.map((tab) => callExtensionApi(api?.tabs?.sendMessage, api?.tabs, [tab.id, { type: "mflt-web-panel-settings-update", settings }]))
  );
  return { sent: results.filter((result) => result.status === "fulfilled").length, total: eligible.length };
}

function normalizeWebPanelPalette(value) {
  if (!value || typeof value !== "object") return null;
  const palette = Object.fromEntries(WEB_PANEL_THEME_FIELDS.map((field) => [field, typeof value[field] === "string" ? value[field].trim() : ""]));
  return WEB_PANEL_THEME_FIELDS.every((field) => palette[field]) ? palette : null;
}

async function readWebPanelTheme() {
  const storage = api?.storage?.local;
  if (!storage) return null;
  try {
    const values = await callExtensionApi(storage.get, storage, [[WEB_PANEL_THEME_KEY]]);
    return normalizeWebPanelPalette(values?.[WEB_PANEL_THEME_KEY]);
  } catch { return null; }
}

async function sendWebPanelThemeToTab(tabId, url, value = null) {
  if (!Number.isInteger(tabId) || !canInjectInto(url)) return false;
  const palette = normalizeWebPanelPalette(value) || await readWebPanelTheme();
  if (!palette) return false;
  try {
    await callExtensionApi(api?.tabs?.sendMessage, api?.tabs, [tabId, { type: "mflt-web-panel-theme-update", palette }]);
    return true;
  } catch { return false; }
}

async function broadcastWebPanelTheme(value) {
  const palette = normalizeWebPanelPalette(value);
  if (!palette) return { sent: 0, total: 0, invalid: true };
  const tabs = await callExtensionApi(api?.tabs?.query, api?.tabs, [{}]);
  const eligible = (tabs || []).filter((tab) => Number.isInteger(tab.id) && canInjectInto(tab.url));
  const results = await Promise.all(eligible.map(async (tab) => (await sendWebPanelThemeToTab(tab.id, tab.url, palette) ? 1 : 0)));
  return { sent: results.reduce((sum, item) => sum + item, 0), total: eligible.length, invalid: false };
}

async function collectSystemMetrics() {
  const system = api?.system;
  if (!system?.cpu?.getInfo || !system?.memory?.getInfo) {
    throw new Error("Системные показатели не поддерживаются этим браузером.");
  }
  const [cpuInfo, memoryInfo, rawStorageInfo] = await Promise.all([
    callExtensionApi(system.cpu.getInfo, system.cpu),
    callExtensionApi(system.memory.getInfo, system.memory),
    system.storage?.getInfo ? callExtensionApi(system.storage.getInfo, system.storage).catch(() => []) : Promise.resolve([]),
  ]);
  const storageInfo = await Promise.all((Array.isArray(rawStorageInfo) ? rawStorageInfo : []).map(async (unit) => {
    if (!unit?.id || !system.storage?.getAvailableCapacity) return { ...unit, availableCapacity: null };
    try {
      const available = await callExtensionApi(system.storage.getAvailableCapacity, system.storage, [unit.id]);
      return { ...unit, availableCapacity: Number(available?.availableCapacity) || null };
    } catch {
      return { ...unit, availableCapacity: null };
    }
  }));
  return { cpuInfo, memoryInfo, storageInfo };
}

async function resolveWebPanelMediaRequest(message) {
  if (message?.type === "mflt-web-panel-media-discover") {
    let snapshot = await discoverBrowserMedia({ ...(message.session || {}), cycle: Boolean(message.cycle), forceRefresh: !message.cycle });
    if (snapshot.permissionRequired && message.requestPermission) {
      const permission = await ensureBrowserMediaPermission();
      snapshot = permission.granted ? await discoverBrowserMedia({ ...(message.session || {}), cycle: Boolean(message.cycle), forceRefresh: !message.cycle }) : { found: false, message: permission.message || "Доступ к медиавкладкам не предоставлен." };
    }
    return { ok: true, snapshot };
  }
  if (message?.type === "mflt-web-panel-media-command") {
    const session = message.session || {};
    const snapshot = message.action === "focus"
      ? { ...session, found: Boolean(await focusBrowserMediaTab(session.tabId)), message: "" }
      : await controlBrowserMedia(session.tabId, message.action, message.value ?? null, session.frameId, session.mediaKey);
    if (message.action === "focus") snapshot.message = snapshot.found ? "Вкладка с воспроизведением открыта." : "Не удалось открыть вкладку с воспроизведением.";
    return { ok: true, snapshot };
  }
  return { ok: false, snapshot: { found: false, message: "Неизвестная команда медиапанели." } };
}

api?.runtime?.onConnect?.addListener((port) => {
  if (port.name === "mflt-system-metrics") {
    port.onMessage.addListener((message) => {
      if (message?.type !== "mflt-system-metrics") return;
      collectSystemMetrics()
        .then((metrics) => port.postMessage({ ok: true, metrics }))
        .catch((error) => port.postMessage({ ok: false, error: error?.message || "Не удалось получить показатели ПК." }));
    });
    return;
  }
  if (port.name !== "mflt-web-panel-media") return;
  port.onMessage.addListener((message) => {
    resolveWebPanelMediaRequest(message)
      .then((response) => port.postMessage(response))
      .catch((error) => port.postMessage({ ok: false, snapshot: { found: false, message: error?.message || "Не удалось выполнить команду медиаплеера." } }));
  });
});

api?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (message?.type === "mflt-system-metrics") {
    collectSystemMetrics().then(
      (metrics) => sendResponse({ ok: true, metrics }),
      (error) => sendResponse({ ok: false, error: error?.message || "Не удалось получить показатели ПК." }),
    );
    return true;
  }
  if (message?.type === "mflt-web-panel-theme-publish") {
    broadcastWebPanelTheme(message.palette).then((result) => sendResponse({ ok: !result.invalid, ...result }), () => sendResponse({ ok: false, sent: 0, total: 0 }));
    return true;
  }
  if (message?.type === "mflt-web-panel-theme-read") {
    readWebPanelTheme().then((palette) => sendResponse({ ok: Boolean(palette), palette }), () => sendResponse({ ok: false, palette: null }));
    return true;
  }
  if (message?.type === "mflt-web-panel-settings-update") {
    broadcastWebPanelSettings(message.settings || {}).then((result) => sendResponse({ ok: true, ...result }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "mflt-web-panel-page-zoom") {
    (async () => {
      let tabId = _sender?.tab?.id;
      if (!Number.isInteger(tabId)) {
        const activeTabs = await callExtensionApi(api?.tabs?.query, api?.tabs, [{ active: true, lastFocusedWindow: true }]);
        tabId = activeTabs?.[0]?.id;
      }
      const zoom = Number.isInteger(tabId) ? await callExtensionApi(api?.tabs?.getZoom, api?.tabs, [tabId]) : 1;
      sendResponse({ ok: true, zoom: Number.isFinite(Number(zoom)) && Number(zoom) > 0 ? Number(zoom) : 1 });
    })().catch(() => sendResponse({ ok: true, zoom: 1 }));
    return true;
  }
  if (message?.type === "mflt-web-panel-reinject") {
    injectWebPanelIntoOpenTabs("settings-button").then((diagnostics) => sendResponse({ ok: true, diagnostics }));
    return true;
  }
  if (message?.type === "mflt-web-panel-media-discover") {
    (async () => {
      let snapshot = await discoverBrowserMedia({ ...(message.session || {}), cycle: Boolean(message.cycle), forceRefresh: !message.cycle });
      if (snapshot.permissionRequired && message.requestPermission) {
        const permission = await ensureBrowserMediaPermission();
        snapshot = permission.granted ? await discoverBrowserMedia({ ...(message.session || {}), cycle: Boolean(message.cycle), forceRefresh: !message.cycle }) : { found: false, message: permission.message || "Доступ к медиавкладкам не предоставлен." };
      }
      sendResponse({ ok: true, snapshot });
    })().catch((error) => sendResponse({ ok: false, snapshot: { found: false, message: error?.message || "Не удалось найти воспроизведение." } }));
    return true;
  }
  if (message?.type === "mflt-web-panel-media-command") {
    (async () => {
      const session = message.session || {};
      let snapshot;
      if (message.action === "focus") {
        const focused = await focusBrowserMediaTab(session.tabId);
        snapshot = { ...session, found: Boolean(focused), message: focused ? "Вкладка с воспроизведением открыта." : "Не удалось открыть вкладку с воспроизведением." };
      } else {
        snapshot = await controlBrowserMedia(session.tabId, message.action, message.value ?? null, session.frameId, session.mediaKey);
      }
      sendResponse({ ok: true, snapshot });
    })().catch((error) => sendResponse({ ok: false, snapshot: { found: false, message: error?.message || "Команда воспроизведения не выполнена." } }));
    return true;
  }
  return undefined;
});
