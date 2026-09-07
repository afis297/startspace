import { clear, element, formatDate, safeUrl } from "../ui/dom.js";
import { disposeTimer, formatDuration, openSafeLink, patchConfig } from "./helpers.js";
import { createDatePicker } from "../ui/date-picker.js";
import { createLineIcon } from "../ui/icons.js";
import { controlBrowserMedia, discoverBrowserMedia, ensureBrowserMediaPermission, focusBrowserMediaTab } from "../services/browser-media-controller.js";

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copy = (value) => structuredClone(value);

let timerAudioContext = null;

function primeTimerSound() {
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return;
    timerAudioContext = timerAudioContext || new Ctx();
    if (timerAudioContext.state === "suspended") timerAudioContext.resume().catch(() => undefined);
  } catch { /* no-op: timer stays silent without WebAudio */ }
}

function playTimerFinishSound() {
  try {
    if (!timerAudioContext || timerAudioContext.state !== "running") return;
    const startAt = timerAudioContext.currentTime + 0.01;
    [0, 0.24, 0.48].forEach((offset) => {
      const oscillator = timerAudioContext.createOscillator();
      const gain = timerAudioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.22);
      oscillator.connect(gain);
      gain.connect(timerAudioContext.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.24);
    });
  } catch { /* no-op */ }
}
const taskDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const dateKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const taskId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function plannedTasks(context) {
  return context.store.getState().widgets
    .filter((item) => item.type === "todo")
    .flatMap((item) => Array.isArray(item.config?.tasks) ? item.config.tasks : [])
    .filter((task) => taskDateKey(task.dueDate || task.date || task.scheduledFor));
}

function createClock(widget, context) {
  const root = element("div", { className: "clock-widget widget-fill" }, [
    element("div", { className: "clock-time", attrs: { "data-role": "time" } }),
    element("div", { className: "clock-date", attrs: { "data-role": "date" } }),
  ]);
  return root;
}
function updateClock(root, widget, context) {
  root.style.setProperty("--clock-scale", String(number(widget.config?.clockScale, 1)));
  disposeTimer(root);
  const showSeconds = widget.config?.showSeconds !== false;
  const locale = context.locale();
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", ...(showSeconds ? { second: "2-digit" } : {}), hour12: widget.config?.format === "12" });
  const dateFormatter = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const paint = () => {
    const now = new Date();
    root.querySelector("[data-role='time']").textContent = timeFormatter.format(now);
    root.querySelector("[data-role='date']").textContent = dateFormatter.format(now);
  };
  paint();
  if (showSeconds) root.__timer = setInterval(paint, 1000);
  else root.__timer = setTimeout(() => {
    paint();
    root.__timer = setInterval(paint, 60_000);
  }, 60_000 - (Date.now() % 60_000));
}

function createNote(widget, context) {
  const area = element("textarea", { className: "note-editor", attrs: { placeholder: "Запишите важную мысль…", "aria-label": "Текст заметки" } });
  area.addEventListener("input", () => patchConfig(context, widget.id, { content: area.value }));
  return element("div", { className: "note-widget widget-fill" }, [area]);
}
function updateNote(root, widget) {
  const area = root.querySelector("textarea");
  if (document.activeElement !== area) area.value = String(widget.config?.content || "");
}

function createLink(widget, context) {
  const button = element("button", { className: "link-card", attrs: { type: "button", "data-role": "link" } });
  button.addEventListener("click", () => openSafeLink(currentConfig(context, widget.id).url));
  return element("div", { className: "link-widget widget-fill" }, [button]);
}
function updateLink(root, widget) {
  const button = root.querySelector("button");
  clear(button).append(
    element("span", { className: "link-icon", text: String(widget.config?.icon || "↗") }),
    element("span", { className: "link-label", text: String(widget.config?.text || "Открыть ссылку") }),
    element("span", { className: "link-domain", text: readableDomain(widget.config?.url) }),
  );
}

function createQuote(widget, context) {
  const root = element("div", { className: "quote-widget widget-fill" }, [
    element("blockquote", { attrs: { "data-role": "quote" } }),
    element("cite", { className: "quote-author", attrs: { "data-role": "author" } }),
    element("button", { className: "text-action", text: "Другая мысль", attrs: { type: "button" } }),
  ]);
  root.querySelector("button").addEventListener("click", () => {
    const quotes = quotePool();
    const index = (number(currentConfig(context, widget.id).index) + 1) % quotes.length;
    patchConfig(context, widget.id, { index });
  });
  // The widget is created on every new-tab load. Defer the state update until its
  // workspace entry exists, then advance exactly once without a visible first-frame flash.
  queueMicrotask(() => {
    const quotes = quotePool();
    if (!quotes.length) return;
    const index = (number(currentConfig(context, widget.id).index) + 1) % quotes.length;
    patchConfig(context, widget.id, { index }, "quote-page-load");
  });
  return root;
}
function updateQuote(root, widget) {
  const quotes = quotePool();
  const quote = quotes[number(widget.config?.index) % quotes.length];
  root.querySelector("[data-role='quote']").textContent = quote.text;
  root.querySelector("[data-role='author']").textContent = `— ${quote.author}`;
}

function playerTime(seconds) {
  const value = Math.max(0, Math.floor(number(seconds)));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function youtubeVideoId(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      id = url.pathname === "/watch" ? url.searchParams.get("v") || "" : ["embed", "shorts", "live", "v"].includes(parts[0]) ? parts[1] || "" : "";
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : "";
  } catch { return ""; }
}
function playerSource(config) {
  const url = safeUrl(String(config?.audioUrl || ""));
  return /^https?:\/\//i.test(url) && !youtubeVideoId(url) ? url : "";
}
function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
function createPlayer(widget, context) {
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.setAttribute("aria-label", "Аудиоплеер");
  const cover = element("div", { className: "player-cover", attrs: { "aria-hidden": "true" } }, [
    element("span", { className: "player-cover-mark", text: "01" }),
    element("span", { className: "player-cover-lines" }),
  ]);
  const title = element("strong", { className: "player-title", attrs: { "data-role": "title" } });
  const artist = element("span", { className: "player-artist", attrs: { "data-role": "artist" } });
  const back = element("button", { className: "player-step", attrs: { type: "button", "data-role": "seek-back", "aria-label": "Назад на 10 секунд", title: "Назад на 10 секунд" } }, [createLineIcon("skipBack", { size: 19 })]);
  const toggle = element("button", { className: "player-toggle", attrs: { type: "button", "data-role": "toggle", "aria-label": "Воспроизвести" } }, [createLineIcon("play", { size: 22 })]);
  const forward = element("button", { className: "player-step", attrs: { type: "button", "data-role": "seek-forward", "aria-label": "Вперёд на 10 секунд", title: "Вперёд на 10 секунд" } }, [createLineIcon("skipForward", { size: 19 })]);
  const progress = element("input", { className: "player-progress", attrs: { type: "range", min: "0", max: "1", step: "0.1", value: "0", "data-role": "progress", "aria-label": "Позиция трека" } });
  const elapsed = element("span", { attrs: { "data-role": "elapsed" }, text: "00:00" });
  const duration = element("span", { attrs: { "data-role": "duration" }, text: "00:00" });
  const status = element("span", { className: "player-status", attrs: { "data-role": "status", "aria-live": "polite" } });
  const youtube = element("a", { className: "player-youtube-link", attrs: { href: "#", target: "_blank", rel: "noopener noreferrer", "data-role": "youtube-open", hidden: "", title: "Открыть видео на YouTube" } }, [
    element("span", { className: "player-youtube-link-icon", attrs: { "aria-hidden": "true" } }, [createLineIcon("play", { size: 20 })]),
    element("span", { className: "player-youtube-link-copy" }, [element("strong", { text: "Открыть на YouTube" }), element("span", { text: "Воспроизведение откроется на официальном сайте" })]),
    createLineIcon("arrowUpRight", { size: 16 }),
  ]);
  
  const root = element("div", { className: "player-widget widget-fill" }, [
    element("div", { className: "player-deck" }, [
      cover,
      element("div", { className: "player-copy" }, [element("span", { className: "player-kicker", text: "Сейчас играет" }), title, artist]),
    ]),
    element("div", { className: "player-transport", attrs: { "aria-label": "Управление воспроизведением" } }, [back, toggle, forward]),
    youtube,
    element("div", { className: "player-timeline" }, [progress, element("div", { className: "player-times" }, [elapsed, duration])]),
    status,
  ]);
  const paint = () => {
    const config = currentConfig(context, widget.id);
    const videoId = youtubeVideoId(config.audioUrl);
    const hasAudioSource = Boolean(playerSource(config));
    const isYoutube = Boolean(videoId);
    const trackDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Math.min(trackDuration || 0, Math.max(0, audio.currentTime || 0));
    const canSeek = hasAudioSource && Number.isFinite(audio.duration) && audio.duration > 0;
    progress.disabled = isYoutube || !canSeek;
    back.disabled = isYoutube || !canSeek;
    forward.disabled = isYoutube || !canSeek;
    if (document.activeElement !== progress) progress.value = String(isYoutube ? 0 : current);
    progress.max = String(isYoutube ? 1 : trackDuration || 1);
    elapsed.textContent = playerTime(isYoutube ? 0 : current);
    duration.textContent = playerTime(isYoutube ? 0 : trackDuration);
    const playing = !isYoutube && !audio.paused && !audio.ended;
    root.classList.toggle("is-playing", playing);
    root.classList.toggle("is-youtube", isYoutube);
    toggle.setAttribute("aria-label", isYoutube ? "Открыть видео на YouTube" : playing ? "Пауза" : "Воспроизвести");
    toggle.replaceChildren(createLineIcon(playing ? "pause" : "play", { size: 22 }));
    if (isYoutube) status.textContent = root.dataset.youtubeOpened === "true" ? "Видео открыто на YouTube" : "YouTube откроется в новой вкладке";
    else if (!hasAudioSource) status.textContent = "Добавьте ссылку на аудиофайл или YouTube в н.в.";
    else if (audio.error) status.textContent = "Не удалось загрузить аудиофайл";
    else status.textContent = playing ? "Воспроизведение" : "Готово к запуску";
  };
  const togglePlayback = async () => {
    const config = currentConfig(context, widget.id);
    const videoId = youtubeVideoId(config.audioUrl);
    if (videoId) {
      root.dataset.youtubeOpened = "true";
      openSafeLink(youtubeWatchUrl(videoId));
      paint();
      return;
    }
    if (!playerSource(config)) { paint(); return; }
    if (audio.paused) {
      try { await audio.play(); }
      catch { paint(); }
    } else audio.pause();
    paint();
  };
  const syncMediaSession = () => {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in globalThis)) return;
    const config = currentConfig(context, widget.id);
    const videoId = youtubeVideoId(config.audioUrl);
    if (videoId) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: String(config.title || "Без названия"), artist: String(config.artist || "Неизвестный исполнитель"), album: "Startspace" });
      navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
      navigator.mediaSession.setActionHandler("play", () => audio.play().catch(() => {}));
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
      navigator.mediaSession.setActionHandler("seekforward", () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); });
      navigator.mediaSession.setActionHandler("stop", () => { audio.pause(); audio.currentTime = 0; });
    } catch { /* unsupported action is ignored */ }
  };
  const seekBy = (seconds) => {
    const config = currentConfig(context, widget.id);
    if (youtubeVideoId(config.audioUrl) || !playerSource(config) || !Number.isFinite(audio.duration)) { paint(); return; }
    audio.currentTime = Math.min(audio.duration, Math.max(0, (audio.currentTime || 0) + seconds));
    paint();
  };
  
  toggle.addEventListener("click", togglePlayback);
  back.addEventListener("click", () => seekBy(-10));
  forward.addEventListener("click", () => seekBy(10));
  progress.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, Math.max(0, Number(progress.value) || 0));
    paint();
  });
  ["loadedmetadata", "timeupdate", "play", "pause", "ended", "error"].forEach((event) => audio.addEventListener(event, () => { paint(); syncMediaSession(); }));
  youtube.addEventListener("click", () => { root.dataset.youtubeOpened = "true"; paint(); });
  root.__audio = audio;
  root.__youtube = youtube;
  root.__paintPlayer = paint;
  return root;
}
function updatePlayer(root, widget) {
  const config = widget.config || {};
  const audio = root.__audio;
  const youtube = root.__youtube;
  const videoId = youtubeVideoId(config.audioUrl);
  const source = playerSource(config);
  const title = String(config.title || "Без названия");
  const artist = String(config.artist || "Неизвестный исполнитель");
  root.querySelector("[data-role='title']").textContent = title;
  root.querySelector("[data-role='artist']").textContent = artist;
  if (youtube) {
    youtube.hidden = !videoId;
    if (youtube.dataset.videoId !== videoId) {
      root.dataset.youtubeOpened = "false";
      youtube.dataset.videoId = videoId;
      youtube.href = videoId ? youtubeWatchUrl(videoId) : "#";
    }
  }
  if (audio && audio.dataset.source !== source) {
    audio.pause();
    audio.dataset.source = source;
    audio.src = source;
    if (!source) audio.removeAttribute("src");
    audio.load();
  }
  if (audio) audio.volume = Math.min(1, Math.max(0, number(config.volume, 0.8)));
  root.__paintPlayer?.();
}
function disposePlayer(root) {
  const audio = root.__audio;
  if (root.__youtube) root.__youtube.href = "#";
  if (!audio) return;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  root.__audio = null;
}

