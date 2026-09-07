import { element } from "../ui/dom.js";
import { getExchangeRate, getRssFeed, getWeather, translateText } from "../services/data-services.js";
import { getSystemMetrics } from "../services/system-metrics.js";
import { createLineIcon, weatherIconName } from "../ui/icons.js";
import { beginRequest, currentConfig, currentWidget, disposeTimer, isCurrentRequest, patchConfig, setStatus } from "./helpers.js";
let translationRequestSequence = 0;

function createWeather(widget, context) {
  const root = element("div", { className: "weather-widget widget-fill" }, [
    element("div", { className: "weather-main" }, [
      element("span", { className: "weather-icon", attrs: { "data-role": "icon", "aria-hidden": "true" } }, [createLineIcon("weather", { size: 31 })]),
      element("strong", { className: "weather-temp", attrs: { "data-role": "temperature" } }),
    ]),
    element("div", { className: "weather-location", attrs: { "data-role": "location" } }),
    element("div", { className: "widget-muted", attrs: { "data-role": "details" } }),
    element("div", { className: "widget-muted", attrs: { "data-role": "status" } }),
    element("button", { className: "text-action network-refresh-action weather-refresh-action", text: "Обновить", attrs: { type: "button", "data-role": "refresh", "aria-pressed": "false" } }),
  ]);
  root.querySelector("button").addEventListener("click", () => refreshWeather(context, widget.id, root));
  return root;
}
function formatSyncStatus(timestamp, stale, locale) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return "Ещё не обновлялось";
  const time = new Intl.DateTimeFormat(locale || "ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(Number(timestamp)));
  return `${stale ? "Кэшированные данные" : "Обновлено"}: ${time}`;
}

function networkError(context, root, title, error) {
  const message = error?.message || "Сервис временно недоступен.";
  if (root.__networkError === message) return;
  root.__networkError = message;
  context.notify?.({ title, message, type: "error" });
}

function updateWeather(root, widget, context) {
  const config = widget.config || {};
  const sourceSignature = `${String(config.city || "").trim()}|${config.latitude ?? ""}|${config.longitude ?? ""}`;
  if (root.__weatherSourceSignature && root.__weatherSourceSignature !== sourceSignature) {
    beginRequest(root, "__weatherRequest");
    root.__weatherSourceSignature = sourceSignature;
    root.__weatherInitialRefresh = false;
    patchConfig(context, widget.id, { last: null, error: "", lastUpdatedAt: 0 }, "weather-source-change");
    return;
  }
  root.__weatherSourceSignature = sourceSignature;
  const last = config.last;
  root.querySelector("[data-role='icon']").replaceChildren(createLineIcon(last ? weatherIconName(last.code) : "weather", { size: 31 }));
  root.querySelector("[data-role='temperature']").textContent = last ? `${last.temperature}°` : "—";
  root.querySelector("[data-role='location']").textContent = last?.location || config.city || "Укажите город в свойствах";
  root.querySelector("[data-role='details']").textContent = last ? `Ощущается как ${last.apparent}°, ветер ${last.wind} км/ч` : (config.error || "Данные появятся после обновления");
  setStatus(root, formatSyncStatus(config.lastUpdatedAt, last?.stale, context.locale()));
  configureWeatherAutoRefresh(root, widget, context);
}

function configureWeatherAutoRefresh(root, widget, context) {
  const config = widget.config || {};
  const enabled = config.autoRefresh !== false;
  const minutes = [15, 30, 60].includes(Number(config.refreshMinutes)) ? Number(config.refreshMinutes) : 30;
  const hasLocation = Boolean(String(config.city || "").trim()) || (Number.isFinite(Number(config.latitude)) && Number.isFinite(Number(config.longitude)) && (Number(config.latitude) !== 0 || Number(config.longitude) !== 0));
  const signature = `${enabled}:${minutes}:${hasLocation}`;
  if (root.__weatherRefreshSignature !== signature) {
    disposeTimer(root);
    root.__weatherRefreshSignature = signature;
    if (enabled && hasLocation) root.__timer = setInterval(() => refreshWeather(context, widget.id, root), minutes * 60 * 1000);
  }
  if (enabled && hasLocation && !config.last && !root.__weatherInitialRefresh) {
    root.__weatherInitialRefresh = true;
    refreshWeather(context, widget.id, root);
  }
}

