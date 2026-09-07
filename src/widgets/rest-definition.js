import { element } from "../ui/dom.js";
import { createLineIcon } from "../ui/icons.js";
import { patchConfig } from "./helpers.js";

const sounds = [
  { id: "rain", label: "Дождь", description: "Мягкий дождь" },
  { id: "downpour", label: "Ливень", description: "Мощная стена дождя" },
  { id: "thunder", label: "Гроза", description: "Ливень и раскаты грома" },
  { id: "lofi", label: "Lo-fi", description: "Ночной ритм для фокуса" },
  { id: "sea", label: "Море", description: "Ровный прибой" },
  { id: "forest", label: "Лес", description: "Лесной фон" },
  { id: "fire", label: "Камин", description: "Тёплое потрескивание" },
  { id: "wind", label: "Ветер", description: "Натуральные порывы в листве" },
  { id: "custom", label: "Свой URL", description: "Внешний поток" },
];
const soundById = new Map(sounds.map((sound) => [sound.id, sound]));
const bundledAudio = Object.freeze({
  rain: "assets/audio/rest-rain-nps.mp3",
  downpour: "assets/audio/rest-downpour-natural.ogg",
  thunder: "assets/audio/rest-thunder-natural.ogg",
  lofi: "assets/audio/rest-lofi-original.mp3",
  sea: "assets/audio/rest-sea-nps.mp3",
  forest: "assets/audio/rest-forest-nps.mp3",
  fire: "assets/audio/rest-fire-commons.ogg",
  wind: "assets/audio/rest-wind-natural.ogg",
});
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function safeAudioUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

