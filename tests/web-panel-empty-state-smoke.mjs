import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/overlay/web-panel.js", import.meta.url), "utf8");

assert.match(source, /function makeEmptyPanel\(\)/, "Панель сайтов должна иметь отдельное пустое состояние.");
assert.match(source, /text: "Нет выбранных карточек"/, "Пустое состояние должно объяснять отсутствие виджетов.");
assert.match(source, /className: "empty-action", text: "Настроить панель"/, "Пустое состояние должно содержать понятную кнопку настройки.");
assert.match(source, /configure\.addEventListener\("click", openPanelSettings\)/, "Кнопка пустого состояния должна открывать настройки панели.");
assert.match(source, /aria-label": "Панель пока пуста"/, "Пустое состояние должно иметь доступное имя.");
assert.match(source, /\.empty-action:hover, \.empty-action:focus-visible \{ color: var\(--mflt-contrast\);/, "Фокус и наведение основной кнопки должны сохранять контрастный текст.");

console.log("web-panel-empty-state-smoke: passed");