function createRandom(widget, context) {
  const min = element("input", { attrs: { type: "number", min: "-99999", max: "99999", "data-role": "min", "aria-label": "Минимум" } });
  const max = element("input", { attrs: { type: "number", min: "-99999", max: "99999", "data-role": "max", "aria-label": "Максимум" } });
  const result = element("output", { className: "random-result", attrs: { "data-role": "result" } });
  const generate = () => {
    const config = currentConfig(context, widget.id);
    const a = Math.round(number(min.value, config.min));
    const b = Math.round(number(max.value, config.max));
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    patchConfig(context, widget.id, { min: low, max: high, result: Math.floor(Math.random() * (high - low + 1)) + low });
  };
  [min, max].forEach((input) => input.addEventListener("change", generate));
  const root = element("div", { className: "random-widget widget-fill" }, [
    result,
    element("div", { className: "inline-fields" }, [min, element("span", { text: "—" }), max]),
    element("button", { className: "primary-action", text: "Сгенерировать", attrs: { type: "button" }, on: { click: generate } }),
  ]);
  return root;
}
function updateRandom(root, widget) {
  const config = widget.config || {};
  root.querySelector("[data-role='min']").value = number(config.min, 1);
  root.querySelector("[data-role='max']").value = number(config.max, 100);
  root.querySelector("[data-role='result']").textContent = config.result === undefined ? "—" : String(config.result);
}

