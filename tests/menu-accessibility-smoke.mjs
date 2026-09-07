import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [palette, selectMenu, datePicker, paletteCss] = await Promise.all([
  readFile(new URL("src/ui/command-palette.js", root), "utf8"),
  readFile(new URL("src/ui/select-menu.js", root), "utf8"),
  readFile(new URL("src/ui/date-picker.js", root), "utf8"),
  readFile(new URL("src/styles/command-palette.css", root), "utf8"),
]);

assert.match(palette, /role: "dialog", "aria-modal": "true"/, "командная палитра должна быть модальным диалогом");
assert.match(palette, /event\.key === "Escape"/, "командная палитра должна закрываться по Escape");
assert.match(palette, /event\.key === "Tab"/, "командная палитра должна удерживать фокус внутри диалога");
assert.match(palette, /target\.focus\(\{ preventScroll: true \}\)/, "командная палитра должна возвращать фокус исходному элементу");
assert.match(paletteCss, /\.command-palette-item:hover,[\s\S]*?\.command-palette-item:focus-visible/s, "состояние фокуса и наведения команд должно быть визуально единым");

assert.match(selectMenu, /"aria-haspopup": "listbox", "aria-expanded": "false"/, "выпадающий список должен сообщать свой тип и состояние");
assert.match(selectMenu, /event\.key === "Escape"/, "выпадающий список должен закрываться по Escape");
assert.match(selectMenu, /\["ArrowDown", "ArrowUp", "Home", "End"\]/, "выпадающий список должен поддерживать клавиатурную навигацию");

assert.match(datePicker, /role: "dialog", "aria-label": ariaLabel/, "календарь должен быть семантическим диалогом");
assert.match(datePicker, /role: "grid"/, "дни календаря должны быть представлены сеткой");
assert.match(datePicker, /"aria-haspopup": "dialog", "aria-expanded": "false"/, "кнопка календаря должна передавать состояние раскрытия");
assert.match(datePicker, /event\.key === "Escape"/, "календарь должен закрываться по Escape");

console.log("menu-accessibility-smoke: passed");
