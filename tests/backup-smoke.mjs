import assert from "node:assert/strict";
import { createBackupPayload, createLayoutPayload, createThemePackPayload, createWidgetPayload, readLayoutFile } from "../src/app/backup-service.js";
import { createInitialState } from "../src/app/store.js";

const state = createInitialState();
state.widgets.push({ id: "note-1", type: "note", position: { x: 20, y: 20 }, size: { w: 280, h: 180 }, zIndex: 101, style: {}, config: { content: "Проверка" } });
const backup = createBackupPayload(state);
assert.equal(backup.format, "my-free-layout-tab-backup");
assert.equal(backup.version, 1);
assert.equal(backup.state.widgets[0].config.content, "Проверка");
assert.ok(Number.isFinite(Date.parse(backup.createdAt)));

const layout = createLayoutPayload(state);
assert.equal(layout.format, "my-free-layout-tab-layout");
assert.equal(layout.version, 1);
assert.equal(layout.layout.widgets[0].config.content, "Проверка");
assert.notEqual(layout.layout, state);
assert.notEqual(layout.layout.widgets[0], state.widgets[0]);
const importedLayout = await readLayoutFile(new Blob([JSON.stringify(layout)], { type: "application/json" }));
const importedLegacyBackup = await readLayoutFile(new Blob([JSON.stringify(backup)], { type: "application/json" }));
assert.equal(importedLayout.widgets[0].config.content, "Проверка");
assert.equal(importedLegacyBackup.widgets[0].config.content, "Проверка");
await assert.rejects(
  () => readLayoutFile(new Blob([JSON.stringify({ format: "my-free-layout-tab-layout", version: 1, layout: { widgets: [] } })], { type: "application/json" })),
  /не является макетом/,
  "неполный макет без настроек должен быть отклонён",
);
await assert.rejects(
  () => readLayoutFile(new Blob([JSON.stringify({ format: "unknown-layout", version: 1, layout: state })], { type: "application/json" })),
  /не является макетом/,
  "макет неизвестного формата должен быть отклонён",
);

const widget = createWidgetPayload(state.widgets[0]);
assert.equal(widget.format, "my-free-layout-tab-widget");
assert.equal(widget.version, 1);
assert.equal(widget.widget.config.content, "Проверка");
assert.notEqual(widget.widget, state.widgets[0]);

const theme = createThemePackPayload({ themeId: "ocean", customTheme: { "--accent": "#22aaff" }, wallpaper: { mode: "solid", value: "#112233" } });
assert.equal(theme.format, "my-free-layout-tab-theme");
assert.equal(theme.version, 1);
assert.equal(theme.theme.themeId, "ocean");
assert.equal(theme.theme.customTheme["--accent"], "#22aaff");
console.log("backup-smoke: passed");
