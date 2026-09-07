const port = 9232;
const extensionId = "bmfilndijcbfmknlcpkgokchmjeagfib";
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((item) => item.type === "page" && item.url.includes(`${extensionId}/index.html`));
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
      reject(new Error(`Тайм-аут DevTools при вызове ${method}.`));
    }, 5000);
    pending.set(id, { resolve, reject, timer });
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Ошибка выполнения на странице.");
  return result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, description, timeout = 4000) {
  const started = Date.now();
  let lastValue = null;
  while (Date.now() - started < timeout) {
    lastValue = await evaluate(expression);
    if (lastValue) return lastValue;
    await pause(50);
  }
  throw new Error(`Не дождались состояния «${description}». Последнее значение: ${JSON.stringify(lastValue)}`);
}

try {
  await cdp("Runtime.enable");
  await waitFor(`Boolean(window.__myFreeLayoutTab?.store && document.querySelector("button[aria-label='Добавить виджет']"))`, "инициализация Startspace");

  const rssCount = await evaluate(`document.querySelectorAll("article[data-widget-type='rss']").length`);
  await evaluate(`document.querySelector("button[aria-label='Добавить виджет']")?.click(); true`);
  await waitFor(`Boolean(document.querySelector(".widget-picker:not([hidden])"))`, "открытие каталога");
  const rssCardFound = await evaluate(`(() => { const card = [...document.querySelectorAll(".widget-choice")].find((button) => (button.textContent || "").trim() === "RSS-лента"); card?.click(); return Boolean(card); })()`);
  await waitFor(`document.querySelectorAll("article[data-widget-type='rss']").length > ${rssCount}`, "добавление RSS-виджета");
  await evaluate(`document.querySelectorAll("article[data-widget-type='rss']").item(document.querySelectorAll("article[data-widget-type='rss']").length - 1)?.querySelector("button[data-action='properties']")?.click(); true`);
  await waitFor(`Boolean(document.querySelector("#properties-panel:not([hidden]) button[aria-label='Публикаций']"))`, "отрисовка свойства «Публикаций»");
  await evaluate(`document.querySelector("#properties-panel button[aria-label='Публикаций']")?.click(); true`);
  const selectOpened = await waitFor(`(() => { const trigger = document.querySelector("#properties-panel button[aria-label='Публикаций']"); const lists = [...document.querySelectorAll("[role='listbox'][aria-hidden='false']")]; return Boolean(trigger?.getAttribute("aria-expanded") === "true" && lists.length); })()`, "раскрытие списка публикаций");
  await evaluate(`document.querySelector("#properties-panel button[aria-label='Публикаций']")?.click(); true`);
  const selectClosed = await waitFor(`document.querySelector("#properties-panel button[aria-label='Публикаций']")?.getAttribute("aria-expanded") === "false"`, "закрытие списка публикаций");

  const todoCount = await evaluate(`document.querySelectorAll("article[data-widget-type='todo']").length`);
  await evaluate(`document.querySelector("button[aria-label='Добавить виджет']")?.click(); true`);
  await waitFor(`Boolean(document.querySelector(".widget-picker:not([hidden])"))`, "повторное открытие каталога");
  const todoCardFound = await evaluate(`(() => { const card = [...document.querySelectorAll(".widget-choice")].find((button) => (button.textContent || "").trim() === "Задачи"); card?.click(); return Boolean(card); })()`);
  await waitFor(`document.querySelectorAll("article[data-widget-type='todo']").length > ${todoCount}`, "добавление виджета задач");
  await evaluate(`document.querySelectorAll("article[data-widget-type='todo']").item(document.querySelectorAll("article[data-widget-type='todo']").length - 1)?.querySelector(".date-picker-trigger-marker")?.click(); true`);
  const calendarOpened = await waitFor(`(() => { const visible = [...document.querySelectorAll(".date-picker-popover")].filter((node) => node.getAttribute("aria-hidden") === "false"); return visible.length === 1; })()`, "раскрытие календаря");
  await evaluate(`document.querySelector(".date-picker-popover[aria-hidden='false']")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); true`);
  const calendarClosed = await waitFor(`!document.querySelector(".date-picker-popover[aria-hidden='false']")`, "закрытие календаря по Escape");

  console.log(JSON.stringify({ passed: true, rssCardFound, selectOpened, selectClosed, todoCardFound, calendarOpened, calendarClosed }));
} finally {
  socket.close();
}