const passwordAlphabetSets = Object.freeze({
  lowercase: "abcdefghijkmnopqrstuvwxyz",
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  numbers: "23456789",
  symbols: "!@#$%&*+-_=?:",
});
const passwordRandomBuffer = new Uint32Array(1);
function securePasswordIndex(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !globalThis.crypto?.getRandomValues) throw new Error("Криптографический генератор браузера недоступен.");
  const ceiling = Math.floor(0x100000000 / limit) * limit;
  do { globalThis.crypto.getRandomValues(passwordRandomBuffer); } while (passwordRandomBuffer[0] >= ceiling);
  return passwordRandomBuffer[0] % limit;
}
function passwordSets(config = {}) {
  const sets = [];
  if (config.lowercase !== false) sets.push(passwordAlphabetSets.lowercase);
  if (config.uppercase !== false) sets.push(passwordAlphabetSets.uppercase);
  if (config.numbers !== false) sets.push(passwordAlphabetSets.numbers);
  if (config.symbols !== false) sets.push(passwordAlphabetSets.symbols);
  return sets.length ? sets : [passwordAlphabetSets.lowercase];
}
function generatePassword(config = {}) {
  const length = Math.max(8, Math.min(64, Math.round(number(config.length, 16))));
  const sets = passwordSets(config);
  const alphabet = sets.join("");
  const characters = sets.map((set) => set[securePasswordIndex(set.length)]);
  while (characters.length < length) characters.push(alphabet[securePasswordIndex(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = securePasswordIndex(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join("");
}
function passwordStrength(password, config) {
  const alphabetSize = passwordSets(config).join("").length;
  const bits = String(password || "").length * Math.log2(Math.max(1, alphabetSize));
  if (bits >= 80) return { label: "Отличная стойкость", value: 100 };
  if (bits >= 60) return { label: "Высокая стойкость", value: 74 };
  if (bits >= 42) return { label: "Базовая стойкость", value: 48 };
  return { label: "Усильте пароль", value: 24 };
}
function createPasswordGenerator(widget, context) {
  const value = element("output", { className: "password-generator-value", attrs: { "data-role": "password", "aria-live": "polite" } });
  const copyLabel = element("span", { text: "Скопировать" });
  const copy = element("button", { className: "text-action password-generator-copy", attrs: { type: "button", "data-role": "copy", "aria-label": "Скопировать пароль" } }, [createLineIcon("duplicate", { size: 15 }), copyLabel]);
  const generate = element("button", { className: "primary-action password-generator-refresh", attrs: { type: "button", "data-role": "generate" } }, [createLineIcon("arrowSwap", { size: 16 }), element("span", { text: "Новый пароль" })]);
  const meter = element("span", { className: "password-generator-meter", attrs: { "data-role": "meter", "aria-hidden": "true" } });
  const status = element("span", { className: "password-generator-status", attrs: { "data-role": "status", "aria-live": "polite" } });
  const root = element("div", { className: "password-generator-widget widget-fill" }, [
    element("div", { className: "password-generator-display" }, [value, copy]),
    element("div", { className: "password-generator-strength" }, [meter, status]),
    element("div", { className: "password-generator-actions" }, [generate]),
    element("span", { className: "password-generator-hint", text: "Состав и длина — в свойствах виджета" }),
  ]);
  const paint = () => {
    const config = currentConfig(context, widget.id);
    const password = String(root.__password || "");
    const strength = passwordStrength(password, config);
    value.textContent = password || "Создайте пароль";
    meter.style.setProperty("--password-strength", `${strength.value}%`);
    const displayedLength = password.length || Math.max(8, Math.min(64, Math.round(number(config.length, 16))));
    status.textContent = root.dataset.copyStatus || `${strength.label} · ${displayedLength} знаков`;
    copyLabel.textContent = root.dataset.copyStatus || "Скопировать";
    copy.disabled = !password;
  };
  const create = () => {
    try {
      // Пароль намеренно живёт только в памяти текущей вкладки и не попадает в хранилище раскладки.
      root.__password = generatePassword(currentConfig(context, widget.id));
      delete root.dataset.copyStatus;
      paint();
    } catch {
      root.dataset.copyStatus = "Нет криптодоступа";
      paint();
    }
  };
  const copyPassword = async () => {
    const password = String(root.__password || "");
    if (!password) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(password);
      else {
        const fallback = document.createElement("textarea");
        fallback.value = password;
        fallback.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.append(fallback);
        fallback.select();
        const copied = document.execCommand("copy");
        fallback.remove();
        if (!copied) throw new Error("copy");
      }
      root.dataset.copyStatus = "Скопировано";
    } catch {
      root.dataset.copyStatus = "Не удалось скопировать";
    }
    paint();
    clearTimeout(root.__copyStatusTimer);
    root.__copyStatusTimer = setTimeout(() => { delete root.dataset.copyStatus; paint(); }, 1400);
  };
  generate.addEventListener("click", create);
  copy.addEventListener("click", copyPassword);
  root.__paintPasswordGenerator = paint;
  queueMicrotask(() => { if (!root.__password) create(); });
  return root;
}
function updatePasswordGenerator(root, widget) {
  root.__paintPasswordGenerator?.();
}

function createCalendarTaskPips(scheduled, date) {
  const count = scheduled.length;
  const taskLabel = (task) => String(task?.title || task?.text || task?.label || "Задача").trim() || "Задача";
  const taskStatus = (task) => {
    if (task?.completed || task?.done || ["done", "completed"].includes(task?.status)) return "done";
    if (["in-progress", "progress", "active"].includes(task?.status)) return "progress";
    const due = String(task?.dueDate || task?.date || task?.scheduledFor || "");
    if (due && new Date(`${due}T23:59:59`).getTime() < Date.now()) return "overdue";
    return "planned";
  };
  const pips = scheduled.slice(0, 3).map((task) => element("span", {
    className: `calendar-task-pip is-${taskStatus(task)}`,
    attrs: { "aria-hidden": "true" },
  }));
  if (count > 3) {
    pips.push(element("span", {
      className: "calendar-task-overflow",
      text: `+${count - 3}`,
      attrs: { "aria-hidden": "true" },
    }));
  }
  return element("span", {
    className: "calendar-task-pips",
    attrs: {
      "data-task-count": String(count),
      "data-task-list": scheduled.map(taskLabel).join("; "),
      "aria-label": `Запланировано задач: ${count} на ${date.toLocaleDateString("ru-RU")}`,
    },
  }, pips);
}
function createCalendar(widget, context) {
  const previous = element("button", { className: "calendar-nav calendar-nav-previous", text: "‹", title: "Предыдущий месяц", attrs: { type: "button", "aria-label": "Предыдущий месяц" } });
  const next = element("button", { className: "calendar-nav calendar-nav-next", text: "›", title: "Следующий месяц", attrs: { type: "button", "aria-label": "Следующий месяц" } });
  const today = element("button", { className: "calendar-today-button", text: "Сегодня", attrs: { type: "button", "data-role": "today", "aria-label": "Вернуться к сегодняшнему дню", "aria-pressed": "true" } });
  previous.addEventListener("click", () => patchConfig(context, widget.id, { offset: number(currentConfig(context, widget.id).offset) - 1 }));
  next.addEventListener("click", () => patchConfig(context, widget.id, { offset: number(currentConfig(context, widget.id).offset) + 1 }));
  today.addEventListener("click", () => patchConfig(context, widget.id, { offset: 0 }, "calendar-today"));
  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((label, index) => element("span", { className: index > 4 ? "is-weekend" : "", text: label }));
  return element("div", { className: "calendar-widget calendar-month-widget widget-fill" }, [
    element("div", { className: "calendar-toolbar" }, [
      element("div", { className: "calendar-title-wrap" }, [
        element("span", { className: "calendar-kicker", text: "Календарь" }),
        element("strong", { attrs: { "data-role": "month" } }),
      ]),
      element("div", { className: "calendar-controls" }, [previous, today, next]),
    ]),
    element("div", { className: "calendar-weekdays", attrs: { "aria-label": "Дни недели" } }, weekdays),
    element("div", { className: "calendar-grid", attrs: { "data-role": "grid", role: "grid", "aria-label": "Календарь" } }),
  ]);
}
function updateCalendar(root, widget, context) {
  const month = new Date();
  month.setMonth(month.getMonth() + number(widget.config?.offset));
  month.setDate(1);
  root.querySelector("[data-role='month']").textContent = formatDate(month, context.locale(), { month: "long", year: "numeric" });
  const todayButton = root.querySelector("[data-role='today']");
  const isCurrentMonth = number(widget.config?.offset) === 0;
  todayButton?.classList.toggle("is-active", isCurrentMonth);
  todayButton?.setAttribute("aria-pressed", String(isCurrentMonth));
  const tasksByDate = new Map();
  plannedTasks(context).forEach((task) => {
    const key = taskDateKey(task.dueDate);
    tasksByDate.set(key, [...(tasksByDate.get(key) || []), task]);
  });
  const grid = clear(root.querySelector("[data-role='grid']"));
  const firstDay = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date();
  for (let index = 0; index < 42; index += 1) {
    const day = index - firstDay + 1;
    if (day < 1 || day > days) {
      grid.append(element("span", { className: "calendar-blank", attrs: { "aria-hidden": "true" } }));
      continue;
    }
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const scheduled = tasksByDate.get(dateKey(date)) || [];
    const isToday = today.getFullYear() === date.getFullYear() && today.getMonth() === date.getMonth() && today.getDate() === day;
    const isWeekend = index % 7 > 4;
    const taskSummary = scheduled.map((task) => String(task.text || "Без названия")).join("; ");
    grid.append(element("span", {
      className: `calendar-day${isToday ? " is-today" : ""}${isWeekend ? " is-weekend" : ""}${scheduled.length ? " is-scheduled" : ""}`,
      attrs: { role: "gridcell", "aria-label": `${formatDate(date, context.locale(), { day: "numeric", month: "long", year: "numeric" })}${scheduled.length ? `. Запланировано задач: ${scheduled.length}. ${taskSummary}` : ""}`, "aria-current": isToday ? "date" : null, title: scheduled.length ? taskSummary : null },
    }, [
      element("span", { className: "calendar-day-number", text: String(day) }),
      scheduled.length ? element("span", { className: "calendar-task-count", text: scheduled.length > 9 ? "9+" : String(scheduled.length), attrs: { "aria-hidden": "true" } }) : null,
      scheduled.length ? createCalendarTaskPips(scheduled, date) : null,
    ]));
  }
}

function createCountdown(widget, context) {
  return element("div", { className: "countdown-widget widget-fill" }, [
    element("div", { className: "countdown-value", attrs: { "data-role": "value" } }),
    element("div", { className: "widget-muted", attrs: { "data-role": "label" } }),
  ]);
}
function updateCountdown(root, widget) {
  disposeTimer(root);
  const target = new Date(widget.config?.target || "").getTime();
  const label = widget.config?.label || "До события";
  const paint = () => {
    const remaining = Number.isFinite(target) ? Math.max(0, target - Date.now()) : 0;
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    root.querySelector("[data-role='value']").textContent = `${days}д ${String(hours).padStart(2, "0")}ч ${String(minutes).padStart(2, "0")}м`;
    root.querySelector("[data-role='label']").textContent = label;
  };
  paint();
  if (Number.isFinite(target) && target > Date.now()) root.__timer = setTimeout(() => {
    paint();
    root.__timer = setInterval(paint, 60_000);
  }, 60_000 - (Date.now() % 60_000));
}

function createTimer(widget, context) {
  const value = element("div", { className: "timer-value", attrs: { "data-role": "value" } });
  const toggle = element("button", { className: "primary-action", attrs: { type: "button", "data-role": "toggle" } });
  const reset = element("button", { className: "text-action", text: "Сбросить", attrs: { type: "button" } });
  toggle.addEventListener("click", () => {
    const config = currentConfig(context, widget.id);
    const now = Date.now();
    if (config.running) {
      const elapsed = Math.max(0, now - number(config.startedAt, now));
      patchConfig(context, widget.id, { running: false, elapsedMs: number(config.elapsedMs) + elapsed, startedAt: null });
    } else patchConfig(context, widget.id, { running: true, startedAt: now });
  });
  reset.addEventListener("click", () => patchConfig(context, widget.id, { running: false, elapsedMs: 0, startedAt: null }));
  return element("div", { className: "timer-widget widget-fill" }, [value, element("div", { className: "button-row" }, [toggle, reset])]);
}
function updateTimer(root, widget) {
  disposeTimer(root);
  const config = widget.config || {};
  const running = Boolean(config.running);
  const elapsedMs = number(config.elapsedMs);
  const startedAt = number(config.startedAt, Date.now());
  const paint = () => {
    const elapsed = elapsedMs + (running ? Math.max(0, Date.now() - startedAt) : 0);
    root.querySelector("[data-role='value']").textContent = formatDuration(elapsed / 1000);
    root.querySelector("[data-role='toggle']").textContent = running ? "Пауза" : "Старт";
  };
  paint();
  if (running) root.__timer = setInterval(paint, 1000);
}

function createFocusTimer(widget, context) {
  const minutes = element("input", { className: "focus-timer-minutes", attrs: { type: "number", min: "1", max: "180", step: "1", inputmode: "numeric", "data-role": "minutes", "aria-label": "Длительность таймера в минутах" } });
  const apply = element("button", { className: "text-action focus-timer-apply", text: "Установить", attrs: { type: "button" } });
  const toggle = element("button", { className: "primary-action focus-timer-toggle", attrs: { type: "button", "data-role": "toggle", "aria-pressed": "false" } });
  const reset = element("button", { className: "text-action", text: "Сбросить", attrs: { type: "button" } });
  const subtractMinute = element("button", { className: "text-action focus-timer-adjust", text: "−1 мин", attrs: { type: "button", "data-role": "subtract-minute", title: "Уменьшить оставшееся время на 1 минуту" } });
  const addMinute = element("button", { className: "text-action focus-timer-adjust", text: "+1 мин", attrs: { type: "button", "data-role": "add-minute", title: "Увеличить оставшееся время на 1 минуту" } });
  const setDuration = (seconds) => {
    const duration = Math.min(180 * 60, Math.max(1, Math.round(seconds)));
    patchConfig(context, widget.id, { totalSeconds: duration, remainingSeconds: duration, running: false, endsAt: null }, "focus-timer-set");
  };
  apply.addEventListener("click", () => setDuration(number(minutes.value) * 60));
  minutes.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); setDuration(number(minutes.value) * 60); } });
  const adjustRunningTimer = (delta) => {
    const config = currentConfig(context, widget.id);
    if (!config.running) return;
    const now = Date.now();
    const total = Math.max(1, number(config.totalSeconds, 1500));
    const remaining = number(config.endsAt) ? Math.max(0, Math.ceil((number(config.endsAt) - now) / 1000)) : Math.max(0, number(config.remainingSeconds, total));
    const next = Math.min(180 * 60, Math.max(0, remaining + delta));
    patchConfig(context, widget.id, {
      totalSeconds: delta > 0 ? Math.max(total, next) : total,
      remainingSeconds: next,
      endsAt: now + next * 1000,
    }, delta > 0 ? "focus-timer-add-minute" : "focus-timer-subtract-minute");
  };
  subtractMinute.addEventListener("click", () => adjustRunningTimer(-60));
  addMinute.addEventListener("click", () => adjustRunningTimer(60));
  toggle.addEventListener("click", () => {
    primeTimerSound();
    const config = currentConfig(context, widget.id);
    const now = Date.now();
    const total = Math.max(1, number(config.totalSeconds, 1500));
    const remaining = config.running && number(config.endsAt) ? Math.max(0, Math.ceil((number(config.endsAt) - now) / 1000)) : Math.max(0, number(config.remainingSeconds, total));
    if (config.running) patchConfig(context, widget.id, { running: false, remainingSeconds: remaining, endsAt: null }, "focus-timer-pause");
    else {
      const next = remaining || total;
      patchConfig(context, widget.id, { running: true, remainingSeconds: next, endsAt: now + next * 1000 }, "focus-timer-start");
    }
  });
  reset.addEventListener("click", () => {
    const total = Math.max(1, number(currentConfig(context, widget.id).totalSeconds, 1500));
    patchConfig(context, widget.id, { running: false, remainingSeconds: total, endsAt: null }, "focus-timer-reset");
  });
  const presets = [
    ["5", 5 * 60],
    ["15", 15 * 60],
    ["25", 25 * 60],
    ["45", 45 * 60],
  ].map(([label, seconds]) => {
    const button = element("button", { className: "focus-timer-preset", text: label, attrs: { type: "button", "aria-label": `${label} минут` } });
    button.addEventListener("click", () => setDuration(seconds));
    return button;
  });
  return element("div", { className: "focus-timer-widget widget-fill" }, [
    element("div", { className: "focus-timer-hero" }, [
      element("div", { className: "focus-timer-ring", attrs: { "data-role": "ring" } }, [
        element("div", { className: "focus-timer-time", attrs: { "data-role": "value", "aria-live": "polite" } }),
        element("div", { className: "focus-timer-state", attrs: { "data-role": "state" } }),
      ]),
    ]),
    element("div", { className: "focus-timer-presets", attrs: { "data-role": "presets", "aria-label": "Быстрый выбор длительности" } }, presets),
    element("div", { className: "focus-timer-config", attrs: { "data-role": "configuration" } }, [minutes, apply]),
    element("div", { className: "focus-timer-adjustments", attrs: { "data-role": "adjustments", hidden: "" } }, [subtractMinute, addMinute]),
    element("div", { className: "focus-timer-actions" }, [toggle, reset]),
  ]);
}
function updateFocusTimer(root, widget, context) {
  disposeTimer(root);
  const config = widget.config || {};
  const total = Math.min(180 * 60, Math.max(1, number(config.totalSeconds, 25 * 60)));
  const configuredRunning = Boolean(config.running);
  const running = configuredRunning && number(config.endsAt) > Date.now();
  const staticRemaining = Math.min(total, Math.max(0, number(config.remainingSeconds, total)));
  const remainingSeconds = () => running ? Math.min(total, Math.max(0, Math.ceil((number(config.endsAt) - Date.now()) / 1000))) : staticRemaining;
  const paint = () => {
    const remaining = remainingSeconds();
    const ratio = Math.max(0, Math.min(1, remaining / total));
    const ring = root.querySelector("[data-role='ring']");
    ring.style.setProperty("--timer-progress", `${Math.round(ratio * 360)}deg`);
    root.classList.toggle("is-finished", remaining === 0);
    root.classList.toggle("is-running", running);
    root.querySelector("[data-role='configuration']").hidden = running;
    root.querySelector("[data-role='presets']").hidden = running;
    root.querySelector("[data-role='adjustments']").hidden = !running;
    root.querySelector("[data-role='toggle']")?.setAttribute("aria-pressed", String(running));
    const timeValue = root.querySelector("[data-role='value']");
    timeValue.textContent = formatDuration(remaining);
    timeValue.dataset.compactValue = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
    root.querySelector("[data-role='state']").textContent = remaining === 0 ? "Готово" : (running ? "Идёт отсчёт" : "Готов к запуску");
    root.querySelector("[data-role='toggle']").textContent = running ? "Пауза" : (remaining === 0 ? "Сначала" : "Старт");
    const minutes = root.querySelector("[data-role='minutes']");
    if (document.activeElement !== minutes) minutes.value = String(Math.max(1, Math.ceil((remaining || total) / 60)));
    if (running && remaining === 0 && !root.__focusTimerFinished) {
      root.__focusTimerFinished = true;
      playTimerFinishSound();
      patchConfig(context, widget.id, { running: false, remainingSeconds: 0, endsAt: null }, "focus-timer-finished");
    }
  };
  root.__focusTimerFinished = false;
  paint();
  if (configuredRunning && !running) patchConfig(context, widget.id, { running: false, remainingSeconds: 0, endsAt: null }, "focus-timer-expired");
  if (running) root.__timer = setInterval(paint, 1000);
}

