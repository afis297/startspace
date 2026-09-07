import { hasWidgetPermissions } from "../services/permissions.js";
import { hasBrowserMediaPermission } from "../services/browser-media-controller.js";

const widgetOfType = (state, type) => (state.widgets || []).filter((widget) => widget.type === type);
const latestConfig = (widgets) => widgets.reduce((latest, widget) => {
  const timestamp = Number(widget?.config?.lastUpdatedAt || widget?.config?.api?.updatedAt || 0);
  const latestTimestamp = Number(latest?.lastUpdatedAt || latest?.api?.updatedAt || 0);
  return timestamp >= latestTimestamp ? (widget?.config || {}) : latest;
}, null);

function formatTime(timestamp, locale) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return "ещё не обновлялось";
  return new Intl.DateTimeFormat(locale || "ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(Number(timestamp)));
}

function entry(id, label, kind, detail, action) {
  return action === undefined ? { id, label, kind, detail } : { id, label, kind, detail, action };
}

function networkStatus({ id, label, widgets, config, permission, locale }) {
  if (!widgets.length) return entry(id, label, "idle", "Виджет не добавлен");
  if (!permission) return entry(id, label, "warning", "Нужно разрешение к сервису", id);
  if (config?.error) return entry(id, label, "error", String(config.error), id);
  if (config?.last) {
    const stale = Boolean(config.last.stale);
    return entry(id, label, stale ? "warning" : "ok", `${stale ? "Кэш" : "Обновлено"}: ${formatTime(config.lastUpdatedAt, locale)}`);
  }
  return entry(id, label, "idle", "Ожидает первое обновление");
}

export async function getWidgetDiagnostics(state, { locale = "ru-RU" } = {}) {
  const weatherWidgets = widgetOfType(state, "weather");
  const currencyWidgets = widgetOfType(state, "currency");
  const translatorWidgets = widgetOfType(state, "translator");
  const mediaWidgets = widgetOfType(state, "browser-media");
  const [weatherPermission, currencyPermission, translatorPermission, mediaPermission] = await Promise.all([
    hasWidgetPermissions("weather"),
    hasWidgetPermissions("currency"),
    hasWidgetPermissions("translator"),
    hasBrowserMediaPermission(),
  ]);

  const weather = networkStatus({ id: "weather", label: "Погода · Open-Meteo", widgets: weatherWidgets, config: latestConfig(weatherWidgets), permission: weatherPermission, locale });
  const currency = networkStatus({ id: "currency", label: "Курсы · ExchangeRate", widgets: currencyWidgets, config: latestConfig(currencyWidgets), permission: currencyPermission, locale });
  const translatorConfig = latestConfig(translatorWidgets);
  const translator = !translatorWidgets.length
    ? entry("translator", "Перевод · MyMemory", "idle", "Виджет не добавлен")
    : !translatorPermission
      ? entry("translator", "Перевод · MyMemory", "warning", "Нужно разрешение к сервису", "translator")
      : translatorConfig?.error
        ? entry("translator", "Перевод · MyMemory", "error", String(translatorConfig.error), "translator")
        : translatorConfig?.api?.pending
          ? entry("translator", "Перевод · MyMemory", "checking", "Выполняется запрос")
          : translatorConfig?.api?.updatedAt
            ? entry("translator", "Перевод · MyMemory", translatorConfig.api.stale ? "warning" : "ok", `${translatorConfig.api.stale ? "Кэш" : "Последний ответ"}: ${formatTime(translatorConfig.api.updatedAt, locale)}`)
            : entry("translator", "Перевод · MyMemory", "idle", "Ожидает первый перевод");
  const mediaConfig = latestConfig(mediaWidgets);
  const media = !mediaWidgets.length
    ? entry("browser-media", "Управление воспроизведением", "idle", "Виджет не добавлен")
    : !mediaPermission
      ? entry("browser-media", "Управление воспроизведением", "warning", "Нужно разрешение к медиавкладкам", "browser-media")
      : mediaConfig?.found
        ? entry("browser-media", "Управление воспроизведением", "ok", mediaConfig.sourceCount > 1 ? `Источников: ${mediaConfig.sourceCount}` : `Источник: ${mediaConfig.provider || "плеер"}`)
        : entry("browser-media", "Управление воспроизведением", "idle", mediaConfig?.message || "Откройте вкладку с воспроизведением");

  return [weather, currency, translator, media];
}
