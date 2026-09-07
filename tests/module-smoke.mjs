import assert from "node:assert/strict";
import { createWidgetRegistry } from "../src/widgets/registry.js";
import { widgetDefinitions } from "../src/widgets/definitions.js";
import { getPreset, themePresets } from "../src/themes/presets.js";

const expected = ["bookmarks", "browser-media", "calculator", "calendar", "clock", "countdown", "currency", "focus-timer", "game", "link", "note", "password-generator", "player", "quote", "random", "rest", "rss", "search", "snake", "system-monitor", "timer", "todo", "translator", "weather"];
const registry = createWidgetRegistry();
widgetDefinitions.forEach((definition) => registry.register(definition));
assert.deepEqual(registry.list().map((definition) => definition.type).sort(), expected.sort());
expected.forEach((type) => {
  const widget = registry.createWidget(type);
  assert.equal(widget.type, type);
  assert.ok(widget.id.startsWith(`${type}-`));
  assert.ok(widget.size.w >= 160);
});
assert.equal(themePresets.length, 14);
assert.equal(getPreset("green-console").colors["--accent"], "#00ff41");
assert.equal(getPreset("unknown").id, "midnight");

const contracts = createWidgetRegistry();
assert.throws(() => contracts.register({ type: "broken", title: "", create() {}, update() {}, defaultSize: { w: 220, h: 140 } }), /заголовок/);
assert.throws(() => contracts.register({ type: "bad-size", title: "Неверный", create() {}, update() {}, defaultSize: { w: 0, h: 140 } }), /defaultSize/);
contracts.register({
  type: "contract-test",
  title: "Контракт",
  category: "Тест",
  create() {},
  update() {},
  defaultSize: { w: 220, h: 140 },
  defaultConfig: { nested: { value: 1 } },
  properties: [{ key: "mode", label: "Режим", type: "select", options: [{ value: "one", label: "Один" }] }],
});
const contractDefinition = contracts.get("contract-test");
assert.equal(Object.isFrozen(contractDefinition), true);
assert.equal(Object.isFrozen(contractDefinition.properties), true);
assert.equal(Object.isFrozen(contractDefinition.properties[0]), true);
const firstContract = contracts.createWidget("contract-test", { position: { x: 0, y: 0 }, zIndex: 0 });
const secondContract = contracts.createWidget("contract-test");
firstContract.config.nested.value = 2;
assert.deepEqual(firstContract.position, { x: 0, y: 0 });
assert.equal(firstContract.zIndex, 0);
assert.equal(secondContract.config.nested.value, 1);
console.log("module-smoke: passed");