async function refreshWeather(context, id, root) {
  const request = beginRequest(root, "__weatherRequest");
  const config = currentConfig(context, id);
  if (!currentWidget(context, id)) return;
  const refreshButton = root.querySelector("[data-role='refresh']");
  root.classList.add("is-refreshing");
  refreshButton?.classList.add("is-active");
  refreshButton?.setAttribute("aria-pressed", "true");
  if (refreshButton) refreshButton.disabled = true;
  setStatus(root, "Обновление…");
  try {
    const last = await getWeather(config);
    if (!isCurrentRequest(context, id, root, "__weatherRequest", request)) return;
    root.__networkError = "";
    patchConfig(context, id, { last, error: "", lastUpdatedAt: Date.now() }, "weather-refresh");
  } catch (error) {
    if (!isCurrentRequest(context, id, root, "__weatherRequest", request)) return;
    const message = error.message || "Не удалось получить погоду.";
    patchConfig(context, id, { error: message }, "weather-error");
    networkError(context, root, "Погода недоступна", error);
  } finally {
    if (isCurrentRequest(context, id, root, "__weatherRequest", request)) {
      root.classList.remove("is-refreshing");
      refreshButton?.classList.remove("is-active");
      refreshButton?.setAttribute("aria-pressed", "false");
      if (refreshButton) refreshButton.disabled = false;
    }
  }
}

function createCurrency(widget, context) {
  const amount = element("input", { className: "currency-amount-input", attrs: { type: "number", min: "0", step: "any", inputmode: "decimal", "data-role": "amount", "aria-label": "Сумма для конвертации" } });
  const swap = element("button", { className: "currency-swap", title: "Поменять валюты местами", attrs: { type: "button", "aria-label": "Поменять валюты местами" } }, [createLineIcon("arrowSwap", { size: 16 })]);
  const refresh = element("button", { className: "text-action network-refresh-action currency-refresh-action", text: "Обновить", attrs: { type: "button", "data-role": "refresh", "aria-pressed": "false" } });
  amount.addEventListener("input", () => patchConfig(context, widget.id, { amount: Math.max(0, Number(amount.value) || 0) }, "currency-amount"));
  swap.addEventListener("click", () => {
    const config = currentConfig(context, widget.id);
    patchConfig(context, widget.id, { base: config.quote || "RUB", quote: config.base || "USD", last: null, error: "" }, "currency-swap");
  });
  const root = element("div", { className: "currency-widget widget-fill" }, [
    element("div", { className: "currency-topline" }, [element("span", { className: "currency-label", text: "Конвертер валют" }), swap]),
    element("div", { className: "currency-conversion" }, [
      element("div", { className: "currency-from" }, [amount, element("strong", { attrs: { "data-role": "base" } })]),
      element("span", { className: "currency-arrow", attrs: { "aria-hidden": "true" } }, [createLineIcon("chevronRight", { size: 16 })]),
      element("output", { className: "currency-result", attrs: { "data-role": "result" } }),
    ]),
    element("div", { className: "currency-meta" }, [
      element("div", { className: "currency-rate-line", attrs: { "data-role": "rate" } }),
      element("div", { className: "widget-muted", attrs: { "data-role": "date" } }),
    ]),
    refresh,
  ]);
  refresh.addEventListener("click", () => refreshCurrency(context, widget.id, root));
  return root;
}
function updateCurrency(root, widget, context) {
  const config = widget.config || {};
  const sourceSignature = `${String(config.base || "USD").toUpperCase()}|${String(config.quote || "RUB").toUpperCase()}`;
  if (root.__currencySourceSignature && root.__currencySourceSignature !== sourceSignature) {
    beginRequest(root, "__currencyRequest");
    root.__currencySourceSignature = sourceSignature;
    root.__currencyInitialRefresh = false;
    patchConfig(context, widget.id, { last: null, error: "", lastUpdatedAt: 0 }, "currency-source-change");
    return;
  }
  root.__currencySourceSignature = sourceSignature;
  configureCurrencyAutoRefresh(root, widget, context);
  const base = String(config.base || "USD").toUpperCase();
  const quote = String(config.quote || "RUB").toUpperCase();
  const amount = Number.isFinite(Number(config.amount)) ? Number(config.amount) : 1;
  const input = root.querySelector("[data-role='amount']");
  if (document.activeElement !== input) input.value = String(amount);
  root.querySelector("[data-role='base']").textContent = base;
  const rate = Number(config.last?.rate);
  const result = Number.isFinite(rate) ? amount * rate : null;
  root.querySelector("[data-role='result']").textContent = result === null ? `— ${quote}` : `${result.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${quote}`;
  root.querySelector("[data-role='rate']").textContent = Number.isFinite(rate) ? `1 ${base} = ${rate.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ${quote}` : "Курс ещё не загружен";
  root.querySelector("[data-role='date']").textContent = config.last ? formatSyncStatus(config.lastUpdatedAt, config.last.stale, context.locale()) : (config.error || "Нажмите «Обновить», чтобы получить курс");
}
function configureCurrencyAutoRefresh(root, widget, context) {
  const config = widget.config || {};
  const enabled = config.autoRefresh !== false;
  const minutes = [15, 30, 60].includes(Number(config.refreshMinutes)) ? Number(config.refreshMinutes) : 15;
  const signature = `${enabled}:${minutes}`;
  if (root.__currencyRefreshSignature !== signature) {
    disposeTimer(root);
    root.__currencyRefreshSignature = signature;
    if (enabled) root.__timer = setInterval(() => refreshCurrency(context, widget.id, root), minutes * 60 * 1000);
  }
  if (enabled && !config.last && !root.__currencyInitialRefresh) {
    root.__currencyInitialRefresh = true;
    refreshCurrency(context, widget.id, root);
  }
}

