const port = Number(Deno.args[0] || "9234");
const extensionId = "bmfilndijcbfmknlcpkgokchmjeagfib";
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((target) => target.type === "page" && target.url.includes(`${extensionId}/index.html`));
if (!page?.webSocketDebuggerUrl) throw new Error("Страница Startspace не найдена в DevTools.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  clearTimeout(task.timer);
  message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Тайм-аут DevTools: ${method}`));
    }, 5000);
    pending.set(id, { resolve, reject, timer });
  });
}

async function evaluate(expression) {
  const response = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Ошибка выполнения страницы.");
  return response.result.value;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, description, timeout = 5000) {
  const started = Date.now();
  let latest = null;
  while (Date.now() - started < timeout) {
    latest = await evaluate(expression);
    if (latest) return latest;
    await pause(60);
  }
  throw new Error(`Не дождались: ${description}; последнее состояние: ${JSON.stringify(latest)}`);
}

function items(count) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Проверочная публикация ${index + 1}`,
    url: `https://example.com/startspace-rss-${index + 1}`,
    summary: `Краткое описание публикации ${index + 1}`,
    publishedAt: Date.UTC(2026, 7, 21, 12, 0, 0) - index * 60_000,
  }));
}

let widgetId = null;
let addedForTest = false;
let originalConfig = null;
try {
  await cdp("Runtime.enable");
  await waitFor("Boolean(window.__myFreeLayoutTab?.store && document.querySelector('#dock .dock-add'))", "инициализация Startspace");

  widgetId = await evaluate("window.__myFreeLayoutTab.store.getState().widgets.find((widget) => widget.type === 'rss')?.id || null");
  if (!widgetId) {
    addedForTest = true;
    await evaluate("document.querySelector(\"button[aria-label='Добавить виджет']\")?.click(); true");
    await waitFor("Boolean(document.querySelector('.widget-picker:not([hidden])'))", "открытие каталога RSS");
    await evaluate("(() => { const card = [...document.querySelectorAll('.widget-choice')].find((node) => (node.textContent || '').trim() === 'RSS-лента'); card?.click(); return Boolean(card); })()");
    await waitFor("Boolean(document.querySelector(\"article[data-widget-type='rss']\"))", "добавление RSS-карточки");
    widgetId = await evaluate("window.__myFreeLayoutTab.store.getState().widgets.find((widget) => widget.type === 'rss')?.id || null");
  }
  if (!widgetId) throw new Error("Не удалось получить идентификатор RSS-карточки.");

  originalConfig = JSON.parse(await evaluate(`JSON.stringify(window.__myFreeLayoutTab.store.getState().widgets.find((widget) => widget.id === ${JSON.stringify(widgetId)})?.config || {})`));
  const baseConfig = { ...originalConfig, url: "https://example.com/startspace-rss-smoke.xml", autoRefresh: false, refreshMinutes: 15, error: "", stale: false, lastUpdatedAt: Date.now() };
  await evaluate(`window.__myFreeLayoutTab.store.updateWidget(${JSON.stringify(widgetId)}, { config: ${JSON.stringify({ ...baseConfig, limit: 20, items: [] })} }, 'rss-widget-live-smoke-setup'); true`);
  await pause(120);
  await evaluate(`window.__myFreeLayoutTab.store.updateWidget(${JSON.stringify(widgetId)}, { config: ${JSON.stringify({ ...baseConfig, limit: 20, items: items(20) })} }, 'rss-widget-live-smoke-fill'); true`);

  await waitFor(`document.querySelector(${JSON.stringify(`article[data-widget-id='${widgetId}']`)})?.querySelectorAll('.rss-item').length === 20`, "отображение 20 RSS-публикаций");
  const twenty = await evaluate(`(() => { const root = document.querySelector(${JSON.stringify(`article[data-widget-id='${widgetId}']`)}); const list = root?.querySelector('.rss-list'); const source = root?.querySelector('.rss-source')?.textContent?.trim(); return { count: root?.querySelectorAll('.rss-item').length || 0, source, overflow: Boolean(list && list.scrollHeight > list.clientHeight), scrollable: getComputedStyle(list).overflowY === 'auto' }; })()`);
  if (twenty.count !== 20 || twenty.source !== "example.com" || !twenty.overflow || !twenty.scrollable) throw new Error(`RSS не отобразил прокручиваемый список из 20 записей: ${JSON.stringify(twenty)}`);

  await evaluate(`window.__myFreeLayoutTab.store.updateWidget(${JSON.stringify(widgetId)}, { config: ${JSON.stringify({ ...baseConfig, limit: 3, items: [] })} }, 'rss-widget-live-smoke-limit'); true`);
  await pause(120);
  await evaluate(`window.__myFreeLayoutTab.store.updateWidget(${JSON.stringify(widgetId)}, { config: ${JSON.stringify({ ...baseConfig, limit: 3, items: items(3) })} }, 'rss-widget-live-smoke-short-list'); true`);
  await waitFor(`document.querySelector(${JSON.stringify(`article[data-widget-id='${widgetId}']`)})?.querySelectorAll('.rss-item').length === 3`, "отображение 3 RSS-публикаций");
  const three = await evaluate(`(() => ({ count: document.querySelector(${JSON.stringify(`article[data-widget-id='${widgetId}']`)})?.querySelectorAll('.rss-item').length || 0, configuredLimit: Number(window.__myFreeLayoutTab.store.getState().widgets.find((widget) => widget.id === ${JSON.stringify(widgetId)})?.config?.limit) }))()`);
  if (three.count !== 3 || three.configuredLimit !== 3) throw new Error(`RSS не применил лимит 3 публикации: ${JSON.stringify(three)}`);

  console.log(JSON.stringify({ passed: true, widgetId, longList: twenty, shortList: three }, null, 2));
} finally {
  if (widgetId) {
    if (addedForTest) await evaluate(`window.__myFreeLayoutTab.store.removeWidget(${JSON.stringify(widgetId)}, 'rss-widget-live-smoke-cleanup'); true`).catch(() => undefined);
    else if (originalConfig) await evaluate(`window.__myFreeLayoutTab.store.updateWidget(${JSON.stringify(widgetId)}, { config: ${JSON.stringify(originalConfig)} }, 'rss-widget-live-smoke-restore'); true`).catch(() => undefined);
  }
  socket.close();
}
