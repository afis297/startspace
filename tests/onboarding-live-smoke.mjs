const port = Number(Deno.args[0] || "9237");
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

function onboardingState() {
  return `(() => ({
    open: Boolean(document.querySelector('.onboarding-overlay')),
    label: document.querySelector('.onboarding-kicker')?.textContent?.trim() || '',
    pickerOpen: Boolean(document.querySelector('.widget-picker:not([hidden])')),
    settingsOpen: Boolean(document.querySelector('#settings-panel:not([hidden])')),
    completed: Boolean(window.__myFreeLayoutTab?.store?.getState().settings.onboarding?.completed),
  }))()`;
}

try {
  await cdp("Runtime.enable");
  await waitFor("Boolean(window.__myFreeLayoutTab?.store && document.querySelector('.widget-picker') && document.querySelector('#settings-panel'))", "инициализация Startspace");
  await evaluate("document.dispatchEvent(new Event('mflt-show-onboarding')); true");
  await waitFor("Boolean(document.querySelector('.onboarding-overlay'))", "открытие знакомства");
  const first = await evaluate(onboardingState());
  if (first.label !== "STARTSPACE / 01 / 03 · ВИДЖЕТЫ" || first.completed) throw new Error(`Первый шаг знакомства открыт неверно: ${JSON.stringify(first)}`);

  await evaluate("document.querySelector('.onboarding-action')?.click(); true");
  await waitFor("Boolean(document.querySelector('.widget-picker:not([hidden])')) && !document.querySelector('.onboarding-overlay')", "открытие каталога из знакомства");
  await evaluate("document.querySelector('.widget-picker').hidden = true; true");
  await waitFor("document.querySelector('.onboarding-kicker')?.textContent?.includes('02 / 03')", "возврат ко второму шагу после каталога");
  const second = await evaluate(onboardingState());
  if (second.completed || second.pickerOpen) throw new Error(`Состояние после каталога некорректно: ${JSON.stringify(second)}`);

  await evaluate("document.querySelector('.onboarding-action')?.click(); true");
  await waitFor("Boolean(document.querySelector('#settings-panel:not([hidden])')) && !document.querySelector('.onboarding-overlay')", "открытие настроек из знакомства");
  await evaluate("document.querySelector('#settings-panel').hidden = true; document.dispatchEvent(new Event('mflt-settings-closed')); true");
  await waitFor("document.querySelector('.onboarding-kicker')?.textContent?.includes('03 / 03')", "возврат к третьему шагу после настроек");
  const third = await evaluate(onboardingState());
  if (third.completed || third.settingsOpen) throw new Error(`Состояние после настроек некорректно: ${JSON.stringify(third)}`);

  console.log(JSON.stringify({ passed: true, first, second, third }, null, 2));
} finally {
  await evaluate("document.querySelector('.onboarding-close')?.click(); true").catch(() => undefined);
  socket.close();
}