async function refreshCurrency(context, id, root) {
  const request = beginRequest(root, "__currencyRequest");
  const config = currentConfig(context, id);
  if (!currentWidget(context, id)) return;
  const refreshButton = root.querySelector("[data-role='refresh']");
  root.classList.add("is-refreshing");
  refreshButton?.classList.add("is-active");
  refreshButton?.setAttribute("aria-pressed", "true");
  if (refreshButton) refreshButton.disabled = true;
  const status = root?.querySelector("[data-role='date']");
  if (status) status.textContent = "Обновление курса…";
  try {
    const last = await getExchangeRate(config.base, config.quote);
    if (!isCurrentRequest(context, id, root, "__currencyRequest", request)) return;
    root.__networkError = "";
    patchConfig(context, id, { last, error: "", lastUpdatedAt: Date.now() }, "currency-refresh");
  } catch (error) {
    if (!isCurrentRequest(context, id, root, "__currencyRequest", request)) return;
    const message = error.message || "Курс временно недоступен.";
    patchConfig(context, id, { error: message }, "currency-error");
    networkError(context, root, "Курсы валют недоступны", error);
  } finally {
    if (isCurrentRequest(context, id, root, "__currencyRequest", request)) {
      root.classList.remove("is-refreshing");
      refreshButton?.classList.remove("is-active");
      refreshButton?.setAttribute("aria-pressed", "false");
      if (refreshButton) refreshButton.disabled = false;
    }
  }
}

