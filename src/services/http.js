import { assertUrlPermission } from "./permissions.js";

const cache = new Map();
const MAX_CACHE_ENTRIES = 80;

function saveToCache(key, entry) {
  cache.set(key, entry);
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

async function request(url, { timeout = 8000, cacheKey = url, ttl = 0, accept = "application/json", parse = "json" } = {}) {
  const now = Date.now();
  const saved = cache.get(cacheKey);
  if (saved && now - saved.time < ttl) return { data: saved.data, stale: false, cached: true };

  await assertUrlPermission(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: accept } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = parse === "text" ? await response.text() : await response.json();
    if (parse === "text" && !data.trim()) throw new Error("Сервис вернул пустой ответ.");
    if (ttl > 0) saveToCache(cacheKey, { time: now, data });
    return { data, stale: false, cached: false };
  } catch (error) {
    if (saved) return { data: saved.data, stale: true, cached: true, error };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestJson(url, options = {}) {
  return request(url, { ...options, parse: "json" });
}


export async function requestText(url, { accept = "application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain", ...options } = {}) {
  return request(url, { ...options, accept, parse: "text" });
}
