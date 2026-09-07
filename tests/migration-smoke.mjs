import assert from "node:assert/strict";
import { migrateLegacyState } from "../src/app/persistence.js";

const legacy = {
  widgets: [
    { id: "old-note", type: "note", pos: { x: 120, y: 80 }, size: { w: 360, h: 250 }, content: { content: "Сохранённая заметка" }, opacity: 0.75 },
    { id: "old-link", type: "links", position: { x: 420, y: 80 }, size: { width: 240, height: 140 }, content: { text: "Документы", url: "https://example.com" } },
    { id: "old-corner", type: "note", position: { x: 0, y: 0 }, size: { width: 220, height: 130 }, content: { content: "У верхнего края" } },
  ],
  settings: { wallpaper: "https://example.com/wallpaper.jpg", dockPosition: "left", lockWidgets: true, snapToEdges: false },
  topZIndex: 460,
};
const state = migrateLegacyState(legacy);
assert.equal(state.schemaVersion, 5);
assert.equal(state.widgets.length, 3);
assert.deepEqual(state.widgets[0].position, { x: 120, y: 80 });
assert.deepEqual(state.widgets[1].size, { w: 240, h: 140 });
assert.deepEqual(state.widgets[2].position, { x: 0, y: 0 });
assert.equal(state.widgets[0].config.content, "Сохранённая заметка");
assert.equal(state.widgets[1].type, "link");
assert.equal(state.settings.wallpaper.mode, "image");
assert.equal(state.settings.dock.position, "left");
assert.equal(state.settings.behavior.lockWidgets, true);
assert.equal(state.settings.behavior.snapToGrid, false);
assert.equal(state.ui.nextZIndex, 460);
console.log("migration-smoke: passed");