function translatorBytes(value) {
  return new TextEncoder().encode(String(value || "")).length;
}
function createTranslator(widget, context) {
  const input = element("textarea", { className: "translator-input", attrs: { placeholder: "Введите текст", maxlength: "1000", "aria-label": "Текст для перевода MyMemory" } });
  const output = element("textarea", { className: "translator-output", attrs: { readonly: "", placeholder: "Перевод появится здесь", "aria-label": "Перевод MyMemory" } });
  const status = element("span", { className: "translator-status", attrs: { "data-role": "status", "aria-live": "polite" } });
  const translate = element("button", { className: "primary-action", text: "Перевести", attrs: { type: "button", "data-role": "translate" } });
  translate.addEventListener("click", () => runTranslation(context, widget.id));
  input.addEventListener("input", () => patchConfig(context, widget.id, { text: input.value, translated: "", error: "", api: null }, "translation-input"));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); runTranslation(context, widget.id); }
  });
  return element("div", { className: "translator-widget widget-fill" }, [input, output, element("div", { className: "translator-footer" }, [status, translate])]);
}
function updateTranslator(root, widget) {
  const translatorRoute = widget.config || {};
  let direction = root.querySelector(".translator-direction");
  if (!direction) {
    direction = element("p", { className: "translator-direction", attrs: { "data-role": "direction" } });
    root.prepend(direction);
  }
  const languageNames = { ru: "Русский", en: "Английский", de: "Немецкий", fr: "Французский", es: "Испанский" };
  const from = translatorRoute.from || "ru";
  const to = translatorRoute.to || "en";
  const routeSignature = `${from}:${to}`;
  if (root.__translatorRouteSignature && root.__translatorRouteSignature !== routeSignature && (translatorRoute.translated || translatorRoute.error || translatorRoute.api)) {
    root.__translatorRouteSignature = routeSignature;
    patchConfig(context, widget.id, { translated: "", error: "", api: null }, "translation-route-change");
    return;
  }
  root.__translatorRouteSignature = routeSignature;
  direction.textContent = `${languageNames[from] || from} → ${languageNames[to] || to}`;
  const config = widget.config || {};
  const input = root.querySelector(".translator-input");
  if (document.activeElement !== input) input.value = String(config.text || "");
  root.querySelector(".translator-output").value = String(config.translated || config.error || "");
  const status = root.querySelector("[data-role='status']");
  const bytes = translatorBytes(config.text);
  const api = config.api || {};
  const match = Number(api.match);
  if (config.error) status.textContent = `MyMemory · ${config.error}`;
  else if (api.pending) status.textContent = "MyMemory · перевод…";
  else if (api.provider === "MyMemory" && Number.isFinite(match)) status.textContent = `${api.status || "MyMemory"} · совпадение ${Math.round(match * 100)}%`;
  else status.textContent = `MyMemory · ${bytes}/500 байт`;
  const translate = root.querySelector("[data-role='translate']");
  if (translate) translate.disabled = Boolean(api.pending);
}
async function runTranslation(context, id) {
  const config = currentConfig(context, id);
  if (!currentWidget(context, id)) return;
  const text = String(config.text || "").trim();
  if (!text) {
    patchConfig(context, id, { translated: "", error: "Введите текст для перевода.", api: null }, "translation-empty");
    return;
  }
  if (translatorBytes(text) > 500) {
    patchConfig(context, id, { translated: "", error: "Сократите текст до 500 байт.", api: null }, "translation-too-long");
    return;
  }
  const requestId = `translation-${++translationRequestSequence}`;
  patchConfig(context, id, { error: "", api: { provider: "MyMemory", pending: true, requestId } }, "translation-pending");
  try {
    const result = await translateText(text, config.from || "ru", config.to || "en");
    const latest = currentWidget(context, id);
    if (!latest || latest.config?.api?.requestId !== requestId || latest.config?.text !== config.text || latest.config?.from !== config.from || latest.config?.to !== config.to) return;
    patchConfig(context, id, { translated: result.text, error: "", api: { ...result, pending: false, updatedAt: Date.now() } }, "translation");
  } catch (error) {
    const latest = currentWidget(context, id);
    if (!latest || latest.config?.api?.requestId !== requestId || latest.config?.text !== config.text || latest.config?.from !== config.from || latest.config?.to !== config.to) return;
    patchConfig(context, id, { error: error.message || "Перевод недоступен.", api: { provider: "MyMemory", pending: false } }, "translation-error");
  }
}

function formatFeedTime(timestamp, locale) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return "";
  return new Intl.DateTimeFormat(locale || "ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(Number(timestamp)));
}

function feedLabel(url) {
  try { return new URL(String(url || "")).hostname.replace(/^www\./i, ""); } catch { return "RSS-лента"; }
}

function createRss(widget, context) {
  const refresh = element("button", { className: "text-action network-refresh-action rss-refresh-action", text: "Обновить", attrs: { type: "button", "data-role": "refresh", "aria-pressed": "false" } });
  const root = element("div", { className: "rss-widget widget-fill" }, [
    element("div", { className: "rss-topline" }, [element("span", { className: "rss-source", attrs: { "data-role": "source" } }, [createLineIcon("rss", { size: 15 })]), refresh]),
    element("div", { className: "rss-list", attrs: { "data-role": "list" } }),
    element("div", { className: "widget-muted rss-status", attrs: { "data-role": "status" } }),
  ]);
  refresh.addEventListener("click", () => refreshRss(context, widget.id, root));
  return root;
}

