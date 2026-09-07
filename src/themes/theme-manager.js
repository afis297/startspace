import { getPreset, THEME_VARIABLES } from "./presets.js";
import { getThemeContract } from "./theme-contracts.js";
import { callExtensionApi, getExtensionApi } from "../services/extension-api.js";

const WEB_PANEL_THEME_KEY = "mfltWebPanelThemeV1";

function publishWebPanelTheme(root, colors) {
  const storage = getExtensionApi()?.storage?.local;
  if (!storage || typeof getComputedStyle !== "function") return;
  const computed = getComputedStyle(root);
  const token = (name, fallback = "") => computed.getPropertyValue(name).trim() || colors?.[name] || fallback;
  const accent = token("--accent", "#00ff41");
  const bg = token("--surface", token("--bg-0", "#000000"));
  // Some theme presets intentionally expose only their base tokens. Build every
  // derived panel value from them instead of abandoning the sync altogether.
  const palette = {
    bg,
    strong: token("--surface-strong", bg),
    hover: token("--surface-hover", bg),
    text: token("--text", "#f5f5f5"),
    muted: token("--muted", token("--text", "#b8b8b8")),
    line: token("--line", accent),
    accent,
    contrast: token("--accent-contrast", "#000000"),
    shadow: token("--shadow", "rgba(0,0,0,.72)"),
  };
  // Хранилище остаётся источником темы для панелей, созданных позднее.
  callExtensionApi(storage.set, storage, [{ [WEB_PANEL_THEME_KEY]: palette }]).catch(() => undefined);
  // Смену темы передаём через service worker. В отличие от прямого обхода вкладок,
  // этот маршрут одинаково работает в Chromium-браузерах и не зависит от текущей
  // вкладки, на которой открыты настройки.
  const api = getExtensionApi();
  if (api?.runtime?.sendMessage) {
    callExtensionApi(api.runtime.sendMessage, api.runtime, [{ type: "mflt-web-panel-theme-publish", palette }]).catch(() => undefined);
  }
}

function isSafeWallpaper(value) {
  return /^https?:\/\//i.test(value || "") || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value || "");
}

function isBlueHex(value) {
  if (!/^#[0-9a-f]{6}$/i.test(value || "")) return false;
  const hex = value.slice(1);
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return blue > red * 1.12 && blue > green * 1.05 && blue > 74;
}

export function applyTheme(settings, root = document.documentElement) {
  const preset = getPreset(settings.themeId);
  const contract = getThemeContract(preset.id);
  root.dataset.theme = preset.id;
  root.dataset.themeFamily = contract.family;
  root.dataset.themeTreatment = contract.treatment;
  const allowBlue = ["ocean"].includes(preset.id);
  // Цветные консоли и «Полночь» используют только собственную палитру:
  // сохранённый кастомный оттенок не должен приносить жёлтый или другой чужой сигнал.
  const allowCustomColors = contract.family !== "console" && preset.id !== "midnight";
  const custom = Object.fromEntries(Object.entries(settings.customTheme || {}).filter(([key, value]) => (
    allowCustomColors && THEME_VARIABLES.includes(key) && (allowBlue || !isBlueHex(value))
  )));
  const colors = { ...preset.colors, ...custom };
  Object.entries(colors).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.theme = preset.id;
  root.dataset.corners = settings.behavior?.roundedCorners === false ? "square" : "rounded";
  const requestedCornerRadius = Number(settings.behavior?.cornerRadius);
  const cornerRadius = Math.min(24, Math.max(0, Number.isFinite(requestedCornerRadius) ? requestedCornerRadius : 8));
  root.style.setProperty("--global-corner-radius", `${cornerRadius}px`);
  root.style.setProperty("--radius-sm", `${Math.round(cornerRadius * 0.65)}px`);
  root.style.setProperty("--radius-md", `${cornerRadius}px`);
  root.style.setProperty("--radius-lg", `${Math.round(cornerRadius * 1.4)}px`);
  root.style.setProperty("--motion-duration", settings.behavior?.reduceMotion ? "0ms" : "180ms");
  publishWebPanelTheme(root, colors);
  const wallpaper = settings.wallpaper || {};
  const canUseSolidWallpaper = allowCustomColors
    && /^#[0-9a-f]{6}$/i.test(wallpaper.value || "")
    && (allowBlue || !isBlueHex(wallpaper.value));
  const background = wallpaper.mode === "image" && isSafeWallpaper(wallpaper.value)
    ? `linear-gradient(rgba(5, 10, 20, .18), rgba(5, 10, 20, .32)), url("${wallpaper.value.replace(/\"/g, "%22")}")`
    : wallpaper.mode === "solid" && canUseSolidWallpaper
      ? wallpaper.value
      : colors["--wallpaper-fallback"];
  root.style.setProperty("--workspace-background", background);
  root.style.setProperty("--wallpaper-position", wallpaper.position || "center");
  root.style.setProperty("--wallpaper-size", wallpaper.size || "cover");

  // Keep an inline image fallback on the actual desktop: some Chromium theme cascades
  // can preserve an older background shorthand even when the custom property changes.
  const hasUploadedWallpaper = wallpaper.mode === "image" && isSafeWallpaper(wallpaper.value);
  const workspace = typeof document === "undefined" ? null : document.getElementById("workspace");
  const wallpaperLayer = typeof document === "undefined" ? null : document.getElementById("wallpaper-layer");
  root.dataset.hasWallpaper = String(hasUploadedWallpaper);
  if (wallpaperLayer) {
    if (hasUploadedWallpaper) {
      wallpaperLayer.src = wallpaper.value;
      wallpaperLayer.style.objectPosition = wallpaper.position || "center";
      wallpaperLayer.style.objectFit = wallpaper.size === "contain" ? "contain" : wallpaper.size === "auto" ? "none" : "cover";
    } else {
      wallpaperLayer.removeAttribute("src");
      wallpaperLayer.style.removeProperty("object-position");
      wallpaperLayer.style.removeProperty("object-fit");
    }
  }
  if (workspace) {
    const imageLayer = hasUploadedWallpaper
      ? `linear-gradient(rgba(5, 10, 20, .18), rgba(5, 10, 20, .32)), url("${wallpaper.value.replace(/\"/g, "%22")}")`
      : "";
    workspace.style.backgroundImage = imageLayer;
    if (imageLayer) {
      workspace.style.backgroundPosition = wallpaper.position || "center";
      workspace.style.backgroundSize = wallpaper.size || "cover";
      workspace.style.backgroundRepeat = "no-repeat";
    } else {
      workspace.style.removeProperty("background-position");
      workspace.style.removeProperty("background-size");
      workspace.style.removeProperty("background-repeat");
    }
  }
}

export function previewTheme(themeId, customTheme = {}) {
  const preset = getPreset(themeId);
  return { ...preset.colors, ...customTheme };
}
