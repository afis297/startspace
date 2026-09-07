import { callExtensionApi, getExtensionApi } from "./extension-api.js";

const WIDGET_ORIGINS = Object.freeze({
  weather: [
    "https://api.open-meteo.com/*",
    "https://geocoding-api.open-meteo.com/*",
  ],
  currency: ["https://api.exchangerate-api.com/*"],
  translator: ["https://api.mymemory.translated.net/*"],
  youtube: [
    "https://www.youtube.com/*",
    "https://www.youtube-nocookie.com/*",
  ],
});

const MANAGED_ORIGINS = new Set(Object.values(WIDGET_ORIGINS).flat());

function permissionsApi() {
  return getExtensionApi()?.permissions || null;
}

function originPattern(value) {
  const url = new URL(value);
  return `${url.origin}/*`;
}

async function callPermissions(method, details) {
  const api = permissionsApi();
  if (!api || typeof api[method] !== "function") return method === "contains";
  return callExtensionApi(api[method], api, [details]);
}

export function getWidgetPermissionOrigins(type) {
  return [...(WIDGET_ORIGINS[type] || [])];
}

export async function hasWidgetPermissions(type) {
  const origins = getWidgetPermissionOrigins(type);
  if (!origins.length) return true;
  try {
    return Boolean(await callPermissions("contains", { origins }));
  } catch {
    return false;
  }
}

export function permissionDeniedMessage(type) {
  const titles = {
    weather: "погоды",
    currency: "курсов валют",
    translator: "переводчика",
    youtube: "YouTube",
  };
  return `Для виджета ${titles[type] || "внешних данных"} нужен доступ к соответствующему сервису.`;
}

export async function requestWidgetPermissions(type) {
  const origins = getWidgetPermissionOrigins(type);
  const api = permissionsApi();
  if (!origins.length || !api) return true;
  try {
    if (await hasWidgetPermissions(type)) return true;
    return Boolean(await callPermissions("request", { origins }));
  } catch (error) {
    console.warn("Не удалось запросить разрешение расширения.", error);
    return false;
  }
}

export async function assertUrlPermission(url) {
  const api = permissionsApi();
  if (!api) return true;
  let origin;
  try {
    origin = originPattern(url);
  } catch {
    return true;
  }
  if (!MANAGED_ORIGINS.has(origin)) return true;
  if (await callPermissions("contains", { origins: [origin] })) return true;
  throw new Error("Доступ к внешнему сервису не предоставлен. Добавьте виджет через панель выбора и подтвердите запрос браузера.");
}
