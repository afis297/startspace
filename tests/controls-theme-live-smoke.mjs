import { themePresets } from "../src/themes/presets.js";

const port = Number(Deno.args[0] || "9232");
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

const inspectControls = String.raw`(() => {
  const rgb = (value) => {
    const parts = String(value).match(/[\d.]+/g)?.map(Number) || [];
    return parts.length >= 3 ? parts.slice(0, 3) : null;
  };
  const luminance = (channels) => channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (foreground, background) => {
    if (!foreground || !background) return null;
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return Number(((light + .05) / (dark + .05)).toFixed(2));
  };
  const rectangle = (node) => {
    const rect = node.getBoundingClientRect();
    return { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)), centerY: Number((rect.top + rect.height / 2).toFixed(2)) };
  };
  const add = document.querySelector('#dock .dock-add');
  const settings = document.querySelector('#dock .dock-settings');
  const switcher = document.querySelector('#dock .workspace-switcher-trigger');
  const danger = document.querySelector('.widget-delete-menu .danger-action');
  const addRect = rectangle(add);
  const settingsRect = rectangle(settings);
  const switcherRect = rectangle(switcher);
  const style = getComputedStyle(danger);
  const rawText = style.webkitTextFillColor && style.webkitTextFillColor !== 'currentcolor' ? style.webkitTextFillColor : style.color;
  return {
    theme: document.documentElement.dataset.theme,
    add: addRect,
    settings: settingsRect,
    switcher: switcherRect,
    aligned: Math.abs(addRect.centerY - settingsRect.centerY) <= .5 && Math.abs(addRect.centerY - switcherRect.centerY) <= .5,
    equalToolGeometry: addRect.width === settingsRect.width && addRect.height === settingsRect.height,
    dangerText: rawText,
    dangerBackground: style.backgroundColor,
    dangerContrast: contrast(rgb(rawText), rgb(style.backgroundColor)),
    dangerDisabled: danger.disabled,
  };
})()`;

try {
  await cdp("Runtime.enable");
  await waitFor("Boolean(window.__myFreeLayoutTab?.store && document.querySelector('#dock .dock-add') && document.querySelector('#dock .dock-settings'))", "инициализация Startspace");
  const originalTheme = await evaluate("window.__myFreeLayoutTab.store.getState().settings.themeId");
  if (!await evaluate("Boolean(document.querySelector(\"article[data-widget-type='calculator']\"))")) {
    await evaluate("document.querySelector(\"button[aria-label='Добавить виджет']\")?.click(); true");
    await waitFor("Boolean(document.querySelector('.widget-picker:not([hidden])'))", "открытие каталога");
    await evaluate("(() => { const card = [...document.querySelectorAll('.widget-choice')].find((node) => (node.textContent || '').trim() === 'Калькулятор'); card?.click(); return Boolean(card); })()");
    await waitFor("Boolean(document.querySelector(\"article[data-widget-type='calculator']\"))", "добавление калькулятора");
  }
  await evaluate("document.querySelector(\"article[data-widget-type='calculator'] button[data-action='remove']\")?.click(); true");
  await waitFor("Boolean(document.querySelector('.widget-delete-menu .danger-action'))", "меню удаления");

  const results = [];
  for (const theme of themePresets) {
    await evaluate(`(async () => { const store = window.__myFreeLayoutTab.store; store.updateSettings({ themeId: ${JSON.stringify(theme.id)} }, 'controls-theme-live-smoke'); const { applyTheme } = await import('/src/themes/theme-manager.js'); applyTheme(store.getState().settings); return document.documentElement.dataset.theme; })()`);
    await waitFor(`document.documentElement.dataset.theme === ${JSON.stringify(theme.id)}`, `применение палитры ${theme.id}`);
    await evaluate("(() => { const article = document.querySelector(\"article[data-widget-type='calculator']\"); article?.querySelector('.widget-delete-menu')?.remove(); article?.querySelector(\"button[data-action='remove']\")?.click(); return true; })()");
    await waitFor("Boolean(document.querySelector('.widget-delete-menu .danger-action'))", `меню удаления в теме ${theme.id}`);
    await pause(40);
    results.push(await evaluate(inspectControls));
  }
  await evaluate(`(async () => { const store = window.__myFreeLayoutTab.store; store.updateSettings({ themeId: ${JSON.stringify(originalTheme)} }, 'controls-theme-live-smoke-restore'); const { applyTheme } = await import('/src/themes/theme-manager.js'); applyTheme(store.getState().settings); return true; })()`);
  const failed = results.filter((result) => !result.aligned || !result.equalToolGeometry || result.dangerDisabled || !(result.dangerContrast >= 4.5));
  console.log(JSON.stringify({ passed: failed.length === 0, checkedThemes: results.length, failed, results }, null, 2));
  if (failed.length) throw new Error(`Дефекты контраста или геометрии: ${failed.map((result) => result.theme).join(', ')}`);
} finally {
  socket.close();
}