function updateRss(root, widget, context) {
  const config = widget.config || {};
  const source = String(config.url || "").trim();
  const signature = `${source}|${config.limit || 5}`;
  if (root.__rssSignature && root.__rssSignature !== signature) {
    beginRequest(root, "__rssRequest");
    root.__rssSignature = signature;
    root.__rssInitialRefresh = false;
    patchConfig(context, widget.id, { items: [], error: "", lastUpdatedAt: 0 }, "rss-source-change");
    return;
  }
  root.__rssSignature = signature;
  root.querySelector("[data-role='source']").replaceChildren(createLineIcon("rss", { size: 15 }), document.createTextNode(` ${feedLabel(source)}`));
  const list = root.querySelector("[data-role='list']");
  list.replaceChildren();
  const items = Array.isArray(config.items) ? config.items : [];
  items.forEach((item) => {
    const link = element("a", { className: "rss-item", attrs: { href: item.url, target: "_blank", rel: "noopener noreferrer", title: item.title } }, [
      element("strong", { text: item.title }),
      element("span", { text: formatFeedTime(item.publishedAt, context.locale()) || item.summary || "Открыть публикацию" }),
    ]);
    list.append(link);
  });
  if (!items.length) list.append(element("div", { className: "rss-empty", text: config.error || "Лента загрузится автоматически" }));
  setStatus(root, config.lastUpdatedAt ? formatSyncStatus(config.lastUpdatedAt, config.stale, context.locale()) : (config.error || "Ожидание данных"));
  configureRssAutoRefresh(root, widget, context);
}

function configureRssAutoRefresh(root, widget, context) {
  const config = widget.config || {};
  const enabled = config.autoRefresh !== false;
  const minutes = [5, 15, 30, 60].includes(Number(config.refreshMinutes)) ? Number(config.refreshMinutes) : 15;
  const hasSource = /^https?:\/\//i.test(String(config.url || "").trim());
  const signature = `${enabled}:${minutes}:${hasSource}`;
  if (root.__rssRefreshSignature !== signature) {
    disposeTimer(root);
    root.__rssRefreshSignature = signature;
    if (enabled && hasSource) root.__timer = setInterval(() => refreshRss(context, widget.id, root), minutes * 60 * 1000);
  }
  if (enabled && hasSource && !(config.items || []).length && !root.__rssInitialRefresh) {
    root.__rssInitialRefresh = true;
    refreshRss(context, widget.id, root);
  }
}

async function refreshRss(context, id, root) {
  const request = beginRequest(root, "__rssRequest");
  const config = currentConfig(context, id);
  const refresh = root.querySelector("[data-role='refresh']");
  if (refresh) { refresh.disabled = true; refresh.setAttribute("aria-pressed", "true"); }
  setStatus(root, "Загрузка ленты…");
  try {
    const result = await getRssFeed(config.url, config.limit || 5);
    if (!isCurrentRequest(context, id, root, "__rssRequest", request)) return;
    root.__networkError = "";
    patchConfig(context, id, { items: result.items, stale: result.stale, error: "", lastUpdatedAt: Date.now() }, "rss-refresh");
  } catch (error) {
    if (!isCurrentRequest(context, id, root, "__rssRequest", request)) return;
    const message = error?.message || "RSS-лента недоступна.";
    patchConfig(context, id, { error: message }, "rss-error");
    networkError(context, root, "RSS-лента недоступна", error);
  } finally {
    if (isCurrentRequest(context, id, root, "__rssRequest", request) && refresh) { refresh.disabled = false; refresh.setAttribute("aria-pressed", "false"); }
  }
}

