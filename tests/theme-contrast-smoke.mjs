import assert from "node:assert/strict";
import { themePresets } from "../src/themes/presets.js";

function parseHex(value) {
  const match = String(value || "").trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  assert.ok(match, `ожидался шестнадцатеричный цвет, получено: ${value}`);
  const raw = match[1].length === 3
    ? match[1].split("").map((part) => part + part).join("")
    : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(raw.slice(offset, offset + 2), 16));
}

function luminance(color) {
  const channels = parseHex(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function contrastRatio(left, right) {
  const light = Math.max(luminance(left), luminance(right));
  const dark = Math.min(luminance(left), luminance(right));
  return (light + .05) / (dark + .05);
}

assert.equal(themePresets.length, 14, "каталог должен содержать все четырнадцать встроенных тем");
for (const theme of themePresets) {
  const accent = theme.colors?.["--accent"];
  const contrast = theme.colors?.["--accent-contrast"];
  const ratio = contrastRatio(accent, contrast);
  assert.ok(ratio >= 4.5, `${theme.id}: контраст текста на акцентной кнопке ${ratio.toFixed(2)}:1 ниже 4.5:1`);
}

const violet = themePresets.find((theme) => theme.id === "color-violet");
assert.equal(violet?.colors?.["--accent"], "#963ae6", "фиолетовый сигнал использует проверенный контрастный акцент");
assert.equal(violet?.colors?.["--accent-contrast"], "#ffffff", "фиолетовый сигнал использует светлый текст акцентных кнопок");

console.log("theme-contrast-smoke: passed");
