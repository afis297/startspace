import { requestJson, requestText } from "./http.js";

export async function getWeather({ city, latitude, longitude }) {
  let lat = Number(latitude);
  let lon = Number(longitude);
  let location = city || "";
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
  if (!hasCoordinates) {
    if (!location.trim()) throw new Error("Укажите город или координаты.");
    const geocoding = await requestJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=ru&format=json`, { ttl: 86400000 });
    const place = geocoding.data.results?.[0];
    if (!place) throw new Error("Город не найден.");
    lat = place.latitude;
    lon = place.longitude;
    location = [place.name, place.country].filter(Boolean).join(", ");
  }
  const response = await requestJson(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`, { ttl: 600000 });
  const current = response.data.current;
  return {
    location: location.trim() || "Местоположение не указано",
    temperature: Math.round(current.temperature_2m),
    apparent: Math.round(current.apparent_temperature),
    wind: Math.round(current.wind_speed_10m),
    code: current.weather_code,
    stale: response.stale,
  };
}

export async function getExchangeRate(base, quote) {
  const from = String(base || "USD").toUpperCase();
  const to = String(quote || "RUB").toUpperCase();
  if (from === to) return { rate: 1, date: new Date().toISOString().slice(0, 10), stale: false };
  const response = await requestJson(`https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(from)}`, { cacheKey: `currency:${from}`, ttl: 900000 });
  const rate = response.data.rates?.[to];
  if (!Number.isFinite(rate)) throw new Error("Валюта не поддерживается.");
  return { rate, date: response.data.date || "", stale: response.stale };
}

const MYMEMORY_MAX_QUERY_BYTES = 500;

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value || "")).length;
}
function myMemoryError(error) {
  const message = String(error?.message || "");
  if (/HTTP 429|quota|limit/i.test(message)) return new Error("MyMemory: дневной лимит переводов исчерпан. Попробуйте позже.");
  if (/abort/i.test(String(error?.name || ""))) return new Error("MyMemory не ответил вовремя. Попробуйте ещё раз.");
  return new Error("MyMemory временно недоступен. Проверьте подключение и повторите попытку.");
}

export async function translateText(text, from = "ru", to = "en") {
  const source = String(text || "").trim();
  const sourceLanguage = String(from || "ru").trim();
  const targetLanguage = String(to || "en").trim();
  if (!source) return { text: "", provider: "MyMemory", match: null, stale: false, status: "Введите текст для перевода" };
  const bytes = utf8Bytes(source);
  if (bytes > MYMEMORY_MAX_QUERY_BYTES) throw new Error(`MyMemory принимает до ${MYMEMORY_MAX_QUERY_BYTES} байт за запрос. Сейчас: ${bytes}.`);
  if (sourceLanguage === targetLanguage) return { text: source, provider: "MyMemory", match: 1, stale: false, status: "Языки совпадают" };
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(source)}&langpair=${encodeURIComponent(`${sourceLanguage}|${targetLanguage}`)}&mt=1`;
  let response;
  try {
    response = await requestJson(url, { timeout: 10000, ttl: 0, cacheKey: `translation:${sourceLanguage}:${targetLanguage}:${source}` });
  } catch (error) {
    throw myMemoryError(error);
  }
  const data = response.data || {};
  if (Number(data.responseStatus || 200) !== 200) throw new Error(`MyMemory: ${data.responseDetails || "перевод временно недоступен."}`);
  const translated = String(data.responseData?.translatedText || "").trim();
  if (!translated) throw new Error("MyMemory не вернул перевод. Попробуйте изменить текст.");
  const match = Number(data.responseData?.match);
  return {
    text: translated,
    provider: "MyMemory",
    match: Number.isFinite(match) ? Math.max(0, Math.min(1, match)) : null,
    stale: Boolean(response.stale),
    status: response.stale ? "MyMemory: показан сохранённый результат" : "MyMemory",
  };
}

export function weatherIcon(code) {
  if ([0].includes(code)) return "☀";
  if ([1, 2].includes(code)) return "⛅";
  if ([3, 45, 48].includes(code)) return "☁";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "ϟ";
  return "◌";
}


function cleanFeedText(value) {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function firstTag(source, tag) {
  const match = String(source || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return cleanFeedText(match?.[1] || "");
}

function entryLink(source) {
  const atom = String(source || "").match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];
  if (atom) return atom.trim();
  return firstTag(source, "link");
}

function parseFeedDate(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function parseRssOrAtom(xml, limit) {
  const raw = String(xml || "");
  const blocks = [...raw.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
  if (!blocks.length) throw new Error("В ленте не найдены записи RSS или Atom.");
  const items = blocks.map((block) => ({
    title: firstTag(block, "title") || "Без заголовка",
    url: entryLink(block),
    summary: firstTag(block, "description") || firstTag(block, "summary") || firstTag(block, "content"),
    publishedAt: parseFeedDate(firstTag(block, "pubDate") || firstTag(block, "updated") || firstTag(block, "published")),
  })).filter((item) => /^https?:\/\//i.test(item.url));
  if (!items.length) throw new Error("В ленте нет записей с безопасными ссылками.");
  return items.sort((left, right) => right.publishedAt - left.publishedAt).slice(0, limit);
}

export async function getRssFeed(url, limit = 5) {
  const source = String(url || "").trim();
  if (!/^https?:\/\//i.test(source)) throw new Error("Укажите действительный URL RSS или Atom-ленты.");
  const requestedLimit = Number(limit);
  const count = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, Math.trunc(requestedLimit))) : 5;
  let response;
  try {
    response = await requestText(source, { cacheKey: `rss:${source}`, ttl: 5 * 60 * 1000, timeout: 12000 });
  } catch (error) {
    throw new Error(error?.name === "AbortError" ? "RSS-лента не ответила вовремя." : `Не удалось загрузить RSS: ${error?.message || "сервис недоступен."}`);
  }
  return { items: parseRssOrAtom(response.data, count), stale: response.stale, source };
}