function secondsLabel(seconds) {
  const safe = Math.max(0, Math.ceil(number(seconds)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function bundledAudioUrl(sound) {
  const path = bundledAudio[sound];
  if (!path) return "";
  return globalThis.chrome?.runtime?.getURL?.(path) || new URL(`../../${path}`, import.meta.url).href;
}

function audioSourceFor(sound, config) {
  return sound === "custom" ? safeAudioUrl(config.customUrl) : bundledAudioUrl(sound);
}

function stopAmbient(root) {
  const audio = root.__restAudio;
  if (audio) {
    audio.pause();
    try { audio.currentTime = 0; } catch { /* media is not seekable yet */ }
  }
  root.__restPlaying = false;
}

function setRestVolume(root, value) {
  const volume = Math.min(1.5, Math.max(0, number(value, 0.55)));
  root.__restVolume = volume;
  const audio = root.__restAudio;
  if (!audio) return volume;
  audio.volume = Math.min(1, volume);
  if (root.__restGain) {
    const now = root.__restAudioContext?.currentTime || 0;
    root.__restGain.gain.setTargetAtTime(volume, now, 0.035);
  }
  root.classList.toggle("is-rest-boosted", volume > 1);
  return volume;
}

function enableRestBoost(root) {
  if (root.__restGain || root.__restBoostUnavailable || !root.__restAudio) return;
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextCtor) {
    root.__restBoostUnavailable = true;
    return;
  }
  try {
    const context = new AudioContextCtor();
    const source = context.createMediaElementSource(root.__restAudio);
    const gain = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.22;
    source.connect(gain).connect(compressor).connect(context.destination);
    root.__restAudioContext = context;
    root.__restAudioSource = source;
    root.__restGain = gain;
    setRestVolume(root, root.__restVolume ?? root.__restAudio.volume);
  } catch (error) {
    root.__restBoostUnavailable = true;
    console.warn("Не удалось включить усиление звука.", error);
  }
}

function disposeRestBoost(root) {
  try { root.__restAudioSource?.disconnect(); } catch {}
  try { root.__restGain?.disconnect(); } catch {}
  try { root.__restAudioContext?.close(); } catch {}
  root.__restAudioSource = null;
  root.__restGain = null;
  root.__restAudioContext = null;
}
function clearSleepTimer(root) {
  if (root.__restTimer) clearInterval(root.__restTimer);
  root.__restTimer = null;
}

function paintRest(root, config) {
  const sound = soundById.get(config.sound) || sounds[0];
  root.dataset.restSound = sound.id;
  const sourceButtons = root.querySelectorAll("[data-sound]");
  sourceButtons.forEach((button) => {
    const active = button.dataset.sound === sound.id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const volume = Math.min(1.5, Math.max(0, number(config.volume, 0.55)));
  const volumeInput = root.querySelector("[data-role='volume']");
  if (document.activeElement !== volumeInput) volumeInput.value = String(volume);
  const play = root.querySelector("[data-role='toggle']");
  play.setAttribute("aria-label", root.__restPlaying ? "Пауза фонового звука" : "Включить фоновый звук");
  play.setAttribute("aria-pressed", String(Boolean(root.__restPlaying)));
  play.replaceChildren(createLineIcon(root.__restPlaying ? "pause" : "play", { size: 22 }));
  root.classList.toggle("is-playing", Boolean(root.__restPlaying));
  root.querySelector("[data-role='name']").textContent = sound.label;
  root.querySelector("[data-role='description']").textContent = sound.description;
  const endAt = number(config.timerEndsAt);
  const remaining = endAt > Date.now() ? Math.ceil((endAt - Date.now()) / 1000) : 0;
  const timerButton = root.querySelector("[data-role='timer']");
  timerButton.textContent = remaining ? secondsLabel(remaining) : "Таймер";
  timerButton.classList.toggle("is-active", Boolean(remaining));
  timerButton.setAttribute("aria-pressed", String(Boolean(remaining)));
  const status = root.querySelector("[data-role='status']");
  const source = audioSourceFor(sound.id, config);
  const sourceError = root.__restErrorSource === source ? root.__restError : "";
  if (sourceError) status.textContent = sourceError;
  else if (endAt && !remaining) status.textContent = "Таймер завершён";
  else if (root.__restPlaying) status.textContent = sound.id === "custom" ? "Воспроизводится внешний источник" : "Воспроизводится реальная запись";
  else if (sound.id === "custom" && !source) status.textContent = "Укажите HTTPS-ссылку на аудио в н.в.";
  else if (!source) status.textContent = "Встроенная запись недоступна";
  else status.textContent = "Готово к спокойной паузе";
}

function startSleepTimer(root, context, widgetId, endAt) {
  clearSleepTimer(root);
  const deadline = number(endAt);
  if (!deadline || deadline <= Date.now()) return;
  const timer = root.querySelector("[data-role='timer']");
  root.__restTimer = setInterval(() => {
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    if (remaining > 0) {
      if (timer) {
        timer.textContent = secondsLabel(remaining);
        timer.classList.add("is-active");
      }
      return;
    }
    stopAmbient(root);
    clearSleepTimer(root);
    patchConfig(context, widgetId, { timerEndsAt: 0 }, "rest-timer-finished");
  }, 1000);
}

export function createRest(widget, context) {
  const play = element("button", { className: "rest-toggle", attrs: { type: "button", "data-role": "toggle", "aria-label": "Включить фоновый звук", "aria-pressed": "false" } }, [createLineIcon("play", { size: 22 })]);
  const timer = element("button", { className: "rest-timer-button", attrs: { type: "button", "data-role": "timer", "aria-label": "Настроить таймер отключения", "aria-pressed": "false" }, text: "Таймер" });
  const volume = element("input", { className: "rest-volume", attrs: { type: "range", min: "0", max: "1.5", step: "0.05", value: "0.55", "data-role": "volume", "aria-label": "Громкость фонового звука" } });
  const soundButtons = sounds.map((sound) => element("button", {
    className: "rest-sound",
    attrs: { type: "button", "data-sound": sound.id, "aria-pressed": "false" },
    text: sound.label,
  }));
  const root = element("div", { className: "rest-widget widget-fill" }, [
    element("div", { className: "rest-hero" }, [
      element("div", { className: "rest-emblem", attrs: { "aria-hidden": "true" } }, [element("span", { className: "rest-emblem-ring" }), createLineIcon("rest", { size: 30 })]),
      element("div", { className: "rest-copy" }, [element("span", { className: "rest-kicker", text: "Тихий режим" }), element("strong", { attrs: { "data-role": "name" } }), element("span", { className: "rest-description", attrs: { "data-role": "description" } })]),
      play,
    ]),
    element("div", { className: "rest-sounds", attrs: { "aria-label": "Выбор фонового звука" } }, soundButtons),
    element("div", { className: "rest-controls" }, [element("span", { className: "rest-volume-label", text: "Громкость" }), volume, timer]),
    element("span", { className: "rest-status", attrs: { "data-role": "status", "aria-live": "polite" } }),
  ]);
  const customAudio = document.createElement("audio");
  customAudio.loop = true;
  customAudio.preload = "metadata";
  customAudio.playsInline = true;
  customAudio.addEventListener("error", () => {
    const config = context.store.getState().widgets.find((item) => item.id === widget.id)?.config || {};
    const source = audioSourceFor(config.sound, config);
    if (!source || customAudio.src !== source) return;
    root.__restPlaying = false;
    root.__restError = config.sound === "custom" ? "Не удалось загрузить внешний источник" : "Не удалось загрузить встроенную запись";
    root.__restErrorSource = source;
    paintRest(root, config);
  });
  root.__restAudio = customAudio;
  root.__restPlaying = false;

  const start = async () => {
    const config = context.store.getState().widgets.find((item) => item.id === widget.id)?.config || {};
    const sound = soundById.get(config.sound) || sounds[0];
  root.dataset.restSound = sound.id;
    root.__restError = "";
    root.__restErrorSource = "";
    stopAmbient(root);
    const source = audioSourceFor(sound.id, config);
    if (!source) { paintRest(root, config); return; }
    if (customAudio.src !== source) customAudio.src = source;
    setRestVolume(root, Math.min(1.5, Math.max(0, number(config.volume, 0.55))));
    enableRestBoost(root);
    if (root.__restAudioContext?.state === "suspended") await root.__restAudioContext.resume();
    try { await customAudio.play(); } catch {
      root.__restError = sound.id === "custom" ? "Внешний источник не запустился" : "Встроенная запись не запустилась";
      root.__restErrorSource = source;
      paintRest(root, config);
      return;
    }
    root.__restPlaying = true;
    if (number(config.timerEndsAt) > Date.now()) startSleepTimer(root, context, widget.id, number(config.timerEndsAt));
    paintRest(root, config);
  };

  play.addEventListener("click", () => { if (root.__restPlaying) { stopAmbient(root); paintRest(root, context.store.getState().widgets.find((item) => item.id === widget.id)?.config || {}); } else start(); });
  soundButtons.forEach((button) => button.addEventListener("click", () => patchConfig(context, widget.id, { sound: button.dataset.sound }, "rest-sound")));
  volume.addEventListener("input", () => patchConfig(context, widget.id, { volume: Math.min(1.5, Math.max(0, number(volume.value, 0.55))) }, "rest-volume"));
  timer.addEventListener("click", () => {
    const current = context.store.getState().widgets.find((item) => item.id === widget.id)?.config || {};
    const currentRemaining = number(current.timerEndsAt) > Date.now();
    const minutes = currentRemaining ? 0 : 25;
    patchConfig(context, widget.id, { timerEndsAt: minutes ? Date.now() + minutes * 60_000 : 0 }, "rest-timer");
  });
  return root;
}

export function updateRest(root, widget, context) {
  const config = widget.config || {};
  const activeSound = soundById.has(config.sound) ? config.sound : "rain";
  const volume = Math.min(1.5, Math.max(0, number(config.volume, 0.55)));
  if (root.__restPlaying && root.__restActiveSound && root.__restActiveSound !== activeSound) {
    stopAmbient(root);
    queueMicrotask(() => root.querySelector("[data-role='toggle']").click());
  }
  root.__restActiveSound = activeSound;
  if (root.__restAudio) setRestVolume(root, volume);
  const timerEndsAt = number(config.timerEndsAt);
  if (!timerEndsAt) clearSleepTimer(root);
  else if (timerEndsAt > Date.now() && root.__restPlaying) startSleepTimer(root, context, widget.id, timerEndsAt);
  else if (timerEndsAt <= Date.now()) stopAmbient(root);
  paintRest(root, { ...config, sound: activeSound });
}

export function disposeRest(root) {
  clearSleepTimer(root);
  stopAmbient(root);
  disposeRestBoost(root);
  if (root.__restAudio) {
    root.__restAudio.removeAttribute("src");
    root.__restAudio.load();
  }

}

export const restDefinition = {
  type: "rest",
  title: "Отдых",
  icon: "rest",
  category: "Благополучие",
  accent: "#8bcf9b",
  defaultSize: { w: 330, h: 310 },
  defaultConfig: { sound: "rain", volume: 0.7, customUrl: "", timerEndsAt: 0 },
  properties: [
    { key: "sound", label: "Фоновый звук", section: "Атмосфера", type: "select", options: sounds.map(({ id, label }) => ({ value: id, label })) },
    { key: "volume", label: "Громкость + усиление", section: "Атмосфера", type: "range", min: 0, max: 1.5, step: 0.05, default: 0.7 },
    { key: "customUrl", label: "Ссылка на свой поток", section: "Источник", type: "url", maxLength: 600, httpsOnly: true, hint: "Только HTTPS-ссылка на доступный аудиопоток. Используется при выборе «Свой URL»." },
  ],
  create: createRest,
  update: updateRest,
  dispose: disposeRest,
};
