import assert from "node:assert/strict";
import { createStore, createInitialState } from "../src/app/store.js";
import { moveWidget, resizeWidget } from "../src/app/geometry.js";

const store = createStore(createInitialState());
let eventCount = 0;
store.subscribe(() => { eventCount += 1; });
store.addWidget({
  id: "clock-1",
  type: "clock",
  position: { x: 20, y: 20 },
  size: { w: 240, h: 160 },
  style: {},
  config: {},
});
store.updateWidget("clock-1", { config: { showSeconds: false } });
assert.equal(store.getState().widgets[0].config.showSeconds, false);
store.updateWidget("clock-1", { collapsed: true }, "widget-collapse");
assert.equal(store.getState().widgets[0].collapsed, true);
store.updateWidget("clock-1", { collapsed: false }, "widget-expand");
assert.equal(store.getState().widgets[0].collapsed, false);
store.bringToFront("clock-1");
assert.ok(store.getState().widgets[0].zIndex > 100);
assert.ok(eventCount >= 3);

const bounds = { w: 800, h: 600 };
const moved = moveWidget({
  startPosition: { x: 20, y: 20 }, delta: { x: 1000, y: 1000 }, size: { w: 240, h: 160 }, bounds,
  settings: { snapToGrid: true, gridSize: 12 },
});
assert.ok(moved.x <= 552 && moved.y <= 432);
const resized = resizeWidget({
  startPosition: moved, startSize: { w: 240, h: 160 }, delta: { x: -1000, y: -1000 }, bounds,
  settings: { snapToGrid: true, gridSize: 12 },
});
assert.equal(resized.size.w, 180);
assert.equal(resized.size.h, 130);

console.log("core-smoke: passed");
