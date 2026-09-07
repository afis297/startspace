import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const profile = await mkdtemp(path.join(tmpdir(), "mflt-browser-smoke-"));
let server;
let browser;
let socket;
let requestId = 0;
const pending = new Map();

const mime = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".mjs": "text/javascript" };

async function startServer() {
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
      const target = path.resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
      if (!target.startsWith(root)) throw new Error("Недопустимый путь");
      const body = await readFile(target);
      response.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream", "cache-control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`DevTools ответил ${response.status}`);
  return response.json();
}

async function waitForDevTools(port) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { return await fetchJson(`http://127.0.0.1:${port}/json/version`); }
    catch (error) { lastError = error; await delay(125); }
  }
  throw lastError || new Error("DevTools не запустился.");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    socket = new WebSocket(url);
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
    socket.addEventListener("message", ({ data }) => {
      const response = JSON.parse(data);
      const task = pending.get(response.id);
      if (!task) return;
      pending.delete(response.id);
      if (response.error) task.reject(new Error(response.error.message));
      else task.resolve(response.result);
    });
  });
}

function cdp(method, params = {}) {
  const id = ++requestId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Ошибка выполнения в браузере.");
  return result.result.value;
}

async function waitFor(expression, description) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Не дождались: ${description}`);
}

try {
  const httpPort = await startServer();
  const debugPort = 9337;
  browser = spawn("/usr/bin/chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, "about:blank",
  ], { stdio: "ignore" });
  const version = await waitForDevTools(debugPort);
  await connect(version.webSocketDebuggerUrl);
  const page = await cdp("Target.createTarget", { url: `http://127.0.0.1:${httpPort}/index.html` });
  const pageInfo = await (async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const pages = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
      const found = pages.find((item) => item.id === page.targetId);
      if (found) return found;
      await delay(100);
    }
    throw new Error("Страница приложения не появилась в DevTools.");
  })();
  socket.close();
  pending.clear();
  requestId = 0;
  await connect(pageInfo.webSocketDebuggerUrl);
  await cdp("Runtime.enable");
  await waitFor("Boolean(window.__myFreeLayoutTab && document.querySelectorAll('.desktop-widget').length >= 4)", "инициализация приложения");

  const initialCount = await evaluate("document.querySelectorAll('.desktop-widget').length");
  assert.equal(initialCount, 4, "стартовый макет должен содержать четыре виджета");
  const uploadedWallpaper = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    app.store.updateSettings({ wallpaper: { mode: "image", value: "", source: "" } }, "browser-smoke-wallpaper-mode");
    document.querySelector('#dock button[aria-label="Настройки"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    [...document.querySelectorAll('#settings-panel .settings-tab')].find((button) => button.textContent.trim() === "Обои").click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const upload = document.querySelector('#settings-panel input[type="file"]');
    const binary = atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0mQAAAABJRU5ErkJggg==");
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const file = new File([bytes], "wallpaper.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    Object.defineProperty(upload, "files", { configurable: true, value: transfer.files });
    upload.dispatchEvent(new Event("change", { bubbles: true }));
    for (let attempt = 0; attempt < 80 && !String(app.store.getState().settings.wallpaper?.value || "").startsWith("data:image/webp;base64,"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const wallpaper = app.store.getState().settings.wallpaper || {};
    return {
      mode: wallpaper.mode,
      source: wallpaper.source,
      valuePrefix: String(wallpaper.value || "").slice(0, 23),
      valueLength: String(wallpaper.value || "").length,
      background: document.documentElement.style.getPropertyValue("--workspace-background"),
      fileInputEnabled: !document.querySelector('#settings-panel input[type="file"]').disabled,
    };
  })()`);
  assert.equal(uploadedWallpaper.mode, "image", "загрузка файла должна включать режим изображения");
  assert.equal(uploadedWallpaper.source, "upload", "загруженные обои должны отмечаться как локальный файл");
  assert.equal(uploadedWallpaper.valuePrefix, "data:image/webp;base64,", "изображение должно оптимизироваться в безопасный WEBP data URL");
  assert.ok(uploadedWallpaper.valueLength > 100, "оптимизированное изображение должно содержать данные");
  assert.match(uploadedWallpaper.background, /data:image\/webp;base64,/, "оптимизированные обои должны сразу применяться к фону");
  assert.equal(uploadedWallpaper.fileInputEnabled, true, "поле загрузки должно снова становиться доступным после обработки");

  const widgetsVisibilityHotkey = await evaluate(`(() => {
    const workspace = document.getElementById("workspace");
    const countBefore = document.querySelectorAll(".desktop-widget").length;
    const press = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "H", code: "KeyH", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    const hideHandled = press();
    const hidden = { active: workspace.classList.contains("is-widgets-hidden"), ariaHidden: workspace.getAttribute("aria-hidden"), inert: workspace.inert, count: document.querySelectorAll(".desktop-widget").length };
    const showHandled = press();
    const shown = { active: workspace.classList.contains("is-widgets-hidden"), ariaHidden: workspace.getAttribute("aria-hidden"), inert: workspace.inert, count: document.querySelectorAll(".desktop-widget").length };
    return { countBefore, hideHandled, hidden, showHandled, shown };
  })()`);
  assert.equal(widgetsVisibilityHotkey.hideHandled, false, "горячая клавиша скрытия должна отменять стандартное действие браузера");
  assert.deepEqual(widgetsVisibilityHotkey.hidden, { active: true, ariaHidden: "true", inert: true, count: 4 }, "Ctrl+Shift+H должен скрывать все виджеты без удаления карточек");
  assert.equal(widgetsVisibilityHotkey.showHandled, false, "повторное сочетание должно также отменять стандартное действие браузера");
  assert.deepEqual(widgetsVisibilityHotkey.shown, { active: false, ariaHidden: null, inert: false, count: 4 }, "повторный Ctrl+Shift+H должен вернуть все виджеты на прежние места");
  assert.equal(widgetsVisibilityHotkey.countBefore, 4, "горячая клавиша не должна менять состав макета");

  const addResult = await evaluate(`(() => {
    const app = window.__myFreeLayoutTab;
    const widget = app.registry.createWidget("calculator", { position: { x: 80, y: 80 } });
    app.store.addWidget(widget, "browser-smoke-add");
    return { id: widget.id, count: app.store.getState().widgets.length };
  })()`);
  assert.equal(addResult.count, 5, "виджет должен добавляться через реестр");
  await waitFor(`Boolean(document.querySelector('[data-widget-id="${addResult.id}"]'))`, "рендер добавленного виджета");
  const quoteOnPageLoad = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const widget = app.registry.createWidget("quote", { position: { x: 440, y: 80 } });
    app.store.addWidget(widget, "browser-smoke-quote-page-load");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const indexAfterLoad = app.store.getState().widgets.find((item) => item.id === widget.id).config.index;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const indexAfterRender = app.store.getState().widgets.find((item) => item.id === widget.id).config.index;
    const article = document.querySelector('[data-widget-id="' + widget.id + '"]');
    const quoteText = article.querySelector('[data-role="quote"]').textContent;
    article.querySelector(".quote-widget button").click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const indexAfterManualChange = app.store.getState().widgets.find((item) => item.id === widget.id).config.index;
    return { indexAfterLoad, indexAfterRender, indexAfterManualChange, quoteText };
  })()`);
  assert.equal(quoteOnPageLoad.indexAfterLoad, 1, "при загрузке страницы виджет цитаты должен перейти к следующей цитате");
  assert.equal(quoteOnPageLoad.indexAfterRender, 1, "цитата должна меняться только один раз за инициализацию страницы");
  assert.equal(quoteOnPageLoad.indexAfterManualChange, 2, "ручная кнопка должна продолжать смену цитат после автоматической");
  assert.ok(quoteOnPageLoad.quoteText, "сменённая цитата должна быть показана в виджете");

  const playerWidget = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const widget = app.registry.createWidget("player", { position: { x: 820, y: 80 } });
    app.store.addWidget(widget, "browser-smoke-player");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const article = document.querySelector('[data-widget-id="' + widget.id + '"]');
    const toggle = article.querySelector('[data-role="toggle"]');
    toggle.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const statusWithoutSource = article.querySelector('[data-role="status"]').textContent;
    const current = app.store.getState().widgets.find((item) => item.id === widget.id);
    app.store.updateWidget(widget.id, { config: { ...current.config, audioUrl: "javascript:alert(1)" } }, "browser-smoke-player-unsafe-url");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const statusAfterUnsafeSource = article.querySelector('[data-role="status"]').textContent;
    const unsafeCurrent = app.store.getState().widgets.find((item) => item.id === widget.id);
    app.store.updateWidget(widget.id, { config: { ...unsafeCurrent.config, audioUrl: "https://example.test/audio.mp3" } }, "browser-smoke-player-audio-controls");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const playerRoot = article.querySelector('.player-widget');
    const audio = playerRoot.__audio;
    Object.defineProperties(audio, { duration: { configurable: true, value: 120 }, currentTime: { configurable: true, writable: true, value: 30 } });
    audio.dispatchEvent(new Event('loadedmetadata'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const seekBack = article.querySelector('[data-role="seek-back"]');
    const seekForward = article.querySelector('[data-role="seek-forward"]');
    const progress = article.querySelector('[data-role="progress"]');
    seekBack.click();
    const afterBack = audio.currentTime;
    seekForward.click();
    const afterForward = audio.currentTime;
    progress.value = '75';
    progress.dispatchEvent(new Event('input', { bubbles: true }));
    const afterSlider = audio.currentTime;
    const transportVisible = getComputedStyle(article.querySelector('.player-transport')).display !== 'none';
    const seekButtonsEnabled = !seekBack.disabled && !seekForward.disabled;
    const coverSize = article.querySelector('.player-cover').getBoundingClientRect();
    const playerCurrent = app.store.getState().widgets.find((item) => item.id === widget.id);
    app.store.updateWidget(widget.id, { config: { ...playerCurrent.config, audioUrl: "https://youtu.be/dQw4w9WgXcQ" } }, "browser-smoke-player-youtube");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const youtubeLink = article.querySelector('.player-youtube-link');
    const youtubeLinkVisible = Boolean(youtubeLink && !youtubeLink.hidden);
    const youtubeLinkHref = youtubeLink?.href || "";
    const noYoutubeIframe = !article.querySelector('iframe.player-youtube');
    const timelineHidden = getComputedStyle(article.querySelector('.player-timeline')).display === "none";
    const transportHidden = getComputedStyle(article.querySelector('.player-transport')).display === "none";
    const originalOpen = window.open;
    let openedYoutubeUrl = "";
    window.open = (url) => { openedYoutubeUrl = String(url); return null; };
    toggle.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    window.open = originalOpen;
    return {
      title: article.querySelector('[data-role="title"]').textContent,
      artist: article.querySelector('[data-role="artist"]').textContent,
      hasProgress: Boolean(article.querySelector('[data-role="progress"]')),
      hasPlayIcon: Boolean(toggle.querySelector('.line-icon')),
      seekButtons: article.querySelectorAll('.player-step').length,
      seekButtonsEnabled,
      afterBack,
      afterForward,
      afterSlider,
      transportVisible,
      coverSize: { width: coverSize.width, height: coverSize.height },
      statusWithoutSource,
      statusAfterUnsafeSource,
      youtubeLinkVisible,
      youtubeLinkHref,
      openedYoutubeUrl,
      noYoutubeIframe,
      timelineHidden,
      transportHidden,
      youtubeStatus: article.querySelector('[data-role="status"]').textContent,
      youtubeToggleLabel: toggle.getAttribute('aria-label'),
      playerIcon: article.closest('.desktop-widget').querySelector('.widget-title')?.textContent,
    };
  })()`);
  assert.equal(playerWidget.title, "Ночной эфир", "плеер должен показывать название трека");
  assert.equal(playerWidget.artist, "Мой плейлист", "плеер должен показывать исполнителя");
  assert.equal(playerWidget.hasProgress, true, "плеер должен содержать управление позицией трека");
  assert.equal(playerWidget.hasPlayIcon, true, "кнопка плеера должна использовать SVG-иконку");
  assert.equal(playerWidget.seekButtons, 2, "плеер должен содержать отдельные кнопки назад и вперёд");
  assert.equal(playerWidget.seekButtonsEnabled, true, "после загрузки метаданных кнопки перемотки должны быть доступны");
  assert.equal(playerWidget.afterBack, 20, "кнопка назад должна перематывать трек на 10 секунд");
  assert.equal(playerWidget.afterForward, 30, "кнопка вперёд должна перематывать трек на 10 секунд");
  assert.equal(playerWidget.afterSlider, 75, "ползунок должен устанавливать точную позицию трека");
  assert.equal(playerWidget.transportVisible, true, "в аудиорежиме транспортная панель должна быть видима");
  assert.ok(playerWidget.coverSize.width >= 86 && playerWidget.coverSize.height >= 86, "плеер должен показывать крупную квадратную обложку");
  assert.match(playerWidget.statusWithoutSource, /Добавьте ссылку/, "без источника плеер должен подсказывать, где задать аудиофайл");
  assert.match(playerWidget.statusAfterUnsafeSource, /Добавьте ссылку/, "плеер не должен использовать небезопасную ссылку на аудио");
  assert.equal(playerWidget.youtubeLinkVisible, true, "ссылка youtu.be должна показывать явный переход на YouTube");
  assert.equal(playerWidget.youtubeLinkHref, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "ссылка YouTube должна вести на официальный просмотр видео");
  assert.equal(playerWidget.openedYoutubeUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "кнопка воспроизведения должна открывать официальный YouTube");
  assert.equal(playerWidget.noYoutubeIframe, true, "в расширении не должен создаваться iframe, вызывающий ошибку 153");
  assert.equal(playerWidget.timelineHidden, true, "для YouTube должен скрываться неподдерживаемый аудиотаймлайн");
  assert.equal(playerWidget.transportHidden, true, "для YouTube должны скрываться кнопки аудиоперемотки");
  assert.match(playerWidget.youtubeStatus, /Видео открыто на YouTube/, "после запуска виджет должен подтвердить открытие официального YouTube");
  assert.equal(playerWidget.youtubeToggleLabel, "Открыть видео на YouTube", "кнопка YouTube должна обозначать внешний официальный запуск");

  const restWidget = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const originalMediaPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
    const widget = app.registry.createWidget("rest", { position: { x: 1120, y: 80 } });
    app.store.addWidget(widget, "browser-smoke-rest");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const article = document.querySelector('[data-widget-id="' + widget.id + '"]');
    const root = article.querySelector('.rest-widget');
    const volume = root.querySelector('[data-role="volume"]');
    const timer = root.querySelector('[data-role="timer"]');
    root.querySelector('[data-sound="sea"]').click();
    volume.value = '0.7';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    timer.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const running = app.store.getState().widgets.find((item) => item.id === widget.id).config;
    const activeSea = root.querySelector('[data-sound="sea"]').classList.contains('is-active');
    const timerLabel = timer.textContent;
    root.querySelector('[data-role="toggle"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const isPlaying = root.classList.contains('is-playing');
    const localAudioSource = root.__restAudio.src;
    root.querySelector('[data-role="toggle"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const isPaused = !root.classList.contains('is-playing');
    timer.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const cleared = app.store.getState().widgets.find((item) => item.id === widget.id).config;
    app.store.updateWidget(widget.id, { config: { ...cleared, sound: 'custom', customUrl: 'http://example.test/insecure.mp3' } }, 'browser-smoke-rest-insecure-url');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    root.querySelector('[data-role="toggle"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const insecureStatus = root.querySelector('[data-role="status"]').textContent;
    const insecureCurrent = app.store.getState().widgets.find((item) => item.id === widget.id);
    app.store.updateWidget(widget.id, { config: { ...insecureCurrent.config, customUrl: 'https://example.test/unavailable.mp3' } }, 'browser-smoke-rest-failed-url');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    root.__restAudio.src = 'https://example.test/unavailable.mp3';
    root.__restAudio.dispatchEvent(new Event('error'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const failedStreamStatus = root.querySelector('[data-role="status"]').textContent;
    const result = {
      soundButtons: root.querySelectorAll('.rest-sound').length,
      activeSea,
      sound: running.sound,
      volume: running.volume,
      timerIsFuture: running.timerEndsAt > Date.now(),
      timerLabel,
      isPlaying,
      localAudioSource,
      isPaused,
      clearedTimer: cleared.timerEndsAt,
      emblem: Boolean(root.querySelector('.rest-emblem .line-icon')),
      insecureStatus,
      failedStreamStatus,
      customToggleIcon: Boolean(root.querySelector('[data-role="toggle"] .line-icon')),
    };
    HTMLMediaElement.prototype.play = originalMediaPlay;
    return result;
  })()`);
  assert.equal(restWidget.soundButtons, 6, "виджет отдыха должен предлагать пять атмосфер и свой URL");
  assert.equal(restWidget.activeSea, true, "выбранная атмосфера должна выделяться в виджете");
  assert.equal(restWidget.sound, "sea", "выбор атмосферы должен сохраняться в конфигурации");
  assert.equal(restWidget.volume, 0.7, "ползунок громкости должен сохраняться в конфигурации");
  assert.equal(restWidget.timerIsFuture, true, "кнопка таймера должна включать 25-минутное отключение");
  assert.equal(restWidget.timerLabel.length, 5, "активный таймер должен показывать время в формате ММ:СС");
  assert.equal(restWidget.isPlaying, true, "локальная реальная запись должна запускаться без синтетического шума");
  assert.match(restWidget.localAudioSource, /assets\/audio\/rest-sea-nps\.mp3$/, "для моря должен использоваться локальный реальный аудиофайл");
  assert.equal(restWidget.isPaused, true, "повторное нажатие play/pause должно останавливать атмосферу");
  assert.equal(restWidget.clearedTimer, 0, "повторное нажатие должно отключать таймер сна");
  assert.equal(restWidget.emblem, true, "виджет отдыха должен использовать SVG-line-эмблему");
  assert.match(restWidget.insecureStatus, /Укажите HTTPS-ссылку/, "небезопасная HTTP-ссылка не должна запускаться");
  assert.match(restWidget.failedStreamStatus, /Не удалось загрузить внешний источник/, "ошибка внешнего HTTPS-потока должна оставаться видимой пользователю");
  assert.equal(restWidget.customToggleIcon, true, "кнопка отдыха должна использовать SVG-иконку");

  const calculatorKeyboard = await evaluate(`(async () => {
    const id = ${JSON.stringify(addResult.id)};
    const app = window.__myFreeLayoutTab;
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const display = article.querySelector('.calculator-display');
    const press = (key) => display.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    display.focus();
    const digitHandled = press("7");
    press(",");
    const commaExpression = display.value;
    press("5");
    press("x");
    press("2");
    const expressionBeforeBackspace = display.value;
    press("9");
    const expressionAfterDigit = display.value;
    press("Backspace");
    const expressionAfterBackspace = display.value;
    press("Enter");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const result = app.store.getState().widgets.find((item) => item.id === id).config.result;
    press("Escape");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterClear = app.store.getState().widgets.find((item) => item.id === id).config;
    const keySeven = [...article.querySelectorAll('.calculator-key')].find((button) => button.textContent === "7");
    keySeven.click();
    const focusAfterButton = document.activeElement === display;
    press("8");
    const afterButtonKeyboardEntry = display.value;
    display.value = "6+6";
    display.dispatchEvent(new Event("input", { bubbles: true }));
    keySeven.focus();
    const numpadEnterHandled = keySeven.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "NumpadEnter", bubbles: true, cancelable: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const numpadEnterResult = app.store.getState().widgets.find((item) => item.id === id).config.result;
    const focusAfterNumpadEnter = document.activeElement === display;
    display.value = "7/0";
    display.dispatchEvent(new Event("input", { bubbles: true }));
    press("Enter");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const divisionByZero = app.store.getState().widgets.find((item) => item.id === id).config.result;
    display.value = "1".repeat(121);
    display.dispatchEvent(new Event("input", { bubbles: true }));
    press("Enter");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const longExpression = app.store.getState().widgets.find((item) => item.id === id).config.result;
    return { commaExpression, expressionBeforeBackspace, expressionAfterDigit, expressionAfterBackspace, result, digitHandled, afterClear, focusAfterButton, afterButtonKeyboardEntry, numpadEnterHandled, numpadEnterResult, focusAfterNumpadEnter, divisionByZero, longExpression };
  })()`);
  assert.equal(calculatorKeyboard.commaExpression, "7.", "запятая на клавиатуре должна добавлять десятичную точку");
  assert.equal(calculatorKeyboard.expressionBeforeBackspace, "7.5*2", "цифры и оператор умножения должны вставляться с клавиатуры");
  assert.equal(calculatorKeyboard.expressionAfterDigit, "7.5*29", "нажатая цифра должна быть добавлена обработчиком калькулятора");
  assert.equal(calculatorKeyboard.expressionAfterBackspace, "7.5*2", "Backspace должен удалять последний символ выражения");
  assert.equal(calculatorKeyboard.result, "15", "Enter должен вычислять выражение, введённое с клавиатуры");
  assert.equal(calculatorKeyboard.digitHandled, false, "калькулятор должен сам обрабатывать цифры и отменять нативный ввод");
  assert.equal(calculatorKeyboard.afterClear.expression, "", "Escape должен очищать выражение калькулятора");
  assert.equal(calculatorKeyboard.focusAfterButton, true, "после нажатия экранной клавиши фокус должен возвращаться в поле выражения");
  assert.equal(calculatorKeyboard.afterButtonKeyboardEntry, "78", "после экранной клавиши пользователь должен сразу продолжать ввод с клавиатуры");
  assert.equal(calculatorKeyboard.numpadEnterHandled, false, "Enter цифрового блока должен отменять нативное действие и вычислять выражение");
  assert.equal(calculatorKeyboard.numpadEnterResult, "12", "Enter цифрового блока должен вычислять выражение, даже если фокус оказался на экранной кнопке");
  assert.equal(calculatorKeyboard.focusAfterNumpadEnter, true, "после вычисления фокус должен вернуться в поле выражения");
  assert.equal(calculatorKeyboard.afterClear.result, "", "Escape должен очищать результат калькулятора");
  assert.equal(calculatorKeyboard.divisionByZero, "Ошибка", "деление на ноль не должно возвращать бесконечность");
  assert.equal(calculatorKeyboard.longExpression, "Ошибка", "выражение длиннее 120 символов должно отклоняться");
  const interfaceScale = await evaluate(`(async () => {
    const id = ${JSON.stringify(addResult.id)};
    const app = window.__myFreeLayoutTab;
    const current = app.store.getState().widgets.find((item) => item.id === id);
    const properties = app.registry.propertiesFor(current).map((property) => property.key);
    app.store.updateWidget(id, { style: { ...current.style, autoScale: false, interfaceScale: 1.35 } }, "browser-smoke-manual-interface-scale");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const manual = Number.parseFloat(getComputedStyle(article).getPropertyValue("--widget-interface-scale"));
    const resized = app.store.getState().widgets.find((item) => item.id === id);
    app.store.updateWidget(id, { size: { w: 174, h: 231 }, style: { ...resized.style, autoScale: true, interfaceScale: 1 } }, "browser-smoke-auto-interface-scale");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const automatic = Number.parseFloat(getComputedStyle(article).getPropertyValue("--widget-interface-scale"));
    const scaleLayer = article.querySelector(".widget-scale-layer");
    return { properties, manual, automatic, hasScaleLayer: Boolean(scaleLayer), transitionProperty: getComputedStyle(scaleLayer).transitionProperty };
  })()`);
  assert.equal(interfaceScale.properties.includes("autoScale"), true, "н.в. должна содержать переключатель автомасштабирования");
  assert.equal(interfaceScale.properties.includes("interfaceScale"), true, "н.в. должна содержать ручной масштаб интерфейса");
  assert.equal(interfaceScale.manual, 1.35, "ручной масштаб должен применяться при выключенном автомасштабировании");
  assert.equal(interfaceScale.automatic, .72, "автомасштабирование должно уменьшать интерфейс для маленького виджета");
  assert.equal(interfaceScale.hasScaleLayer, true, "масштабироваться должно только внутреннее содержимое виджета");
  assert.match(interfaceScale.transitionProperty, /transform/, "внутренний масштаб должен плавно анимироваться");

  const snakeWidget = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const widget = app.registry.createWidget("snake", { position: { x: 460, y: 80 } });
    app.store.addWidget(widget, "browser-smoke-snake");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const article = document.querySelector('[data-widget-id="' + widget.id + '"]');
    const grid = article.querySelector('.snake-grid');
    grid.focus();
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const playing = app.store.getState().widgets.find((item) => item.id === widget.id).config;
    article.querySelector('[data-role="toggle"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const paused = app.store.getState().widgets.find((item) => item.id === widget.id).config;
    article.querySelector('[data-role="reset"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const reset = app.store.getState().widgets.find((item) => item.id === widget.id).config;
    const current = app.store.getState().widgets.find((item) => item.id === widget.id);
    app.store.updateWidget(widget.id, { size: { w: 260, h: 300 }, style: { ...current.style, autoScale: true, interfaceScale: 1 } }, "browser-smoke-snake-compact");
    await new Promise((resolve) => setTimeout(resolve, 220));
    const gridRect = grid.getBoundingClientRect();
    const actionsRect = article.querySelector('.snake-actions').getBoundingClientRect();
    return { id: widget.id, cells: grid.children.length, controls: article.querySelectorAll('.snake-direction').length, hasControls: Boolean(article.querySelector('.snake-controls')), playingStatus: playing.status, direction: playing.queuedDirection, pausedStatus: paused.status, resetStatus: reset.status, resetScore: reset.score, compactNoOverlap: gridRect.bottom <= actionsRect.top + .5, actionsWidth: actionsRect.width, gridHeight: gridRect.height };
  })()`);
  assert.equal(snakeWidget.cells, 144, "поле «Змейки» должно состоять из сетки 12×12");
  assert.equal(snakeWidget.controls, 0, "визуальные кнопки направления не должны отображаться в «Змейке»");
  assert.equal(snakeWidget.hasControls, false, "блок визуальных стрелок не должен рендериться");
  assert.equal(snakeWidget.playingStatus, "playing", "стрелка на сфокусированном поле должна запускать «Змейку»");
  assert.equal(snakeWidget.direction, "down", "стрелка должна менять направление «Змейки»");
  assert.equal(snakeWidget.pausedStatus, "paused", "кнопка паузы должна останавливать игру");
  assert.equal(snakeWidget.resetStatus, "ready", "новая игра должна возвращать «Змейку» в готовое состояние");
  assert.equal(snakeWidget.resetScore, 0, "новая игра должна сбрасывать текущий счёт");
  assert.equal(snakeWidget.compactNoOverlap, true, "в компактном размере поле и действия «Змейки» не должны пересекаться");
  assert.ok(snakeWidget.actionsWidth > 0 && snakeWidget.gridHeight > 0, "поле и игровые действия «Змейки» должны оставаться видимыми");
  const snakeButtonContrast = await evaluate(`(() => {
    const article = document.querySelector('[data-widget-id="${snakeWidget.id}"]');
    const button = article.querySelector('[data-role="toggle"]');
    button.focus({ focusVisible: true });
    return { color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor };
  })()`);
  assert.doesNotMatch(snakeButtonContrast.color, /0(?:,\s*|\s+)255(?:,\s*|\s+)(?:65|102)/, "текст кнопки «Снова» не должен становиться зелёным и нечитаемым");
  const compactCurrency = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const previousTheme = app.store.getState().settings.themeId;
    app.store.updateSettings({ themeId: 'green-console' }, 'browser-smoke-currency-green');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const widget = app.registry.createWidget('currency', { position: { x: 720, y: 80 }, size: { w: 300, h: 190 } });
    app.store.addWidget(widget, 'browser-smoke-currency-compact');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const article = document.querySelector('[data-widget-id="' + widget.id + '"]');
    const rate = article.querySelector('[data-role="rate"]').getBoundingClientRect();
    const status = article.querySelector('[data-role="date"]').getBoundingClientRect();
    const action = article.querySelector('.currency-widget > .text-action').getBoundingClientRect();
    return { rateBottom: rate.bottom, statusTop: status.top, statusBottom: status.bottom, actionTop: action.top, textBands: article.querySelectorAll('.currency-meta > *').length, previousTheme };
  })()`);
  assert.equal(compactCurrency.textBands, 2, "курс и статус валют должны располагаться в отдельных строках");
  assert.ok(compactCurrency.rateBottom <= compactCurrency.statusTop + .5, "строка курса не должна накладываться на статус обновления");
  assert.ok(compactCurrency.statusBottom <= compactCurrency.actionTop + .5, "статус обновления не должен накладываться на кнопку обновления");
  await evaluate(`window.__myFreeLayoutTab.store.updateSettings({ themeId: ${JSON.stringify(compactCurrency.previousTheme)} }, 'browser-smoke-currency-theme-restore')`);

  const moved = await evaluate(`(async () => {
    const id = ${JSON.stringify(addResult.id)};
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const header = article.querySelector('[data-role="drag-region"]');
    const before = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id).position;
    header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 17, clientX: 100, clientY: 100 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 17, clientX: 142, clientY: 126 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 17, clientX: 142, clientY: 126 }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const after = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id).position;
    return { before, after };
  })()`);
  assert.notDeepEqual(moved.before, moved.after, "перетаскивание должно менять позицию виджета");

  const resized = await evaluate(`(async () => {
    const id = ${JSON.stringify(addResult.id)};
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const handle = article.querySelector('[data-action="resize"]');
    const before = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id).size;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 18, clientX: 210, clientY: 210 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 18, clientX: 258, clientY: 250 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 18, clientX: 258, clientY: 250 }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const after = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id).size;
    return { before, after };
  })()`);
  assert.notDeepEqual(resized.before, resized.after, "изменение размера должно менять размер виджета");

  const calendar = await evaluate(`(() => {
    const app = window.__myFreeLayoutTab;
    const widget = app.registry.createWidget("calendar", { position: { x: 390, y: 80 } });
    app.store.addWidget(widget, "browser-smoke-calendar");
    return widget.id;
  })()`);
  await waitFor(`Boolean(document.querySelector('[data-widget-id="${calendar}"] .calendar-hero'))`, "обновлённая шапка календаря");
  const calendarLayout = await evaluate(`(() => {
    const id = ${JSON.stringify(calendar)};
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const root = article.querySelector('.calendar-widget');
    const grid = root.querySelector('.calendar-grid');
    const start = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id).config.offset;
    root.querySelector('.calendar-nav-button').click();
    const movedOffset = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id).config.offset;
    root.querySelector('.calendar-today-button').click();
    const resetOffset = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id).config.offset;
    return {
      cells: grid.children.length,
      weekdays: root.querySelectorAll('.calendar-weekdays span').length,
      heroRadius: getComputedStyle(root.querySelector('.calendar-hero')).borderRadius,
      start,
      movedOffset,
      resetOffset,
    };
  })()`);
  assert.equal(calendarLayout.cells, 42, "календарь должен иметь ровную сетку из шести недель");
  assert.equal(calendarLayout.weekdays, 7, "календарь должен отображать семь подписей дней недели");
  assert.notEqual(calendarLayout.heroRadius, "0px", "шапка календаря должна получить карточное оформление");
  assert.equal(calendarLayout.movedOffset, calendarLayout.start - 1, "кнопка предыдущего месяца должна менять смещение");
  assert.equal(calendarLayout.resetOffset, 0, "кнопка «Сегодня» должна возвращать текущий месяц");

  const todoCalendar = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const todo = app.store.getState().widgets.find((item) => item.type === "todo");
    const due = new Date();
    const dueDate = due.getFullYear() + "-" + String(due.getMonth() + 1).padStart(2, "0") + "-" + String(due.getDate()).padStart(2, "0");
    const manualDate = String(due.getDate()).padStart(2, "0") + "." + String(due.getMonth() + 1).padStart(2, "0") + "." + due.getFullYear();
    const partialYear = manualDate.slice(0, 8);
    const todoArticle = document.querySelector('[data-widget-id="' + todo.id + '"]');
    const input = todoArticle.querySelector('.todo-input');
    const datePicker = todoArticle.querySelector('.todo-add .date-picker');
    const dateInput = datePicker.querySelector('.date-picker-trigger-input');
    const addButton = todoArticle.querySelector('.todo-add .icon-action');
    const rect = (node) => { const box = node.getBoundingClientRect(); return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height }; };
    const addRow = { input: rect(input), date: rect(datePicker), button: rect(addButton) };
    input.value = "Подготовить отчёт";
    dateInput.value = partialYear;
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    const partialValue = dateInput.value;
    const partialSelected = datePicker.dataset.value;
    dateInput.value = manualDate;
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    const completedValue = dateInput.value;
    datePicker.querySelector('.date-picker-trigger-marker').click();
    const popup = document.querySelector('.date-picker-popover.is-open');
    const popupDays = popup.querySelectorAll('.date-picker-day:not(.is-empty)').length;
    popup.querySelector('[data-value="' + dueDate + '"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    dateInput.blur();
    todoArticle.querySelector('.todo-add .icon-action').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const calendarArticle = document.querySelector('[data-widget-id="' + ${JSON.stringify(calendar)} + '"]');
    const refreshedTodoArticle = document.querySelector('[data-widget-id="' + todo.id + '"]');
    const scheduled = calendarArticle.querySelectorAll('.calendar-day.is-scheduled');
    const calendarGrid = calendarArticle.querySelector('.calendar-grid');
    const scheduledMarker = scheduled[0]?.querySelector('.calendar-task-marker .line-icon');
    const oldTaskCount = scheduled[0]?.querySelector('.calendar-task-count');
    const gridStyle = getComputedStyle(calendarGrid);
    const scheduledStyle = scheduled[0] ? getComputedStyle(scheduled[0]) : null;
    const scheduledNumberStyle = scheduled[0] ? getComputedStyle(scheduled[0].querySelector('.calendar-day-number')) : null;
    const todoState = app.store.getState().widgets.find((item) => item.id === todo.id);
    const task = todoState.config.tasks.at(-1);
    const todoRow = refreshedTodoArticle.querySelector('.todo-list .todo-item:last-child');
    const todoCells = { checkbox: rect(todoRow.querySelector('.todo-checkbox')), label: rect(todoRow.querySelector('.todo-label')), date: rect(todoRow.querySelector('.todo-date-picker')), remove: rect(todoRow.querySelector('.remove-action')) };
    const todoRowIsTable = todoRow.classList.contains('todo-item');
    const todoListStyle = getComputedStyle(refreshedTodoArticle.querySelector('.todo-list'));
    const checkboxIsCustom = todoRow.querySelector('.todo-checkbox')?.classList.contains('todo-checkbox') === true;
    const rowDate = refreshedTodoArticle.querySelector('.todo-list .todo-item:last-child .date-picker')?.dataset.value || "";
    const nativeDateInputs = refreshedTodoArticle.querySelectorAll('input[type="date"]').length;
    const popupClosed = !document.querySelector('.date-picker-popover.is-open');
    app.store.updateWidget(todo.id, { size: { w: 180, h: 112 } }, 'browser-smoke-todo-compact-size');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 240));
    const compactArticle = document.querySelector('[data-widget-id="' + todo.id + '"]');
    const compactCard = rect(compactArticle);
    const compactAdd = rect(compactArticle.querySelector('.todo-add'));
    const compactDateInput = rect(compactArticle.querySelector('.todo-list .todo-item:last-child .date-picker-trigger-input'));
    const compactDateTrigger = rect(compactArticle.querySelector('.todo-list .todo-item:last-child .date-picker-trigger'));
    const compact = { width: compactCard.width, height: compactCard.height, addVisible: compactAdd.top >= compactCard.top && compactAdd.bottom <= compactCard.bottom, dateContained: compactDateInput.left >= compactDateTrigger.left && compactDateInput.right <= compactDateTrigger.right + .5 };
    app.store.updateWidget(todo.id, { config: { ...todoState.config, tasks: todoState.config.tasks.map((item) => item.id === task.id ? { ...item, done: true } : item) } }, 'browser-smoke-todo-complete');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return { dueDate, manualDate, partialYear, partialValue, partialSelected, completedValue, taskDueDate: task?.dueDate || "", rowDate, popupDays, nativeDateInputs, popupClosed, addRow, todoCells, todoRowIsTable, todoListBorderWidth: todoListStyle.borderTopWidth, checkboxIsCustom, compact, scheduledBeforeDone: scheduled.length, scheduledAfterDone: calendarArticle.querySelectorAll('.calendar-day.is-scheduled').length, hasTaskMarker: Boolean(scheduledMarker), hasOldTaskCount: Boolean(oldTaskCount), gridGap: gridStyle.gap, gridBorderWidth: gridStyle.borderTopWidth, scheduledBoxShadow: scheduledStyle?.boxShadow || "", scheduledNumberRadius: scheduledNumberStyle?.borderRadius || "" };
  })()`);
  assert.equal(todoCalendar.partialValue, todoCalendar.partialYear, "незавершённый год не должен сбрасываться после двух цифр");
  assert.equal(todoCalendar.partialSelected, "", "неполная дата не должна преждевременно записываться в задачу");
  assert.equal(todoCalendar.completedValue, todoCalendar.manualDate, "полная дата должна сохранять все четыре цифры года");
  assert.equal(todoCalendar.taskDueDate, todoCalendar.dueDate, "дата задачи должна сохраняться в конфигурации To‑Do");
  assert.equal(todoCalendar.rowDate, todoCalendar.dueDate, "дата должна отображаться в строке задачи");
  assert.ok(todoCalendar.popupDays >= 28, "встроенный календарь должен показывать дни выбранного месяца");
  assert.equal(todoCalendar.nativeDateInputs, 0, "в задачах не должно остаться системных полей даты");
  assert.equal(todoCalendar.popupClosed, true, "календарь должен закрываться после выбора даты");
  [todoCalendar.addRow.input, todoCalendar.addRow.date, todoCalendar.addRow.button].forEach((item) => {
    assert.equal(item.height, 36, "все элементы добавления задачи должны иметь одинаковую высоту");
    assert.equal(item.top, todoCalendar.addRow.input.top, "поле задачи, дата и кнопка должны находиться на одной горизонтальной линии");
  });
  assert.equal(todoCalendar.todoRowIsTable, true, "задача должна рендериться отдельной табличной строкой");
  assert.equal(todoCalendar.todoListBorderWidth, "1px", "список задач должен иметь тонкую общую обводку");
  assert.equal(todoCalendar.checkboxIsCustom, true, "чекбокс задачи должен использовать выделенный контракт кастомного оформления");
  assert.ok(todoCalendar.todoCells.checkbox.right <= todoCalendar.todoCells.label.left + .5, "чекбокс не должен перекрываться текстом задачи");
  assert.ok(todoCalendar.todoCells.label.right <= todoCalendar.todoCells.date.left + .5, "текст задачи и дата должны находиться в отдельных колонках");
  assert.ok(todoCalendar.todoCells.date.right <= todoCalendar.todoCells.remove.left + .5, "дата и удаление должны находиться в отдельных колонках");
  assert.ok(todoCalendar.compact.width >= 256 && todoCalendar.compact.height >= 220, "виджет задач не должен сжиматься меньше безопасного размера для полной даты и нижней панели");
  assert.equal(todoCalendar.compact.addVisible, true, "нижняя панель добавления задачи должна оставаться полностью видимой");
  assert.equal(todoCalendar.compact.dateContained, true, "поле даты не должно выходить за собственную границу в компактном виде");
  assert.equal(todoCalendar.scheduledBeforeDone, 1, "задача с датой должна сразу появляться на календаре");
  assert.equal(todoCalendar.hasTaskMarker, true, "запланированная задача должна обозначаться SVG-line-маркером");
  assert.equal(todoCalendar.hasOldTaskCount, false, "числовой бейдж задачи должен быть заменён на компактную иконку");
  assert.equal(todoCalendar.gridGap, "4px 3px", "дни календаря должны иметь свободный ритм без сплошной сетки");
  assert.equal(todoCalendar.gridBorderWidth, "0px", "календарь не должен иметь обводку сетки дней");
  assert.ok(["", "none"].includes(todoCalendar.scheduledBoxShadow), "запланированный день не должен получать контурную обводку");
  assert.notEqual(todoCalendar.scheduledNumberRadius, "0px", "акцент запланированного дня должен оставаться мягким и без рамки");
  assert.equal(todoCalendar.scheduledAfterDone, 0, "выполненная задача не должна оставаться в календаре");

  const customMenus = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const widget = app.registry.createWidget('countdown', { position: { x: 860, y: 80 } });
    app.store.addWidget(widget, 'browser-smoke-custom-menus');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const article = document.querySelector('[data-widget-id="' + widget.id + '"]');
    article.querySelector('[data-action="properties"]').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const panel = document.getElementById('properties-panel');
    const groups = [...panel.querySelectorAll('.property-group')];
    const groupNames = groups.map((group) => group.querySelector('.property-group-title')?.textContent.trim());
    const textGroup = groups.find((group) => group.querySelector('.property-group-title')?.textContent.trim() === 'Текст');
    const surfaceGroup = groups.find((group) => group.querySelector('.property-group-title')?.textContent.trim() === 'Поверхность');
    const surfaceCollapsedBeforeOpen = surfaceGroup?.querySelector('.property-group-content')?.hidden === true;
    textGroup.querySelector('.property-group-trigger').click();
    const trigger = textGroup.querySelector('.property-select-menu .select-menu-trigger');
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    const expanded = trigger.getAttribute('aria-expanded');
    const focusedOption = document.activeElement?.classList.contains('select-menu-option');
    const textExpanded = textGroup.querySelector('.property-group-trigger').getAttribute('aria-expanded');
    const customSelects = panel.querySelectorAll('.select-menu').length;
    const customDateTime = Boolean(panel.querySelector('.datetime-composite .date-picker-trigger-input'));
    const originalRemoveEventListener = document.removeEventListener;
    let removedCaptureListeners = 0;
    document.removeEventListener = function(type, listener, options) {
      if (type === 'pointerdown' && options === true) removedCaptureListeners += 1;
      return originalRemoveEventListener.call(this, type, listener, options);
    };
    panel.querySelector('.panel-close').click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    document.removeEventListener = originalRemoveEventListener;
    return {
      nativeSelects: document.querySelectorAll('select').length,
      nativeDateMenus: document.querySelectorAll('input[type="date"], input[type="datetime-local"], input[type="color"]').length,
      customSelects,
      customDateTime,
      expanded,
      focusedOption,
      groupNames,
      surfaceCollapsedBeforeOpen,
      textExpanded,
      panelHiddenAfterClose: panel.hidden,
      removedCaptureListeners,
    };
  })()`);
  assert.equal(customMenus.nativeSelects, 0, "в интерфейсе не должно оставаться системных select");
  assert.equal(customMenus.nativeDateMenus, 0, "дата, время и цвет должны использовать кастомные контролы");
  assert.ok(customMenus.customSelects > 0, "свойства виджета должны использовать встроенные меню выбора");
  assert.equal(customMenus.customDateTime, true, "выбор даты и времени должен быть составным кастомным контролом");
  assert.equal(customMenus.expanded, 'true', "кастомное меню должно открываться с клавиатуры");
  assert.equal(customMenus.focusedOption, true, "первый пункт кастомного меню должен получать фокус при открытии с клавиатуры");
  assert.deepEqual(customMenus.groupNames.slice(0, 5), ["Панель н.в.", "Размер виджета", "Быстрые действия", "Основное", "Событие"], "н.в. должна располагать основные группы в предсказуемом порядке");
  assert.equal(customMenus.surfaceCollapsedBeforeOpen, true, "расширенное оформление должно быть свёрнуто по умолчанию");
  assert.equal(customMenus.textExpanded, "true", "группа должна раскрываться по явному нажатию");
  assert.equal(customMenus.panelHiddenAfterClose, true, "закрытие н.в. должно скрывать панель");
  assert.ok(customMenus.removedCaptureListeners >= 1, "закрытие н.в. должно освобождать глобальный слушатель открытого меню");

  const material = await evaluate(`(() => {
    const id = ${JSON.stringify(calendar)};
    const app = window.__myFreeLayoutTab;
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const alphaFor = (surfaceMode, opacity = .35) => {
      const current = app.store.getState().widgets.find((item) => item.id === id);
      app.store.updateWidget(id, { style: { ...current.style, surfaceMode, opacity } }, "browser-smoke-surface-mode");
      const computed = getComputedStyle(article);
      return { mode: article.dataset.surface, alpha: Number.parseFloat(computed.getPropertyValue("--widget-surface-alpha")), controlAlpha: article.style.getPropertyValue("--widget-surface-control-alpha"), headerAlpha: Number.parseFloat(computed.getPropertyValue("--widget-header-alpha")), backdrop: computed.backdropFilter, backgroundImage: computed.backgroundImage };
    };
    const soft = alphaFor("soft");
    const glass = alphaFor("glass");
    const acrylic = alphaFor("acrylic");
    const clear = alphaFor("clear");
    const manual = alphaFor("custom");
    const solid = alphaFor("solid");
    const minimumSoft = alphaFor("soft", 0);
    const minimumGlass = alphaFor("glass", 0);
    const minimumAcrylic = alphaFor("acrylic", 0);
    const minimumClear = alphaFor("clear", 0);
    const minimumManual = alphaFor("custom", 0);
    return { soft, glass, acrylic, clear, manual, solid, minimumSoft, minimumGlass, minimumAcrylic, minimumClear, minimumManual };
  })()`);
  [material.soft, material.glass, material.acrylic, material.clear, material.manual].forEach((entry) => assert.equal(entry.controlAlpha, "0.35", `режим «${entry.mode}» должен сохранять значение общего ползунка`));
  [material.soft, material.glass, material.acrylic, material.clear, material.manual].forEach((entry) => assert.equal(entry.alpha, 35, `режим «${entry.mode}» должен использовать фактическое значение ползунка`));
  [material.minimumSoft, material.minimumGlass, material.minimumAcrylic, material.minimumClear, material.minimumManual].forEach((entry) => {
    assert.equal(entry.alpha, 0, `минимум режима «${entry.mode}» должен убирать заливку поверхности`);
    assert.equal(entry.headerAlpha, 0, `минимум режима «${entry.mode}» должен убирать заливку заголовка`);
  });
  assert.match(material.glass.backgroundImage, /gradient/, "стекло должно иметь отдельный световой слой");
  assert.match(material.acrylic.backgroundImage, /gradient/, "акрил должен иметь отдельный тонированный слой");
  assert.match(material.clear.backgroundImage, /gradient/, "почти прозрачный режим должен иметь самостоятельную поверхность");
  assert.match(material.acrylic.backdrop, /blur\(30px\)/, "акриловый режим должен включать выраженный блюр");
  assert.equal(material.solid.alpha, 100, "непрозрачный режим должен фиксировать поверхность на 100%");

  const searchWidget = await evaluate(`(() => {
    const app = window.__myFreeLayoutTab;
    const widget = app.registry.createWidget("search", { position: { x: 400, y: 420 } });
    app.store.addWidget(widget, "browser-smoke-search-menu");
    return widget.id;
  })()`);
  await waitFor(`Boolean(document.querySelector('[data-widget-id="${searchWidget}"] .search-form'))`, "рендер виджета поиска");
  const searchMenu = await evaluate(`(() => {
    const id = ${JSON.stringify(searchWidget)};
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const hasLocalEngineMenu = Boolean(article.querySelector('.search-engine-menu'));
    const hasInput = Boolean(article.querySelector('.search-input'));
    const hasSubmit = Boolean(article.querySelector('.search-submit'));
    const nativeSelects = document.querySelectorAll('select').length;
    const widget = window.__myFreeLayoutTab.store.getState().widgets.find((item) => item.id === id);
    const propertyKeys = window.__myFreeLayoutTab.registry.propertiesFor(widget).map((property) => property.key);
    const globalEngine = window.__myFreeLayoutTab.store.getState().settings.search?.defaultEngine || "google";
    window.__myFreeLayoutTab.store.updateSettings({ search: { defaultEngine: "yandex" } });
    const updatedEngine = window.__myFreeLayoutTab.store.getState().settings.search?.defaultEngine;
    window.__myFreeLayoutTab.store.updateSettings({ search: { defaultEngine: "google" } });
    return { hasLocalEngineMenu, hasInput, hasSubmit, nativeSelects, propertyKeys, globalEngine, updatedEngine };
  })()`);
  assert.equal(searchMenu.hasLocalEngineMenu, false, "виджет поиска не должен содержать локальный селектор системы");
  assert.equal(searchMenu.hasInput, true, "виджет поиска должен содержать поле запроса");
  assert.equal(searchMenu.hasSubmit, true, "виджет поиска должен содержать кнопку поиска");
  assert.equal(searchMenu.nativeSelects, 0, "не должно остаться системных select");
  assert.equal(searchMenu.propertyKeys.includes("fontScale"), false, "н.в. поиска не должна содержать размер текста");
  assert.equal(searchMenu.updatedEngine, "yandex", "глобальная настройка поисковой системы должна сохраняться в настройках");

  const themeAccentAudit = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const themeIds = ["midnight", "paper", "forest", "ocean", "violet", "ember"];
    const report = [];
    for (const themeId of themeIds) {
      app.store.updateSettings({ themeId }, "browser-smoke-theme-accent-audit");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const themeAccent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const widgetAccents = [...document.querySelectorAll(".desktop-widget")].slice(0, 4).map((article) => getComputedStyle(article).getPropertyValue("--widget-accent").trim());
      report.push({ themeId, themeAccent, widgetAccents });
    }
    return report;
  })()`);
  themeAccentAudit.forEach((entry) => entry.widgetAccents.forEach((accent) => assert.equal(accent, entry.themeAccent, `стандартный виджет должен наследовать акцент темы «${entry.themeId}»`)));

  const noBlueThemeGuard = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const id = ${JSON.stringify(calendar)};
    const current = app.store.getState().widgets.find((item) => item.id === id);
    app.store.updateWidget(id, { style: { ...current.style, useThemeAccent: false, accent: "#7ca8ff", background: "#1d2744", color: "#7ca8ff", borderColor: "#7ca8ff", headerColor: "#1d2744", headerTextColor: "#7ca8ff" } }, "browser-smoke-blue-leak");
    const themeIds = ["paper", "forest", "violet", "ember", "green-console"];
    const report = {};
    for (const themeId of themeIds) {
      app.store.updateSettings({ themeId, customTheme: { "--accent": "#7ca8ff", "--surface": "#1d2744" } }, "browser-smoke-no-blue-theme");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const article = document.querySelector('[data-widget-id="' + id + '"]');
      report[themeId] = {
        accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
        widgetAccent: article.style.getPropertyValue("--widget-accent"),
        localSurface: article.style.getPropertyValue("--widget-surface"),
        localText: article.style.getPropertyValue("--widget-custom-color"),
        localBorder: article.style.getPropertyValue("--widget-border-color"),
      };
    }
    app.store.updateSettings({ themeId: "ember", customTheme: { "--accent": "#7ca8ff", "--surface": "#1d2744" } }, "browser-smoke-ember-game");
    const game = app.registry.createWidget("game", { position: { x: 620, y: 60 } });
    app.store.addWidget(game, "browser-smoke-ember-game");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    report.ember.tileBackground = getComputedStyle(document.querySelector('[data-widget-id="' + game.id + '"] .tile-2')).backgroundColor;
    return report;
  })()`);
  const expectedNoBlueAccents = { paper: "#8a5a43", forest: "#a9c86b", violet: "#d7a8d6", ember: "#e0a167", "green-console": "#00ff66" };
  Object.entries(expectedNoBlueAccents).forEach(([themeId, accent]) => {
    const report = noBlueThemeGuard[themeId];
    assert.equal(report.accent, accent, `синий пользовательский акцент не должен переопределять тему «${themeId}»`);
    assert.equal(report.widgetAccent, "var(--accent)", `синий индивидуальный акцент не должен применяться в теме «${themeId}»`);
    assert.equal(report.localSurface, "", `синяя индивидуальная поверхность не должна применяться в теме «${themeId}»`);
    assert.equal(report.localText, "", `синий индивидуальный текст не должен применяться в теме «${themeId}»`);
    assert.equal(report.localBorder, "", `синяя индивидуальная граница не должна применяться в теме «${themeId}»`);
  });
  assert.match(noBlueThemeGuard.ember.tileBackground, /84,\s*53,\s*41/, "плитка 2048 темы «Тлеющий уголь» не должна использовать синий цвет");

  const greenConsoleTheme = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const id = ${JSON.stringify(calendar)};
    const current = app.store.getState().widgets.find((item) => item.id === id);
    app.store.updateWidget(id, { style: { ...current.style, surfaceMode: "solid", opacity: 1 } }, "browser-smoke-green-console-surface");
    app.store.updateSettings({ themeId: "green-console" }, "browser-smoke-green-console-theme");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    const style = getComputedStyle(article);
    return {
      theme: document.documentElement.dataset.theme,
      surface: document.documentElement.style.getPropertyValue("--surface-strong").trim(),
      widgetAccent: style.getPropertyValue("--widget-accent").trim(),
      widgetText: style.getPropertyValue("--widget-custom-color").trim(),
      background: style.backgroundColor,
      borderStyle: style.borderStyle,
      borderRadius: style.borderRadius,
      cornerBefore: getComputedStyle(article, "::before").content,
      cornerAfter: getComputedStyle(article, "::after").content,
    };
  })()`);
  assert.equal(greenConsoleTheme.theme, "green-console", "новая кислотно-зелёная тема должна применяться к документу");
  assert.equal(greenConsoleTheme.surface, "#000000", "поверхности новой темы должны быть строго чёрными");
  assert.equal(greenConsoleTheme.widgetAccent, "#00ff66", "обводка всех виджетов новой темы должна быть кислотно-зелёной");
  assert.equal(greenConsoleTheme.widgetText, "#b5ffc7", "основной текст виджетов новой темы должен использовать светло-зелёный оттенок");
  assert.ok(greenConsoleTheme.background, "виджет зелёной темы должен иметь вычисленный фон");
  assert.equal(greenConsoleTheme.borderStyle, "solid", "виджет зелёной темы должен иметь цельную рамку");
  assert.equal(greenConsoleTheme.borderRadius, "8px", "виджет зелёной темы должен иметь мягкое скругление");
  assert.equal(greenConsoleTheme.cornerBefore, "none", "рамка не должна дополняться угловой накладкой");
  assert.equal(greenConsoleTheme.cornerAfter, "none", "рамка не должна дополняться угловой накладкой");
  const globalCorners = await evaluate(`(async () => {
    const app = window.__myFreeLayoutTab;
    const behavior = app.store.getState().settings.behavior;
    const article = document.querySelector('.desktop-widget');
    const control = document.querySelector('.calculator-key');
    app.store.updateSettings({ behavior: { ...behavior, roundedCorners: false } }, "browser-smoke-square-corners");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const square = { mode: document.documentElement.dataset.corners, widget: getComputedStyle(article).borderRadius, control: getComputedStyle(control).borderRadius };
    app.store.updateSettings({ behavior: { ...app.store.getState().settings.behavior, roundedCorners: true, cornerRadius: 18 } }, "browser-smoke-rounded-corners");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const rounded = { mode: document.documentElement.dataset.corners, widget: getComputedStyle(article).borderRadius, control: getComputedStyle(control).borderRadius };
    return { square, rounded };
  })()`);
  assert.deepEqual(globalCorners.square, { mode: "square", widget: "0px", control: "0px" }, "выключение скругления должно делать углы всех элементов прямыми");
  assert.equal(globalCorners.rounded.mode, "rounded", "включение скругления должно возвращать обычный режим интерфейса");
  assert.equal(globalCorners.rounded.widget, "18px", "выбранный глобальный радиус должен применяться к карточке активной темы");
  assert.equal(globalCorners.rounded.control, "18px", "выбранный глобальный радиус должен применяться к контролам");

  const iconSystem = await evaluate(`(() => ({
    actionIcons: document.querySelectorAll('.widget-action .line-icon').length,
    dockIcons: document.querySelectorAll('#dock .line-icon').length,
    searchIcon: Boolean(document.querySelector('.search-submit .line-icon')),
    weatherIcon: Boolean(document.querySelector('.weather-icon .line-icon')),
    textActions: [...document.querySelectorAll('.widget-action')].map((button) => button.textContent.trim()),
  }))()`);
  assert.ok(iconSystem.actionIcons >= 4, "управление карточками должно использовать SVG-иконки");
  assert.ok(iconSystem.dockIcons >= 2, "док должен использовать SVG-иконки");
  assert.equal(iconSystem.searchIcon, true, "кнопка поиска должна использовать SVG-иконку");
  assert.equal(iconSystem.weatherIcon, true, "погода должна использовать SVG-иконку вместо emoji");
  assert.deepEqual(iconSystem.textActions, Array(iconSystem.textActions.length).fill(""), "в кнопках управления карточек не должно быть текстовых символов");
  const iconCentering = await evaluate(`(() => {
    const measure = (button) => {
      const icon = button.querySelector('.line-icon');
      const box = button.getBoundingClientRect();
      const graphic = icon.getBoundingClientRect();
      return {
        dx: Math.abs((graphic.left + graphic.width / 2) - (box.left + box.width / 2)),
        dy: Math.abs((graphic.top + graphic.height / 2) - (box.top + box.height / 2)),
      };
    };
    return {
      actions: [...document.querySelectorAll('.widget-action')].slice(0, 4).map(measure),
      dock: [...document.querySelectorAll('.dock-button')].slice(0, 2).map(measure),
    };
  })()`);
  [...iconCentering.actions, ...iconCentering.dock].forEach((offset) => {
    assert.ok(offset.dx <= 0.25 && offset.dy <= 0.25, "SVG-иконка должна находиться точно в центре компактной кнопки");
  });

  await cdp("Emulation.setEmulatedMedia", { features: [
    { name: "prefers-reduced-motion", value: "reduce" },
    { name: "prefers-reduced-transparency", value: "reduce" },
    { name: "prefers-contrast", value: "more" },
  ] });
  const accessibility = await evaluate(`(() => {
    const widget = document.querySelector('[data-widget-id="' + ${JSON.stringify(calendar)} + '"]');
    return { motion: getComputedStyle(document.documentElement).getPropertyValue('--motion-duration').trim(), border: getComputedStyle(widget).borderTopWidth, blur: getComputedStyle(widget).backdropFilter };
  })()`);
  assert.equal(accessibility.motion, "0ms", "системное уменьшение анимации должно отключать переходы");
  assert.equal(accessibility.border, "2px", "повышенный системный контраст должен усиливать границу виджета");
  assert.equal(accessibility.blur, "none", "снижение прозрачности должно отключать блюр виджета");
  await cdp("Emulation.setEmulatedMedia", { features: [] });

  const deleted = await evaluate(`(() => {
    const id = ${JSON.stringify(addResult.id)};
    const article = document.querySelector('[data-widget-id="' + id + '"]');
    article.querySelector('[data-action="remove"]').click();
    article.querySelector('.danger-action').click();
    return !window.__myFreeLayoutTab.store.getState().widgets.some((item) => item.id === id);
  })()`);
  assert.equal(deleted, true, "виджет должен удаляться через собственное меню подтверждения");
  console.log("browser-smoke: passed");
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    const exited = new Promise((resolve) => browser.once("exit", resolve));
    browser.kill("SIGTERM");
    await Promise.race([exited, delay(2000)]);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