function formatMediaClock(seconds) {
  const value = Math.max(0, Math.floor(number(seconds)));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function browserMediaProviderLabel(provider) {
  const labels = {
    youtube: "YouTube",
    "vk-video": "VK Видео",
    rutube: "RuTube",
    twitch: "Twitch",
    vimeo: "Vimeo",
    dailymotion: "Dailymotion",
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    x: "X / Twitter",
    ok: "Одноклассники",
    netflix: "Netflix",
    kinopoisk: "Кинопоиск",
    ivi: "Иви",
    okko: "Okko",
    wink: "Wink",
    premier: "PREMIER",
    start: "START",
    "yandex-music": "Яндекс Музыка",
    spotify: "Spotify",
    "apple-music": "Apple Music",
    deezer: "Deezer",
    soundcloud: "SoundCloud",
    bandcamp: "Bandcamp",
    mixcloud: "Mixcloud",
    rumble: "Rumble",
    bilibili: "Bilibili",
    telegram: "Telegram",
  };
  return labels[provider] || "Браузерный плеер";
}
function browserMediaSourceLabel(value) {
  const count = Math.max(1, Math.round(number(value, 1)));
  const remainder = count % 100;
  const last = count % 10;
  const word = remainder >= 11 && remainder <= 14 ? "источников" : last === 1 ? "источник" : last >= 2 && last <= 4 ? "источника" : "источников";
  return `${count} ${word}`;
}
function createBrowserMedia(widget, context) {
  const source = element("strong", { className: "browser-media-source", attrs: { "data-role": "source" } });
  const status = element("span", { className: "browser-media-status", attrs: { "data-role": "status", "aria-live": "polite" } });
  const timeline = element("span", { className: "browser-media-timeline", attrs: { "data-role": "timeline" } });
  const locate = element("button", { className: "primary-action browser-media-locate", text: "Найти воспроизведение", attrs: { type: "button", "data-role": "locate" } });
  const previous = element("button", { className: "icon-action browser-media-track-control", title: "Предыдущий трек", attrs: { type: "button", "aria-label": "Предыдущий трек", "data-role": "previous-track" } }, [createLineIcon("skipBack", { size: 15 })]);
  const next = element("button", { className: "icon-action browser-media-track-control", title: "Следующий трек", attrs: { type: "button", "aria-label": "Следующий трек", "data-role": "next-track" } }, [createLineIcon("skipForward", { size: 15 })]);
  const back = element("button", { className: "icon-action browser-media-seek-control", title: "Назад на 5 секунд", attrs: { type: "button", "aria-label": "Назад на 5 секунд", "data-role": "back" } }, [createLineIcon("chevronLeft", { size: 18 })]);
  const toggle = element("button", { className: "primary-action browser-media-toggle", attrs: { type: "button", "aria-label": "Воспроизвести или поставить на паузу", "data-role": "toggle" } });
  const forward = element("button", { className: "icon-action browser-media-seek-control", title: "Вперёд на 5 секунд", attrs: { type: "button", "aria-label": "Вперёд на 5 секунд", "data-role": "forward" } }, [createLineIcon("chevronRight", { size: 18 })]);
  const switchSource = element("button", { className: "browser-media-switch", title: "Выбрать другой источник", attrs: { type: "button", "aria-label": "Выбрать другой источник воспроизведения", "data-role": "switch-source" } }, [createLineIcon("arrowSwap", { size: 15 })]);
  const mute = element("button", { className: "icon-action browser-media-footer-control", title: "Выключить звук", attrs: { type: "button", "data-role": "mute", "aria-label": "Выключить звук" } }, [createLineIcon("volume", { size: 16 })]);
  const focus = element("button", { className: "icon-action browser-media-head-focus", title: "Открыть вкладку с воспроизведением", attrs: { type: "button", "data-role": "focus", "aria-label": "Открыть вкладку с воспроизведением" } }, [createLineIcon("external", { size: 15 })]);
  const volume = element("input", { className: "browser-media-volume", attrs: { type: "range", min: "0", max: "100", step: "1", "data-role": "volume", "aria-label": "Громкость воспроизведения" } });
  const root = element("div", { className: "browser-media-widget widget-fill" }, [
    element("div", { className: "browser-media-head" }, [
      element("span", { className: "browser-media-kicker", text: "БРАУЗЕРНЫЙ ПЛЕЕР" }),
      element("div", { className: "browser-media-head-actions" }, [status, focus, switchSource]),
    ]),
    element("div", { className: "browser-media-now" }, [source, timeline]),
    locate,
    element("div", { className: "browser-media-controls" }, [previous, back, toggle, forward, next]),
    element("div", { className: "browser-media-footer" }, [
      element("div", { className: "browser-media-volume-wrap" }, [mute, volume]),
    ]),
  ]);
  const persist = (snapshot, reason, preserveSession = false) => {
    const previous = currentConfig(context, widget.id);
    const keepSession = preserveSession && Number.isInteger(previous.tabId) && !snapshot?.found;
    patchConfig(context, widget.id, {
      tabId: Number.isInteger(snapshot?.tabId) ? snapshot.tabId : (keepSession ? previous.tabId : null),
      frameId: Number.isInteger(snapshot?.frameId) ? snapshot.frameId : (keepSession ? previous.frameId : null),
      mediaKey: String(snapshot?.mediaKey || (keepSession ? previous.mediaKey || "" : "")),
      provider: String(snapshot?.provider || (keepSession ? previous.provider || "native" : "native")),
      // Команда управляет одним выбранным элементом и знает лишь локальное mediaCount.
      // Общее число источников остаётся от последнего полного поиска, чтобы кнопка
      // «Другой источник» не исчезала после изменения громкости или паузы.
      sourceCount: Math.max(1, Math.round(number(snapshot?.sourceCount, previous.sourceCount || 1))),
      found: Boolean(snapshot?.found) || keepSession,
      title: String(snapshot?.tabTitle || snapshot?.title || (keepSession ? previous.title : "")),
      paused: snapshot?.paused === undefined && keepSession ? Boolean(previous.paused) : Boolean(snapshot?.paused),
      muted: snapshot?.muted === undefined && snapshot?.tabMuted === undefined && keepSession ? Boolean(previous.muted) : Boolean(snapshot?.muted ?? snapshot?.tabMuted),
      volume: Math.max(0, Math.min(100, number(snapshot?.volume, keepSession ? previous.volume : 100))),
      currentTime: Math.max(0, number(snapshot?.currentTime, keepSession ? previous.currentTime : 0)),
      duration: Math.max(0, number(snapshot?.duration, keepSession ? previous.duration : 0)),
      message: String(snapshot?.message || ""),
    }, reason);
  };
  const setBusy = (busy) => root.classList.toggle("is-busy", busy);
  const discover = async (cycle = false) => {
    const previous = currentConfig(context, widget.id);
    setBusy(true);
    try {
      const permission = await ensureBrowserMediaPermission();
      if (!permission.granted) persist({ found: false, message: permission.message }, "browser-media-permission");
      // Кнопка «Найти/Обновить» означает новый поиск: старый YouTube-плеер не
      // должен удерживаться, когда пользователь уже включил VK Видео в другой вкладке.
      else persist(await discoverBrowserMedia({ ...previous, cycle, forceRefresh: !cycle }), cycle ? "browser-media-switch-source" : "browser-media-discover");
    } finally {
      setBusy(false);
    }
  };
  locate.addEventListener("click", () => discover(false));
  switchSource.addEventListener("click", () => discover(true));
  const command = async (action, value) => {
    const config = currentConfig(context, widget.id);
    setBusy(true);
    try {
      // Все сайты, включая YouTube и VK Видео, получают прямую команду к
      // выбранному HTMLMediaElement. Не запрашиваем debugger: в Vivaldi он
      // может быть недоступен и не должен ломать основной сценарий.
      const snapshot = await controlBrowserMedia(config.tabId, action, value, config.frameId, config.mediaKey);
      persist(snapshot, `browser-media-${action}`, true);
    } finally {
      setBusy(false);
    }
  };
  let volumeTimer = null;
  let pendingVolume = null;
  let volumeBusy = false;
  const flushVolume = async () => {
    if (volumeBusy || pendingVolume === null) return;
    const value = pendingVolume;
    pendingVolume = null;
    volumeBusy = true;
    try { await command("volume", value); }
    finally {
      volumeBusy = false;
      if (pendingVolume !== null) flushVolume();
    }
  };
  const queueVolume = (immediate = false) => {
    pendingVolume = Math.max(0, Math.min(100, number(volume.value)));
    if (volumeTimer) clearTimeout(volumeTimer);
    if (immediate) {
      volumeTimer = null;
      flushVolume();
    } else volumeTimer = setTimeout(() => { volumeTimer = null; flushVolume(); }, 120);
  };
  previous.addEventListener("click", () => command("previous"));
  back.addEventListener("click", () => command("seek", -5));
  toggle.addEventListener("click", () => command("toggle"));
  forward.addEventListener("click", () => command("seek", 5));
  next.addEventListener("click", () => command("next"));
  volume.addEventListener("input", () => queueVolume(false));
  volume.addEventListener("change", () => queueVolume(true));
  mute.addEventListener("click", () => command("mute"));
  focus.addEventListener("click", () => focusBrowserMediaTab(currentConfig(context, widget.id).tabId));
  return root;
}
function updateBrowserMedia(root, widget) {
  const config = widget.config || {};
  const found = Boolean(config.found && Number.isInteger(config.tabId));
  const sourceCount = Math.max(1, Math.round(number(config.sourceCount, 1)));
  const provider = browserMediaProviderLabel(config.provider);
  root.classList.toggle("has-media", found);
  root.querySelector("[data-role='source']").textContent = found ? String(config.title || provider) : "Нет найденного воспроизведения";
  root.querySelector("[data-role='status']").textContent = found ? (config.paused ? "ПАУЗА" : "В ЭФИРЕ") : "ОЖИДАНИЕ";
  const details = found
    ? (config.duration ? `${provider} · ${formatMediaClock(config.currentTime)} / ${formatMediaClock(config.duration)}` : `${provider} · ${String(config.message || "Прямой поток")}`)
    : String(config.message || "Нажмите кнопку, чтобы найти вкладку с видео или звуком.");
  root.querySelector("[data-role='timeline']").textContent = found && sourceCount > 1 ? `${details} · ${browserMediaSourceLabel(sourceCount)}` : details;
  const toggle = root.querySelector("[data-role='toggle']");
  clear(toggle).append(createLineIcon(config.paused ? "play" : "pause", { size: 18 }));
  toggle.setAttribute("aria-label", config.paused ? "Продолжить воспроизведение" : "Поставить на паузу");
  const mute = root.querySelector("[data-role='mute']");
  clear(mute).append(createLineIcon(config.muted ? "volumeOff" : "volume", { size: 16 }));
  mute.title = config.muted ? "Включить звук" : "Выключить звук";
  mute.setAttribute("aria-label", mute.title);
  const volume = root.querySelector("[data-role='volume']");
  if (document.activeElement !== volume) volume.value = String(Math.max(0, Math.min(100, number(config.volume, 100))));
  root.querySelector("[data-role='locate']").textContent = found ? "Обновить состояние" : "Найти воспроизведение";
  const switchButton = root.querySelector("[data-role='switch-source']");
  switchButton.disabled = !found || sourceCount < 2;
  switchButton.title = sourceCount > 1 ? `Другой источник (${browserMediaSourceLabel(sourceCount)})` : "Другой источник недоступен";
  ["back", "toggle", "forward", "mute", "focus", "volume"].forEach((role) => { root.querySelector(`[data-role='${role}']`).disabled = !found; });
}

function createTodo(widget, context) {
  const input = element("input", { className: "todo-input", attrs: { type: "text", placeholder: "Что нужно сделать?", maxlength: "180", "aria-label": "Новая задача" } });
  let dueDateValue = dateKey(new Date());
  const dueDate = createDatePicker({
    value: dueDateValue,
    ariaLabel: "Срок новой задачи",
    className: "todo-date-picker",
    onChange: (value) => { dueDateValue = taskDateKey(value); },
  });
  const add = () => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    const tasks = [...(currentConfig(context, widget.id).tasks || []), { id: taskId(), text, done: false, dueDate: dueDateValue }];
    input.value = "";
    dueDateValue = dateKey(new Date());
    dueDate.setValue(dueDateValue);
    patchConfig(context, widget.id, { tasks }, "todo-add");
  };
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); add(); } });
  const list = element("ul", { className: "todo-list", attrs: { "data-role": "list" } });
  const summary = element("span", { className: "todo-summary", attrs: { "data-role": "summary" } });
  const clearCompleted = element("button", { className: "text-action todo-clear-completed", text: "Очистить", attrs: { type: "button", "data-role": "clear-completed", title: "Удалить выполненные задачи", "aria-label": "Удалить выполненные задачи", hidden: "" } });
  clearCompleted.addEventListener("click", () => {
    const tasks = Array.isArray(currentConfig(context, widget.id).tasks) ? currentConfig(context, widget.id).tasks : [];
    patchConfig(context, widget.id, { tasks: tasks.filter((task) => !task.done) }, "todo-clear-completed");
  });
  return element("div", { className: "todo-widget widget-fill" }, [
    element("div", { className: "todo-list-head" }, [element("span", { className: "todo-list-kicker", text: "Текущий список" }), summary, clearCompleted]),
    list,
    element("div", { className: "todo-add" }, [
      element("span", { className: "todo-add-kicker", text: "Новая задача" }),
      input,
      dueDate.root,
      element("button", { className: "todo-add-button primary-action", attrs: { type: "button", "aria-label": "Добавить задачу" }, on: { click: add } }, [createLineIcon("add", { size: 15 }), element("span", { text: "Добавить" })]),
    ]),
  ]);
}
function updateTodo(root, widget, context) {
  const list = clear(root.querySelector("[data-role='list']"));
  const tasks = Array.isArray(widget.config?.tasks) ? widget.config.tasks : [];
  // Старые задачи создавались без срока. Каждой назначаем сегодняшний день один раз,
  // чтобы компактная дата не оставалась пустым полем и календарь видел задачу.
  const defaultDueDate = dateKey(new Date());
  const normalizedTasks = tasks.map((task) => taskDateKey(task.dueDate) ? task : { ...task, dueDate: defaultDueDate });
  if (normalizedTasks.some((task, index) => task.dueDate !== tasks[index]?.dueDate)) {
    patchConfig(context, widget.id, { tasks: normalizedTasks }, "todo-migrate-missing-dates");
    return;
  }
  const activeCount = tasks.filter((task) => !task.done).length;
  const completedCount = tasks.length - activeCount;
  const summary = root.querySelector("[data-role='summary']");
  if (summary) summary.textContent = tasks.length ? `${activeCount} активных` : "0 записей";
  const clearCompleted = root.querySelector("[data-role='clear-completed']");
  if (clearCompleted) {
    clearCompleted.hidden = completedCount === 0;
    clearCompleted.textContent = `Очистить ${completedCount}`;
    clearCompleted.setAttribute("aria-label", `Удалить выполненные задачи: ${completedCount}`);
  }
  if (!tasks.length) {
    list.append(element("li", { className: "todo-empty-state" }, [
      element("span", { className: "todo-empty-index", text: "00", attrs: { "aria-hidden": "true" } }),
      element("span", { className: "todo-empty-copy" }, [element("strong", { text: "Список пуст" }), element("small", { text: "Добавьте первую задачу ниже" })]),
    ]));
  }
  tasks.forEach((task, index) => {
    const checkbox = element("input", { className: "todo-checkbox", attrs: { type: "checkbox", "aria-label": `Отметить задачу: ${task.text || "Без названия"}` }, checked: task.done });
    const label = element("span", { className: `todo-label${task.done ? " todo-done" : ""}`, text: task.text || "Без названия" });
    const dueDate = createDatePicker({
      value: taskDateKey(task.dueDate),
      ariaLabel: `Срок задачи: ${task.text || "Без названия"}`,
      className: "todo-date-picker",
      onChange: (value) => patchConfig(context, widget.id, { tasks: tasks.map((item) => item.id === task.id ? { ...item, dueDate: taskDateKey(value) } : item) }, "todo-date"),
    });
    const remove = element("button", { className: "remove-action", attrs: { type: "button", "aria-label": `Удалить задачу: ${task.text || "Без названия"}`, title: "Удалить задачу" } }, [createLineIcon("close", { size: 13 })]);
    checkbox.addEventListener("change", () => patchConfig(context, widget.id, { tasks: tasks.map((item) => item.id === task.id ? { ...item, done: checkbox.checked } : item) }, "todo-toggle"));
    remove.addEventListener("click", () => patchConfig(context, widget.id, { tasks: tasks.filter((item) => item.id !== task.id) }, "todo-remove"));
    list.append(element("li", { className: `todo-item${task.done ? " is-done" : ""}` }, [
      element("span", { className: "todo-item-index", text: String(index + 1).padStart(2, "0"), attrs: { "aria-hidden": "true" } }),
      checkbox,
      element("span", { className: "todo-item-copy" }, [label]),
      dueDate.root,
      remove,
    ]));
  });
}

