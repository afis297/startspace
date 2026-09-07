import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const contract = await readFile(new URL("../src/styles/theme-contract.css", import.meta.url), "utf8");

const stylesheetOrder = [
  "src/styles/tokens.css",
  "src/styles/layout.css",
  "src/styles/widgets.css",
  "src/styles/green-console.css",
  "src/styles/notifications.css",
  "src/styles/design-polish.css",
  "src/styles/theme-contract.css",
  "src/styles/wallpaper-layer.css",
  "src/styles/onboarding.css",
  "src/styles/command-palette.css",
];

let previousPosition = -1;
for (const href of stylesheetOrder) {
  const position = index.indexOf(`href="${href}"`);
  assert.ok(position >= 0, `В index.html должен быть подключён ${href}.`);
  assert.ok(position > previousPosition, `${href} должен подключаться после предыдущего слоя каскада.`);
  previousPosition = position;
}

assert.match(contract, /--dock-control-size:\s*38px;/, "Контракт должен фиксировать единый измеряемый размер инструментов нижней панели.");
assert.match(contract, /#dock \.dock-button\s*\{[\s\S]*?width:\s*var\(--dock-control-size\);[\s\S]*?height:\s*var\(--dock-control-size\);/, "Кнопки нижней панели должны получать размеры из единого токена.");
assert.match(contract, /#dock \.workspace-switcher-trigger\s*\{[\s\S]*?height:\s*var\(--dock-control-size\);/, "Переключатель рабочих столов должен иметь высоту инструментов панели.");
assert.match(contract, /\.widget-delete-menu \.danger-action[\s\S]*?color:\s*var\(--accent-contrast\) !important;[\s\S]*?background:\s*var\(--accent\) !important;/, "Подтверждение удаления должно иметь контрастный текст на акцентном фоне.");
assert.match(contract, /:root \.dock-settings[\s\S]*?color:\s*var\(--accent\) !important;/, "Шестерёнка панели должна наследовать акцент текущей темы.");

console.log("css-cascade-contract-smoke: passed");
