const port = Number(Deno.args[0] || "9235");
const extensionId = "bmfilndijcbfmknlcpkgokchmjeagfib";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function findPage(timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((target) => target.type === "page" && target.url.includes(`${extensionId}/index.html`) && target.webSocketDebuggerUrl);
    if (page) return page;
    await delay(150);
  }
  return null;
}
const page = await findPage();
if (!page?.webSocketDebuggerUrl) throw new Error("Страница Startspace не найдена или ещё не загрузилась в DevTools.");

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
const pause = delay;
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

const widgetSpecs = [
  { type: "rss", title: "RSS-лента", action: "Обновить RSS-ленту" },
  { type: "weather", title: "Погода", action: "Обновить погоду" },
  { type: "system-monitor", title: "Загрузка ПК", action: "Обновить загрузку ПК" },
];
const addedIds = [];
const collapsedBefore = new Map();

async function addWidget(title, type) {
  await evaluate("document.querySelector(\"button[aria-label='Добавить виджет']\")?.click(); true");
  await waitFor("Boolean(document.querySelector('.widget-picker:not([hidden])'))", `открытие каталога ${title}`);
  const clicked = await evaluate(`(() => { const card = [...document.querySelectorAll('.widget-choice')].find((node) => (node.textContent || '').trim() === ${JSON.stringify(title)}); card?.click(); return Boolean(card); })()`);
  if (!clicked) throw new Error(`Карточка «${title}» не найдена в каталоге.`);
  await waitFor(`Boolean(document.querySelector(${JSON.stringify(`article[data-widget-type='${type}']`)}))`, `добавление ${title}`);
}

async function runCommand(title) {
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true })); true");
  await waitFor("Boolean(document.querySelector('.command-palette-overlay'))", "открытие командной палитры");
  await evaluate(`(() => { const input = document.querySelector('.command-palette-input'); input.value = ${JSON.stringify(title)}; input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await waitFor(`document.querySelectorAll('.command-palette-item').length === 1 && document.querySelector('.command-palette-item strong')?.textContent === ${JSON.stringify(title)}`, `поиск команды «${title}»`);
  await evaluate("document.querySelector('.command-palette-item')?.click(); true");
  await waitFor("!document.querySelector('.command-palette-overlay')", `закрытие палитры после «${title}»`);
  await pause(120);
}

try {
  await cdp("Runtime.enable");
  await waitFor("Boolean(window.__myFreeLayoutTab?.store && document.querySelector('#dock .dock-add'))", "инициализация Startspace");

  for (const spec of widgetSpecs) {
    let widget = JSON.parse(await evaluate(`JSON.stringify(window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.type === ${JSON.stringify(spec.type)}) || null)`));
    if (!widget) {
      await addWidget(spec.title, spec.type);
      widget = JSON.parse(await evaluate(`JSON.stringify(window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.type === ${JSON.stringify(spec.type)}) || null)`));
      if (!widget) throw new Error(`Не удалось добавить «${spec.title}».`);
      addedIds.push(widget.id);
    }
    collapsedBefore.set(widget.id, Boolean(widget.collapsed));
    await evaluate(`window.__myFreeLayoutTab.store.updateWidget(${JSON.stringify(widget.id)}, { collapsed: true }, 'command-palette-live-smoke-collapse'); true`);
  }

  await evaluate(`(() => {
    window.__commandPaletteSmokeClicks = [];
    window.__commandPaletteSmokeOriginalClick = HTMLButtonElement.prototype.click;
    HTMLButtonElement.prototype.click = function smokeClick() {
      if (this.matches("[data-role='refresh']")) {
        const root = this.closest('[data-widget-id]');
        const widget = root && window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === root.dataset.widgetId);
        if (widget) window.__commandPaletteSmokeClicks.push(widget.type);
      }
      return window.__commandPaletteSmokeOriginalClick.call(this);
    };
    return true;
  })()`);

  const results = [];
  for (const spec of widgetSpecs) {
    await runCommand(spec.action);
    const outcome = await evaluate(`(() => { const widget = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.type === ${JSON.stringify(spec.type)}); return { clicked: window.__commandPaletteSmokeClicks.includes(${JSON.stringify(spec.type)}), expanded: widget ? !widget.collapsed : false }; })()`);
    if (!outcome.clicked || !outcome.expanded) throw new Error(`Команда «${spec.action}» не активировала нужную карточку: ${JSON.stringify(outcome)}`);
    results.push({ type: spec.type, action: spec.action, ...outcome });
  }
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await evaluate(`(() => { if (window.__commandPaletteSmokeOriginalClick) HTMLButtonElement.prototype.click = window.__commandPaletteSmokeOriginalClick; delete window.__commandPaletteSmokeOriginalClick; delete window.__commandPaletteSmokeClicks; return true; })()`).catch(() => undefined);
  for (const [widgetId, collapsed] of collapsedBefore) {
    if (!addedIds.includes(widgetId)) await evaluate(`window.__myFreeLayoutTab.store.updateWidget(${JSON.stringify(widgetId)}, { collapsed: ${collapsed} }, 'command-palette-live-smoke-restore'); true`).catch(() => undefined);
  }
  for (const widgetId of addedIds) await evaluate(`window.__myFreeLayoutTab.store.removeWidget(${JSON.stringify(widgetId)}, 'command-palette-live-smoke-cleanup'); true`).catch(() => undefined);
  socket.close();
}