function createCalculator(widget, context) {
  const display = element("input", { className: "calculator-display", attrs: { type: "text", inputmode: "decimal", placeholder: "0", "aria-label": "Выражение" } });
  const result = element("output", { className: "calculator-result", attrs: { "data-role": "result" } });
  const history = element("output", { className: "calculator-history", text: "ГОТОВ К ВВОДУ", attrs: { "data-role": "history", "aria-live": "polite" } });
  const keys = ["C", "(", ")", "⌫", "7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "+", "="];
  const keysRoot = element("div", { className: "calculator-keys calculator-keypad", attrs: { "data-role": "keys", "aria-label": "Клавиатура калькулятора" } });
  const root = element("div", { className: "calculator-widget calculator-console-widget widget-fill", attrs: { title: "Клавиатура: цифры, + − × ÷, скобки, Enter, Backspace и Escape" } }, [
    element("section", { className: "calculator-screen" }, [
      element("div", { className: "calculator-screen-meta" }, [
        element("span", { className: "calculator-mode", text: "ВВОД" }),
        history,
      ]),
      element("div", { className: "calculator-readout" }, [result, display]),
    ]),
    element("div", { className: "calculator-keypad-shell" }, [keysRoot]),
  ]);
  const insertAtCursor = (value) => {
    const start = display.selectionStart ?? display.value.length;
    const end = display.selectionEnd ?? display.value.length;
    const expression = `${display.value.slice(0, start)}${value}${display.value.slice(end)}`;
    display.value = expression;
    display.setSelectionRange(start + value.length, start + value.length);
    history.textContent = "ВВОД ВЫРАЖЕНИЯ";
    patchConfig(context, widget.id, { expression, result: "" });
  };
  const deleteBackwardAtCursor = () => {
    const end = display.selectionEnd ?? display.value.length;
    const start = display.selectionStart ?? end;
    const deleteFrom = start === end ? Math.max(0, start - 1) : start;
    const expression = `${display.value.slice(0, deleteFrom)}${display.value.slice(end)}`;
    display.value = expression;
    display.setSelectionRange(deleteFrom, deleteFrom);
    patchConfig(context, widget.id, { expression, result: "" });
  };
  const apply = (key) => {
    if (key === "C") {
      display.value = "";
      history.textContent = "ОЧИЩЕНО";
      patchConfig(context, widget.id, { expression: "", result: "" });
      return;
    }
    if (key === "⌫") { history.textContent = "КОРРЕКТИРОВКА"; deleteBackwardAtCursor(); return; }
    if (key === "=") {
      const expression = display.value;
      const value = calculate(expression);
      const valueText = value === null ? "ОШИБКА" : String(value);
      display.value = valueText;
      display.setSelectionRange(valueText.length, valueText.length);
      history.textContent = expression ? `${expression} = ${valueText}` : "НЕТ ВЫРАЖЕНИЯ";
      patchConfig(context, widget.id, { expression, result: value === null ? "Ошибка" : String(value) });
      return;
    }
    insertAtCursor(key);
  };
  keys.forEach((key) => {
    const kind = key === "=" ? "is-equals" : (["+", "-", "*", "/"].includes(key) ? "is-operator" : (["C", "⌫"].includes(key) ? "is-control" : ""));
    keysRoot.append(element("button", { className: `calculator-key ${kind}`.trim(), text: key, attrs: { type: "button", "data-key": key }, on: { click: () => { apply(key); display.focus({ preventScroll: true }); } } }));
  });
  const isCalculateKey = (event) => event.key === "Enter" || event.key === "=" || event.code === "NumpadEnter";
  display.addEventListener("input", () => patchConfig(context, widget.id, { expression: display.value, result: "" }));
  display.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.key === "Tab" || event.key === "Delete" || event.key.startsWith("Arrow")) return;
    if (isCalculateKey(event)) { event.preventDefault(); apply("="); return; }
    if (event.key === "Escape" || /^[cс]$/i.test(event.key)) { event.preventDefault(); apply("C"); return; }
    if (event.key === "Backspace") { event.preventDefault(); apply("⌫"); return; }
    const normalizedKey = ({ ",": ".", x: "*", X: "*", "×": "*", "÷": "/" })[event.key] || event.key;
    if (/^[0-9+\-*/().]$/.test(normalizedKey)) { event.preventDefault(); insertAtCursor(normalizedKey); return; }
    if (event.key.length === 1) event.preventDefault();
  });
  root.addEventListener("keydown", (event) => {
    if (event.target === display || event.defaultPrevented || !isCalculateKey(event)) return;
    event.preventDefault();
    apply("=");
    display.focus({ preventScroll: true });
  });
  root.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("button")) display.focus({ preventScroll: true });
  });
  return root;
}
function updateCalculator(root, widget) {
  const display = root.querySelector("input");
  if (document.activeElement !== display) display.value = String(widget.config?.expression || "");
  root.querySelector("[data-role='result']").textContent = String(widget.config?.result || "");
}

