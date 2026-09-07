import { element } from "./dom.js";

const colorPattern = /^#[0-9a-f]{6}$/i;
const colorSwatches = ["#d9b45f", "#6ee7b7", "#b7d978", "#d7a8d6", "#f0abcc", "#fda4af", "#fdba74", "#fde68a", "#f3f0e8", "#b9b0a5", "#3a2a24", "#17140d"];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function hexToHsv(value) {
  const hex = colorPattern.test(value || "") ? value.slice(1) : "d9b45f";
  const red = parseInt(hex.slice(0, 2), 16) / 255; const green = parseInt(hex.slice(2, 4), 16) / 255; const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue); const min = Math.min(red, green, blue); const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }
  return { h: (hue + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const chroma = clamp(Number(v)) * clamp(Number(s)); const part = hue / 60; const x = chroma * (1 - Math.abs((part % 2) - 1));
  const [r, g, b] = part < 1 ? [chroma, x, 0] : part < 2 ? [x, chroma, 0] : part < 3 ? [0, chroma, x] : part < 4 ? [0, x, chroma] : part < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const match = clamp(Number(v)) - chroma;
  return `#${[r, g, b].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function createColorEditor({ label, value, fallback = "#d9b45f", onChange }) {
  let hsv = hexToHsv(value || fallback); let dragging = false;
  const preview = element("span", { className: "color-preview", attrs: { "aria-hidden": "true" } });
  const hex = element("input", { className: "color-hex", value: hsvToHex(hsv).toUpperCase(), attrs: { type: "text", inputmode: "text", maxlength: "7", spellcheck: "false", "aria-label": `${label}: HEX` } });
  const surface = element("div", { className: "color-surface", attrs: { role: "slider", tabindex: "0", "aria-label": `${label}: насыщенность и яркость` } });
  const cursor = element("span", { className: "color-surface-cursor", attrs: { "aria-hidden": "true" } });
  const hue = element("input", { className: "color-hue", value: Math.round(hsv.h), attrs: { type: "range", min: "0", max: "359", step: "1", "aria-label": `${label}: оттенок` } });
  const swatches = element("div", { className: "color-swatches", attrs: { "aria-label": "Готовые цвета" } });
  surface.append(cursor);
  const root = element("div", { className: "color-editor" }, [element("div", { className: "color-editor-head" }, [preview, hex]), surface, hue, swatches]);

  const reflect = () => {
    const current = hsvToHex(hsv);
    root.style.setProperty("--picker-hue", `hsl(${hsv.h} 100% 50%)`);
    preview.style.background = current; cursor.style.left = `${hsv.s * 100}%`; cursor.style.top = `${(1 - hsv.v) * 100}%`; hue.value = String(Math.round(hsv.h));
    if (document.activeElement !== hex) hex.value = current.toUpperCase();
    swatches.querySelectorAll("button").forEach((button) => { const selected = button.dataset.color === current.toLowerCase(); button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
  };
  const commit = (next) => { hsv = { h: hsv.h, s: hsv.s, v: hsv.v, ...next }; const current = hsvToHex(hsv); reflect(); onChange(current); };
  const setSurfacePosition = (event) => { const rect = surface.getBoundingClientRect(); commit({ s: clamp((event.clientX - rect.left) / rect.width), v: 1 - clamp((event.clientY - rect.top) / rect.height) }); };

  colorSwatches.forEach((color) => {
    const button = element("button", { className: "color-swatch", attrs: { type: "button", "aria-label": `Готовый цвет ${color}`, "aria-pressed": "false" }, dataset: { color }, title: color });
    button.style.background = color;
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", () => { hsv = hexToHsv(color); commit({}); });
    swatches.append(button);
  });
  surface.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); dragging = true; surface.setPointerCapture?.(event.pointerId); setSurfacePosition(event); });
  surface.addEventListener("pointermove", (event) => { if (dragging) setSurfacePosition(event); });
  surface.addEventListener("pointerup", (event) => { dragging = false; surface.releasePointerCapture?.(event.pointerId); });
  surface.addEventListener("pointercancel", () => { dragging = false; });
  surface.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === "ArrowLeft") { event.preventDefault(); commit({ s: hsv.s - step }); }
    if (event.key === "ArrowRight") { event.preventDefault(); commit({ s: hsv.s + step }); }
    if (event.key === "ArrowUp") { event.preventDefault(); commit({ v: hsv.v + step }); }
    if (event.key === "ArrowDown") { event.preventDefault(); commit({ v: hsv.v - step }); }
  });
  hue.addEventListener("pointerdown", (event) => event.stopPropagation());
  hue.addEventListener("input", () => commit({ h: Number(hue.value) }));
  hex.addEventListener("pointerdown", (event) => event.stopPropagation());
  hex.addEventListener("change", () => {
    const normalized = hex.value.trim().startsWith("#") ? hex.value.trim() : `#${hex.value.trim()}`;
    if (colorPattern.test(normalized)) { hsv = hexToHsv(normalized); commit({}); } else reflect();
  });
  reflect();
  return root;
}
