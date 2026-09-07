const port = Number(Deno.args[0] || "9238");
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
async function waitFor(expression, description, timeout = 7000) {
  const started = Date.now();
  let latest = null;
  while (Date.now() - started < timeout) {
    latest = await evaluate(expression);
    if (latest) return latest;
    await pause(80);
  }
  throw new Error(`Не дождались: ${description}; последнее состояние: ${JSON.stringify(latest)}`);
}

const widgetId = "persistence-live-smoke-focus-timer";
const config = {
  totalSeconds: 900,
  remainingSeconds: 721,
  running: true,
  endsAt: Date.now() + 12 * 60 * 1000,
};

try {
  await cdp("Runtime.enable");
  await waitFor("Boolean(window.__myFreeLayoutTab?.store)", "инициализация Startspace");
  await evaluate("document.querySelector('.onboarding-close')?.click(); true");
  await evaluate(`(() => { const store = window.__myFreeLayoutTab.store; store.removeWidget(${JSON.stringify(widgetId)}, 'persistence-live-smoke-reset'); store.addWidget({ id: ${JSON.stringify(widgetId)}, type: 'focus-timer', position: { x: 40, y: 40 }, size: { w: 310, h: 250 }, zIndex: 999, collapsed: true, style: {}, config: ${JSON.stringify(config)} }, 'persistence-live-smoke-add'); return true; })()`);
  await waitFor(`Boolean(window.__myFreeLayoutTab.store.getState().widgets.find((widget) => widget.id === ${JSON.stringify(widgetId)}))`, "добавление тестового таймера");
  await pause(700);

  await cdp("Page.reload", { ignoreCache: true });
  await waitFor("document.readyState === 'complete' && Boolean(window.__myFreeLayoutTab?.store)", "повторная инициализация после обновления");
  const restoredJson = await waitFor(`(() => { const store = window.__myFreeLayoutTab?.store; const widget = store?.getState?.().widgets?.find((item) => item.id === ${JSON.stringify(widgetId)}); return widget ? JSON.stringify(widget) : ''; })()`, "восстановление тестового таймера после обновления");
  const restored = JSON.parse(restoredJson);
  if (!restored || !restored.collapsed || restored.config?.totalSeconds !== 900 || restored.config?.remainingSeconds !== 721 || !restored.config?.running || Number(restored.config?.endsAt) !== Number(config.endsAt)) {
    throw new Error(`Таймер не восстановился после обновления страницы: ${JSON.stringify(restored)}`);
  }
  console.log(JSON.stringify({ passed: true, restored: { id: restored.id, collapsed: restored.collapsed, config: restored.config } }, null, 2));
} finally {
  await evaluate(`window.__myFreeLayoutTab?.store?.removeWidget(${JSON.stringify(widgetId)}, 'persistence-live-smoke-cleanup'); true`).catch(() => undefined);
  await pause(350);
  socket.close();
}
