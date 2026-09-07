import assert from "node:assert/strict";
import { getRssFeed, translateText } from "../src/services/data-services.js";

const originalFetch = globalThis.fetch;
try {
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return { responseStatus: 200, responseData: { translatedText: "Hello", match: 0.94 } };
      },
    };
  };
  const translation = await translateText("Привет", "ru", "en");
  assert.deepEqual(translation, { text: "Hello", provider: "MyMemory", match: 0.94, stale: false, status: "MyMemory" });
  assert.match(requestedUrl, /api\.mymemory\.translated\.net\/get/, "переводчик должен обращаться к MyMemory API");
  assert.match(requestedUrl, /langpair=ru%7Cen/, "запрос MyMemory должен передавать языковую пару");
  assert.match(requestedUrl, /mt=1/, "запрос MyMemory должен явно включать машинный перевод");

  await assert.rejects(() => translateText("я".repeat(251), "ru", "en"), /до 500 байт/, "русский текст длиннее 500 байт не должен отправляться в MyMemory");

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { responseStatus: 429, responseDetails: "QUOTA EXCEEDED", responseData: {} };
    },
  });
  await assert.rejects(() => translateText("Новый текст", "ru", "en"), /QUOTA EXCEEDED/, "статус MyMemory должен отображаться в ошибке");

  const rssXml = `<?xml version="1.0"?><rss><channel>
    <item><title>Первая</title><link>https://example.com/first</link><pubDate>2026-08-20T10:00:00Z</pubDate></item>
    <item><title>Вторая</title><link>https://example.com/second</link><pubDate>2026-08-21T09:00:00Z</pubDate></item>
    <item><title>Третья</title><link>https://example.com/third</link><pubDate>2026-08-19T10:00:00Z</pubDate></item>
    <item><title>Четвёртая</title><link>https://example.com/fourth</link><pubDate>2026-08-18T10:00:00Z</pubDate></item>
  </channel></rss>`;
  globalThis.fetch = async () => ({ ok: true, async text() { return rssXml; } });
  const rss = await getRssFeed("https://example.com/startspace-rss-smoke.xml", 3);
  assert.equal(rss.items.length, 3, "RSS должен возвращать ровно выбранное число публикаций");
  assert.deepEqual(rss.items.map((item) => item.title), ["Вторая", "Первая", "Третья"], "RSS должен сортировать публикации по дате перед ограничением");
  const minimum = await getRssFeed("https://example.com/startspace-rss-smoke.xml", 0);
  assert.equal(minimum.items.length, 1, "некорректный лимит RSS должен безопасно ограничиваться минимумом в одну публикацию");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("data-services-smoke: passed");