function createGame(widget, context) {
  const grid = element("div", { className: "game-grid", attrs: { "data-role": "grid", tabindex: "0", "aria-label": "Поле игры 2048. Наведите курсор на поле и используйте стрелки." } });
  const root = element("div", { className: "game-widget widget-fill", attrs: { "aria-label": "Игра 2048" } }, [
    element("div", { className: "game-score", attrs: { "data-role": "score" } }),
    grid,
    element("button", { className: "text-action", text: "Новая игра", attrs: { type: "button", "data-role": "reset" } }),
  ]);
  const reset = () => patchConfig(context, widget.id, freshGame());
  root.querySelector("[data-role='reset']").addEventListener("click", reset);
  // Только само поле становится фокусируемым на время наведения. Внешние панели не могут передать ему стрелки.
  grid.addEventListener("pointerenter", () => grid.focus({ preventScroll: true }));
  grid.addEventListener("pointerleave", () => { if (document.activeElement === grid) grid.blur(); });
  grid.addEventListener("pointerdown", () => grid.focus({ preventScroll: true }));
  grid.addEventListener("keydown", (event) => {
    const directions = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    if (!directions[event.key] || document.activeElement !== grid) return;
    event.preventDefault();
    event.stopPropagation();
    const config = currentConfig(context, widget.id);
    patchConfig(context, widget.id, moveGame(config, directions[event.key]));
  });
  return root;
}
function updateGame(root, widget, context) {
  let config = widget.config || {};
  // Мигрированные V4-игры не содержат доску. Инициализируем её один раз в Store,
  // а не создаём freshGame() при каждом изменении любого другого виджета.
  if (!Array.isArray(config.board) || config.board.length !== 16) {
    const initialGame = freshGame();
    patchConfig(context, widget.id, initialGame, "game-initialize");
    config = { ...config, ...initialGame };
  }
  root.querySelector("[data-role='score']").textContent = `Счёт: ${number(config.score)}`;
  const grid = clear(root.querySelector("[data-role='grid']"));
  config.board.forEach((value) => grid.append(element("span", { className: `game-tile tile-${value || 0}`, text: value || "" })));
}