function hasMetricValue(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function metricValue(value, suffix = "%") {
  return hasMetricValue(value) ? `${Math.round(Number(value))}${suffix}` : "—";
}

function createSystemMonitor(widget, context) {
  const refresh = element("button", { className: "text-action network-refresh-action system-refresh-action", text: "Обновить", attrs: { type: "button", "data-role": "refresh", "aria-pressed": "false" } });
  const root = element("div", { className: "system-monitor-widget widget-fill" }, [
    element("div", { className: "system-topline" }, [element("span", { className: "system-title" }, [createLineIcon("system", { size: 16 }), document.createTextNode(" Загрузка ПК")]), refresh]),
    element("div", { className: "system-metrics" }, [
      element("div", { className: "system-metric", attrs: { "data-metric": "cpu" } }, [element("span", { text: "CPU" }), element("strong", { text: "—" }), element("i")]),
      element("div", { className: "system-metric", attrs: { "data-metric": "memory" } }, [element("span", { text: "Память" }), element("strong", { text: "—" }), element("i")]),
      element("div", { className: "system-metric", attrs: { "data-metric": "disk" } }, [element("span", { text: "Диск" }), element("strong", { text: "—" }), element("i")]),
    ]),
    element("div", { className: "widget-muted system-details", attrs: { "data-role": "details" } }),
    element("div", { className: "widget-muted system-status", attrs: { "data-role": "status" } }),
  ]);
  refresh.addEventListener("click", () => refreshSystemMonitor(context, widget.id, root));
  return root;
}

function updateSystemMonitor(root, widget, context) {
  const config = widget.config || {};
  const last = config.last || {};
  const metric = (name, value) => {
    const item = root.querySelector(`[data-metric='${name}']`);
    if (!item) return;
    const available = hasMetricValue(value);
    item.querySelector("strong").textContent = metricValue(value);
    item.querySelector("i").style.setProperty("--metric-value", `${available ? Math.max(0, Math.min(100, Number(value))) : 0}%`);
    item.classList.toggle("is-unavailable", !available);
  };
  metric("cpu", last.cpu);
  metric("memory", last.memory);
  metric("disk", last.disk);
  const memory = hasMetricValue(last.memoryUsedGiB) && hasMetricValue(last.memoryTotalGiB) ? `${last.memoryUsedGiB}/${last.memoryTotalGiB} ГБ ОЗУ` : "ОЗУ недоступно";
  const disk = hasMetricValue(last.diskUsedGiB) && hasMetricValue(last.diskTotalGiB) ? ` · ${last.diskUsedGiB}/${last.diskTotalGiB} ГБ диска` : "";
  const cores = last.cores ? ` · ${last.cores} потоков` : "";
  root.querySelector("[data-role='details']").textContent = `${memory}${disk}${cores}`;
  const status = last.error ? `${last.source || "Система"} · ${last.error}` : (config.lastUpdatedAt ? `${last.source || "Система"} · ${formatSyncStatus(config.lastUpdatedAt, false, context.locale())}` : (config.error || "Измерение загрузки…"));
  setStatus(root, status);
  configureSystemAutoRefresh(root, widget, context);
}

function configureSystemAutoRefresh(root, widget, context) {
  const config = widget.config || {};
  const enabled = config.autoRefresh !== false;
  const seconds = [2, 5, 10, 30].includes(Number(config.refreshSeconds)) ? Number(config.refreshSeconds) : 5;
  const signature = `${enabled}:${seconds}`;
  if (root.__systemRefreshSignature !== signature) {
    disposeTimer(root);
    root.__systemRefreshSignature = signature;
    if (enabled) root.__timer = setInterval(() => refreshSystemMonitor(context, widget.id, root), seconds * 1000);
  }
  if (!config.last && !root.__systemInitialRefresh) {
    root.__systemInitialRefresh = true;
    refreshSystemMonitor(context, widget.id, root);
  }
}

async function refreshSystemMonitor(context, id, root) {
  const request = beginRequest(root, "__systemRequest");
  const config = currentConfig(context, id);
  const refresh = root.querySelector("[data-role='refresh']");
  if (refresh) { refresh.disabled = true; refresh.setAttribute("aria-pressed", "true"); }
  try {
    const last = await getSystemMetrics(config.last || null);
    if (!isCurrentRequest(context, id, root, "__systemRequest", request)) return;
    patchConfig(context, id, { last, error: last.error || "", lastUpdatedAt: Date.now() }, "system-metrics-refresh");
  } catch (error) {
    if (!isCurrentRequest(context, id, root, "__systemRequest", request)) return;
    patchConfig(context, id, { error: error?.message || "Показатели ПК недоступны." }, "system-metrics-error");
  } finally {
    if (isCurrentRequest(context, id, root, "__systemRequest", request) && refresh) { refresh.disabled = false; refresh.setAttribute("aria-pressed", "false"); }
  }
}

export const networkDefinitions = [
  { type: "weather", title: "Погода", icon: "weather", category: "Данные", accent: "#d9b45f", defaultSize: { w: 300, h: 230 }, defaultConfig: { city: "", latitude: null, longitude: null, last: null, error: "", lastUpdatedAt: 0, autoRefresh: true, refreshMinutes: 30 }, properties: [{ key: "city", label: "Город", section: "Местоположение", type: "text", hint: "Например: Москва" }, { key: "latitude", label: "Широта", section: "Местоположение", type: "number" }, { key: "longitude", label: "Долгота", section: "Местоположение", type: "number" }, { key: "autoRefresh", label: "Автообновление", section: "Обновление", type: "toggle" }, { key: "refreshMinutes", label: "Интервал", section: "Обновление", type: "select", options: [{ value: "15", label: "Каждые 15 минут" }, { value: "30", label: "Каждые 30 минут" }, { value: "60", label: "Каждый час" }] }], create: createWeather, update: updateWeather, dispose: disposeTimer },
  { type: "currency", title: "Курсы валют", icon: "currency", category: "Данные", accent: "#93d7bb", defaultSize: { w: 340, h: 235 }, defaultConfig: { base: "USD", quote: "RUB", amount: 1, last: null, error: "", lastUpdatedAt: 0, autoRefresh: true, refreshMinutes: 15 }, properties: [{ key: "base", label: "Базовая валюта", section: "Валютная пара", type: "text", maxLength: 3 }, { key: "quote", label: "Целевая валюта", section: "Валютная пара", type: "text", maxLength: 3 }, { key: "autoRefresh", label: "Автообновление", section: "Обновление", type: "toggle" }, { key: "refreshMinutes", label: "Интервал", section: "Обновление", type: "select", options: [{ value: "15", label: "Каждые 15 минут" }, { value: "30", label: "Каждые 30 минут" }, { value: "60", label: "Каждый час" }] }], create: createCurrency, update: updateCurrency, dispose: disposeTimer },
  { type: "translator", title: "Переводчик", icon: "translate", category: "Данные", accent: "#e1b8ff", defaultSize: { w: 360, h: 320 }, minSize: { w: 280, h: 250 }, defaultConfig: { text: "", translated: "", from: "ru", to: "en", error: "", api: null }, properties: [{ key: "from", label: "С какого языка", section: "Языки", type: "select", options: [{ value: "ru", label: "Русский" }, { value: "en", label: "Английский" }, { value: "de", label: "Немецкий" }, { value: "fr", label: "Французский" }, { value: "es", label: "Испанский" }] }, { key: "to", label: "На какой язык", section: "Языки", type: "select", options: [{ value: "en", label: "Английский" }, { value: "ru", label: "Русский" }, { value: "de", label: "Немецкий" }, { value: "fr", label: "Французский" }, { value: "es", label: "Испанский" }] }], create: createTranslator, update: updateTranslator },
  { type: "rss", title: "RSS-лента", icon: "rss", category: "Данные", accent: "#ff9d62", defaultSize: { w: 360, h: 330 }, minSize: { w: 280, h: 220 }, defaultConfig: { url: "https://lenta.ru/rss", limit: 5, items: [], stale: false, error: "", lastUpdatedAt: 0, autoRefresh: true, refreshMinutes: 15 }, properties: [{ key: "url", label: "URL RSS или Atom", section: "Источник", type: "url", maxLength: 600, hint: "Вставьте прямую ссылку на XML-ленту сайта." }, { key: "limit", label: "Публикаций", section: "Отображение", type: "select", options: [{ value: "3", label: "3 публикации" }, { value: "5", label: "5 публикаций" }, { value: "7", label: "7 публикаций" }, { value: "10", label: "10 публикаций" }, { value: "15", label: "15 публикаций" }, { value: "20", label: "20 публикаций" }] }, { key: "autoRefresh", label: "Автообновление", section: "Обновление", type: "toggle" }, { key: "refreshMinutes", label: "Интервал", section: "Обновление", type: "select", options: [{ value: "5", label: "Каждые 5 минут" }, { value: "15", label: "Каждые 15 минут" }, { value: "30", label: "Каждые 30 минут" }, { value: "60", label: "Каждый час" }] }], create: createRss, update: updateRss, dispose: disposeTimer },
  { type: "system-monitor", title: "Загрузка ПК", icon: "system", category: "Инструменты", accent: "#79d8ff", defaultSize: { w: 330, h: 260 }, minSize: { w: 270, h: 210 }, defaultConfig: { last: null, error: "", lastUpdatedAt: 0, autoRefresh: true, refreshSeconds: 5 }, properties: [{ key: "autoRefresh", label: "Автообновление", section: "Обновление", type: "toggle" }, { key: "refreshSeconds", label: "Интервал", section: "Обновление", type: "select", options: [{ value: "2", label: "Каждые 2 секунды" }, { value: "5", label: "Каждые 5 секунд" }, { value: "10", label: "Каждые 10 секунд" }, { value: "30", label: "Каждые 30 секунд" }] }], create: createSystemMonitor, update: updateSystemMonitor, dispose: disposeTimer },
];
