import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/styles/theme-contract.css", import.meta.url), "utf8");

assert.match(css, /\.desktop-widget \.widget-delete-menu \{[\s\S]*?min-width:\s*208px/s, "диалог удаления должен сохранять достаточную ширину");
assert.match(css, /\.desktop-widget \.widget-delete-menu :is\(\.text-action, \.danger-action\) \{[\s\S]*?min-height:\s*36px/s, "кнопки диалога удаления должны иметь высоту не менее 36px");
assert.match(css, /\.desktop-widget \.widget-delete-menu \.danger-action \{[\s\S]*?color:\s*var\(--accent-contrast\) !important;[\s\S]*?background-color:\s*var\(--accent\) !important;/s, "кнопка подтверждения должна иметь контрастный текст и акцентный фон");
assert.match(css, /\.desktop-widget \.widget-delete-menu \.text-action \{[\s\S]*?background:\s*transparent !important;/s, "кнопка отмены должна оставаться вторичным действием без сплошной заливки");

console.log("delete-menu-contract-smoke: passed");