const snakeSize = 12;
const snakeDirections = {
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
};
const snakeOpposites = { left: "right", right: "left", up: "down", down: "up" };

function freshSnake(bestScore = 0) {
  return {
    gridSize: snakeSize,
    snake: [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }],
    food: { x: 8, y: 6 },
    direction: "right",
    queuedDirection: "right",
    score: 0,
    bestScore: Math.max(0, number(bestScore)),
    status: "ready",
    speed: 190,
  };
}
function isSnakeCell(value) {
  return Number.isInteger(value?.x) && Number.isInteger(value?.y) && value.x >= 0 && value.x < snakeSize && value.y >= 0 && value.y < snakeSize;
}
function snakeState(config) {
  const base = freshSnake(config?.bestScore);
  const snake = Array.isArray(config?.snake) && config.snake.length >= 3 && config.snake.every(isSnakeCell) ? config.snake.map((cell) => ({ x: cell.x, y: cell.y })) : base.snake;
  const direction = snakeDirections[config?.direction] ? config.direction : base.direction;
  const queuedDirection = snakeDirections[config?.queuedDirection] ? config.queuedDirection : direction;
  const food = isSnakeCell(config?.food) && !snake.some((cell) => cell.x === config.food.x && cell.y === config.food.y) ? { x: config.food.x, y: config.food.y } : snakeFood(snake);
  return {
    ...base,
    ...config,
    gridSize: snakeSize,
    snake,
    food,
    direction,
    queuedDirection,
    score: Math.max(0, number(config?.score)),
    bestScore: Math.max(0, number(config?.bestScore)),
    status: ["ready", "playing", "paused", "gameover", "won"].includes(config?.status) ? config.status : "ready",
    speed: Math.min(360, Math.max(110, number(config?.speed, 190))),
  };
}
function snakeFood(snake) {
  const free = [];
  for (let y = 0; y < snakeSize; y += 1) for (let x = 0; x < snakeSize; x += 1) if (!snake.some((cell) => cell.x === x && cell.y === y)) free.push({ x, y });
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}
function queueSnakeDirection(config, direction) {
  const state = snakeState(config);
  if (!snakeDirections[direction] || state.status === "gameover" || state.status === "won" || state.queuedDirection !== state.direction || snakeOpposites[state.direction] === direction) return state;
  return { ...state, queuedDirection: direction };
}
function moveSnake(config) {
  const state = snakeState(config);
  if (state.status !== "playing" || !state.food) return state;
  const vector = snakeDirections[state.queuedDirection];
  const head = state.snake[0];
  const next = { x: head.x + vector.x, y: head.y + vector.y };
  const eats = next.x === state.food.x && next.y === state.food.y;
  const collisionBody = eats ? state.snake : state.snake.slice(0, -1);
  if (!isSnakeCell(next) || collisionBody.some((cell) => cell.x === next.x && cell.y === next.y)) return { ...state, status: "gameover", queuedDirection: state.direction };
  const snake = [next, ...state.snake];
  if (!eats) snake.pop();
  const score = state.score + (eats ? 10 : 0);
  const food = eats ? snakeFood(snake) : state.food;
  return { ...state, snake, food, score, bestScore: Math.max(state.bestScore, score), direction: state.queuedDirection, queuedDirection: state.queuedDirection, status: food ? "playing" : "won" };
}
function disposeSnake(root) {
  if (root.__snakeTimer) clearInterval(root.__snakeTimer);
  root.__snakeTimer = null;
  root.__snakeSpeed = null;
}
function createSnake(widget, context) {
  const grid = element("div", { className: "snake-grid", attrs: { "data-role": "grid", tabindex: "0", "aria-label": "Поле игры Змейка. Наведите курсор на поле и используйте стрелки." } });
  const status = element("span", { className: "snake-status", attrs: { "data-role": "status", "aria-live": "polite" } });
  const score = element("span", { className: "snake-score", attrs: { "data-role": "score" } });
  const toggle = element("button", { className: "primary-action", attrs: { type: "button", "data-role": "toggle" } });
  const reset = element("button", { className: "text-action", text: "Новая игра", attrs: { type: "button", "data-role": "reset" } });
  const applyDirection = (direction) => {
    const current = currentConfig(context, widget.id);
    const next = queueSnakeDirection(current, direction);
    if (next.status === "ready" || next.status === "paused") next.status = "playing";
    patchConfig(context, widget.id, next, "snake-direction");
    grid.focus({ preventScroll: true });
  };
  toggle.addEventListener("click", () => {
    const current = snakeState(currentConfig(context, widget.id));
    const next = current.status === "gameover" || current.status === "won" ? freshSnake(current.bestScore) : { ...current, status: current.status === "playing" ? "paused" : "playing" };
    patchConfig(context, widget.id, next, "snake-toggle");
    grid.focus({ preventScroll: true });
  });
  reset.addEventListener("click", () => patchConfig(context, widget.id, freshSnake(snakeState(currentConfig(context, widget.id)).bestScore), "snake-reset"));
  grid.addEventListener("pointerenter", () => grid.focus({ preventScroll: true }));
  grid.addEventListener("pointerleave", () => { if (document.activeElement === grid) grid.blur(); });
  grid.addEventListener("pointerdown", () => grid.focus({ preventScroll: true }));
  grid.addEventListener("keydown", (event) => {
    const direction = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[event.key];
    if (!direction || document.activeElement !== grid) return;
    event.preventDefault();
    event.stopPropagation();
    applyDirection(direction);
  });
  return element("div", { className: "snake-widget widget-fill", attrs: { "aria-label": "Игра Змейка" } }, [
    element("div", { className: "snake-topline" }, [score, status]),
    grid,
    element("div", { className: "button-row snake-actions" }, [toggle, reset]),
  ]);
}
function renderSnakeGrid(root, state) {
  const grid = root.querySelector("[data-role='grid']");
  const totalCells = snakeSize * snakeSize;
  let cells = root.__snakeCells;
  if (!Array.isArray(cells) || cells.length !== totalCells) {
    cells = Array.from({ length: totalCells }, () => element("span", { className: "snake-cell", attrs: { "aria-hidden": "true" } }));
    grid.replaceChildren(...cells);
    root.__snakeCells = cells;
    root.__snakeCellKinds = new Map();
  }

  const nextKinds = new Map();
  state.snake.forEach((cell, index) => nextKinds.set(`${cell.x}:${cell.y}`, index === 0 ? "is-head" : "is-body"));
  if (state.food) {
    const foodKey = `${state.food.x}:${state.food.y}`;
    if (!nextKinds.has(foodKey)) nextKinds.set(foodKey, "is-food");
  }

  const previousKinds = root.__snakeCellKinds || new Map();
  const changedKeys = new Set([...previousKinds.keys(), ...nextKinds.keys()]);
  changedKeys.forEach((key) => {
    const previousKind = previousKinds.get(key);
    const nextKind = nextKinds.get(key);
    if (previousKind === nextKind) return;
    const [x, y] = key.split(":").map(Number);
    const cell = cells[y * snakeSize + x];
    if (cell) cell.className = `snake-cell ${nextKind || ""}`.trim();
  });
  root.__snakeCellKinds = nextKinds;
}

function updateSnake(root, widget, context) {
  let config = widget.config || {};
  if (!Array.isArray(config.snake) || config.snake.length < 3) {
    const initial = freshSnake(config.bestScore);
    patchConfig(context, widget.id, initial, "snake-initialize");
    config = { ...config, ...initial };
  }
  const state = snakeState(config);
  root.querySelector("[data-role='score']").textContent = `Счёт ${state.score} · Рекорд ${state.bestScore}`;
  const statusText = { ready: "Наведите курсор и используйте стрелки", playing: "В игре", paused: "Пауза", gameover: "Столкновение", won: "Поле пройдено" }[state.status] || "Готово";
  root.querySelector("[data-role='status']").textContent = statusText;
  const toggle = root.querySelector("[data-role='toggle']");
  toggle.textContent = state.status === "playing" ? "Пауза" : (state.status === "gameover" || state.status === "won" ? "Снова" : "Старт");
  renderSnakeGrid(root, state);
  const needsTimer = state.status === "playing";
  if (!needsTimer) disposeSnake(root);
  else if (!root.__snakeTimer || root.__snakeSpeed !== state.speed) {
    disposeSnake(root);
    root.__snakeSpeed = state.speed;
    root.__snakeTimer = setInterval(() => {
      const current = snakeState(currentConfig(context, widget.id));
      if (current.status === "playing") patchConfig(context, widget.id, moveSnake(current), "snake-tick");
    }, state.speed);
  }
}

function currentConfig(context, id) {
  return context.store.getState().widgets.find((widget) => widget.id === id)?.config || {};
}
function readableDomain(value) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "Укажите безопасный URL"; }
}
function quotePool() {
  return [
    { text: "Делай, что можешь, с тем, что имеешь, там, где ты есть.", author: "Теодор Рузвельт" },
    { text: "Будущее зависит от того, что вы делаете сегодня.", author: "Махатма Ганди" },
    { text: "Не важно, как медленно ты идёшь, пока ты не останавливаешься.", author: "Конфуций" },
    { text: "Секрет того, чтобы продвигаться вперёд, — начать.", author: "Марк Твен" },
    { text: "Ничего не происходит, пока что-то не сдвинется с места.", author: "Альберт Эйнштейн" },
    { text: "Счастье зависит от нас самих.", author: "Аристотель" },
    { text: "Не ждите. Время никогда не будет подходящим.", author: "Наполеон Хилл" },
    { text: "Лучший способ предсказать будущее — создать его.", author: "Питер Друкер" },
    { text: "Тот, кто имеет зачем жить, выдержит почти любое как.", author: "Фридрих Ницше" },
    { text: "Начинать всегда стоит с того, что сеет сомнения.", author: "Борис Стругацкий" },
    { text: "Всякая работа трудна до времени, пока её не полюбишь.", author: "Максим Горький" },
    { text: "Жизнь — это то, что с тобой происходит, пока ты строишь планы.", author: "Джон Леннон" },
  ];
}
function calculate(expression) {
  if (!/^[0-9+\-*/().\s]*$/.test(expression) || expression.length > 120) return null;
  try {
    const tokens = expression.match(/\d*\.?\d+|[()+\-*/]/g) || [];
    if (tokens.join("") !== expression.replace(/\s/g, "")) return null;
    const values = [];
    const ops = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };
    const apply = () => {
      const right = values.pop(); const left = values.pop(); const op = ops.pop();
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("invalid");
      if (op === "+") values.push(left + right);
      if (op === "-") values.push(left - right);
      if (op === "*") values.push(left * right);
      if (op === "/") values.push(right === 0 ? NaN : left / right);
    };
    let previous = "";
    for (const token of tokens) {
      if (/^\d/.test(token)) values.push(Number(token));
      else if (token === "(") ops.push(token);
      else if (token === ")") { while (ops.length && ops.at(-1) !== "(") apply(); if (ops.pop() !== "(") return null; }
      else {
        if ((token === "-" || token === "+") && (!previous || previous === "(" || precedence[previous])) values.push(0);
        while (ops.length && ops.at(-1) !== "(" && precedence[ops.at(-1)] >= precedence[token]) apply();
        ops.push(token);
      }
      previous = token;
    }
    while (ops.length) { if (ops.at(-1) === "(") return null; apply(); }
    const answer = values.length === 1 ? values[0] : null;
    return Number.isFinite(answer) ? Math.round(answer * 1e10) / 1e10 : null;
  } catch { return null; }
}
function freshGame() {
  const board = Array(16).fill(0);
  addTile(board); addTile(board);
  return { board, score: 0 };
}
function addTile(board) {
  const open = board.map((value, index) => value === 0 ? index : -1).filter((index) => index >= 0);
  if (open.length) board[open[Math.floor(Math.random() * open.length)]] = Math.random() < 0.9 ? 2 : 4;
}
function moveGame(config, direction) {
  const board = Array.isArray(config.board) && config.board.length === 16 ? [...config.board] : freshGame().board;
  const old = board.join(",");
  const lines = direction === "left" || direction === "right"
    ? [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]]
    : [[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]];
  let score = number(config.score);
  lines.forEach((line) => {
    const indices = direction === "right" || direction === "down" ? [...line].reverse() : line;
    const values = indices.map((index) => board[index]).filter(Boolean);
    for (let i = 0; i < values.length - 1; i += 1) if (values[i] === values[i + 1]) { values[i] *= 2; score += values[i]; values.splice(i + 1, 1); }
    while (values.length < 4) values.push(0);
    indices.forEach((index, i) => { board[index] = values[i]; });
  });
  if (board.join(",") !== old) addTile(board);
  return { board, score };
}

export const basicDefinitions = [
  { type: "clock", title: "Часы", icon: "clock", category: "Основное", accent: "#d9b45f", defaultSize: { w: 270, h: 176 }, defaultConfig: { format: "24", showSeconds: true, clockScale: 1 }, properties: [{ key: "format", label: "Формат", section: "Время", type: "select", options: [{ value: "24", label: "24 часа" }, { value: "12", label: "12 часов" }] }, { key: "showSeconds", label: "Секунды", section: "Время", type: "toggle" }, { key: "clockScale", label: "Размер текста часов", section: "Время", type: "range", min: 0.65, max: 1.8, step: 0.05, default: 1 }], create: createClock, update: updateClock, dispose: disposeTimer },
  { type: "note", title: "Заметка", icon: "note", category: "Продуктивность", accent: "#d9a8ff", defaultSize: { w: 300, h: 220 }, defaultConfig: { content: "" }, properties: [], create: createNote, update: updateNote },
  { type: "todo", title: "Задачи", icon: "task", category: "Продуктивность", accent: "#7ee0b4", defaultSize: { w: 320, h: 270 }, minSize: { w: 256, h: 220 }, defaultConfig: { tasks: [] }, properties: [], create: createTodo, update: updateTodo },
  { type: "link", title: "Ссылка", icon: "note", category: "Основное", accent: "#d9b45f", defaultSize: { w: 250, h: 145 }, defaultConfig: { text: "Моя ссылка", url: "", icon: "↗" }, properties: [{ key: "text", label: "Название", section: "Содержимое", type: "text" }, { key: "url", label: "URL", section: "Содержимое", type: "url" }, { key: "icon", label: "Знак", section: "Содержимое", type: "text", maxLength: 4 }], create: createLink, update: updateLink },
  { type: "quote", title: "Цитата", icon: "quote", category: "Вдохновение", accent: "#f3bd72", defaultSize: { w: 330, h: 200 }, defaultConfig: { index: 0 }, properties: [], create: createQuote, update: updateQuote },
  { type: "browser-media", title: "Управление воспроизведением", icon: "play", category: "Инструменты", accent: "#60d99a", defaultSize: { w: 350, h: 320 }, minSize: { w: 280, h: 265 }, defaultConfig: { tabId: null, frameId: null, mediaKey: "", provider: "native", sourceCount: 1, found: false, title: "", paused: true, muted: false, volume: 100, currentTime: 0, duration: 0, message: "" }, properties: [], create: createBrowserMedia, update: updateBrowserMedia },
  { type: "player", title: "Плеер", icon: "play", category: "Инструменты", accent: "#d9b45f", defaultSize: { w: 420, h: 390 }, defaultConfig: { title: "Ночной эфир", artist: "Мой плейлист", audioUrl: "", volume: 0.8 }, properties: [{ key: "title", label: "Название трека", section: "Трек", type: "text", maxLength: 80 }, { key: "artist", label: "Исполнитель", section: "Трек", type: "text", maxLength: 80 }, { key: "audioUrl", label: "Ссылка на аудио или YouTube", section: "Источник", type: "url", maxLength: 600, hint: "Поддерживаются прямые аудиоссылки, youtube.com и youtu.be" }, { key: "volume", label: "Громкость", section: "Воспроизведение", type: "range", min: 0, max: 1, step: 0.05, default: 0.8 }], create: createPlayer, update: updatePlayer, dispose: disposePlayer },
  { type: "random", title: "Случайное число", icon: "calculator", category: "Инструменты", accent: "#e4b2ff", defaultSize: { w: 270, h: 200 }, defaultConfig: { min: 1, max: 100, result: undefined }, properties: [], create: createRandom, update: updateRandom },
  { type: "password-generator", title: "Генератор паролей", icon: "lock", category: "Инструменты", accent: "#68d7b0", defaultSize: { w: 330, h: 235 }, minSize: { w: 260, h: 205 }, defaultConfig: { length: 16, lowercase: true, uppercase: true, numbers: true, symbols: true }, properties: [{ key: "length", label: "Длина", section: "Пароль", type: "range", min: 8, max: 64, step: 1, default: 16 }, { key: "lowercase", label: "Строчные буквы", section: "Пароль", type: "toggle", default: true }, { key: "uppercase", label: "Заглавные буквы", section: "Пароль", type: "toggle", default: true }, { key: "numbers", label: "Цифры", section: "Пароль", type: "toggle", default: true }, { key: "symbols", label: "Символы", section: "Пароль", type: "toggle", default: true }], create: createPasswordGenerator, update: updatePasswordGenerator },
  { type: "calendar", title: "Календарь", icon: "calendar", category: "Основное", accent: "#d9b45f", defaultSize: { w: 340, h: 310 }, defaultConfig: { offset: 0 }, properties: [], create: createCalendar, update: updateCalendar },
  { type: "countdown", title: "Обратный отсчёт", icon: "timer", category: "Основное", accent: "#f49d9d", defaultSize: { w: 320, h: 175 }, defaultConfig: { label: "До события", target: "" }, properties: [{ key: "label", label: "Событие", section: "Событие", type: "text" }, { key: "target", label: "Дата", section: "Время", type: "datetime-local" }], create: createCountdown, update: updateCountdown, dispose: disposeTimer },
  { type: "timer", title: "Секундомер", icon: "timer", category: "Инструменты", accent: "#84e1bc", defaultSize: { w: 290, h: 180 }, defaultConfig: { running: false, elapsedMs: 0, startedAt: null }, properties: [], create: createTimer, update: updateTimer, dispose: disposeTimer },
  { type: "focus-timer", title: "Таймер", icon: "timer", category: "Инструменты", accent: "#ff9c71", defaultSize: { w: 300, h: 360 }, minSize: { w: 255, h: 320 }, defaultConfig: { totalSeconds: 1500, remainingSeconds: 1500, running: false, endsAt: null }, properties: [], create: createFocusTimer, update: updateFocusTimer, dispose: disposeTimer },
  { type: "calculator", title: "Калькулятор", icon: "calculator", category: "Инструменты", accent: "#d9b45f", defaultSize: { w: 290, h: 385 }, defaultConfig: { expression: "", result: "" }, properties: [], create: createCalculator, update: updateCalculator },
  { type: "game", title: "2048", icon: "2048", category: "Игры", accent: "#f3bd72", defaultSize: { w: 320, h: 410 }, defaultConfig: freshGame(), properties: [], create: createGame, update: updateGame },
  { type: "snake", title: "Змейка", icon: "snake", category: "Игры", accent: "#a9c86b", defaultSize: { w: 340, h: 430 }, defaultConfig: freshSnake(), properties: [{ key: "speed", label: "Скорость", section: "Игра", type: "select", default: "190", options: [{ value: "260", label: "Спокойная" }, { value: "190", label: "Обычная" }, { value: "130", label: "Быстрая" }] }], create: createSnake, update: updateSnake, dispose: disposeSnake },
];










