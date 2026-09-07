import assert from "node:assert/strict";
import { createInitialState, createStore } from "../src/app/store.js";
import { createPersistence, loadLayoutState } from "../src/app/persistence.js";

const chromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");
const storage = {};
Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, ...structuredClone(storage) };
        },
        async set(next) {
          Object.assign(storage, structuredClone(next));
        },
      },
    },
  },
});

try {
  const store = createStore(createInitialState());
  const persistence = createPersistence(store, { delay: 0 });
  store.addWidget({
    id: "bookmarks-restart-check",
    type: "bookmarks",
    position: { x: 40, y: 50 },
    size: { w: 370, h: 330 },
    zIndex: 140,
    style: {},
    config: {
      showDomain: false,
      links: [
        { id: "docs", label: "Документы", url: "https://docs.example.com/" },
        { id: "tasks", label: "Задачи", url: "https://tasks.example.com/" },
      ],
    },
  });
  store.addWidget({
    id: "calendar-restart-check",
    type: "calendar",
    position: { x: 420, y: 50 },
    size: { w: 370, h: 430 },
    zIndex: 141,
    style: {},
    config: {
      offset: 2,
    },
  });
  store.addWidget({
    id: "focus-timer-restart-check",
    type: "focus-timer",
    position: { x: 810, y: 50 },
    size: { w: 310, h: 250 },
    zIndex: 142,
    collapsed: true,
    style: {},
    config: {
      totalSeconds: 900,
      remainingSeconds: 721,
      running: true,
      endsAt: Date.now() + 12 * 60 * 1000,
    },
  });
  store.addWidget({
    id: "rss-restart-check",
    type: "rss",
    position: { x: 810, y: 330 },
    size: { w: 360, h: 330 },
    zIndex: 143,
    style: {},
    config: {
      url: "https://example.com/feed.xml",
      limit: 20,
      autoRefresh: false,
      refreshMinutes: 60,
      items: [],
    },
  });
  store.updateSettings({ dock: { position: "left", compact: true } }, "restart-check-settings");
  await persistence.flush();
  persistence.destroy();

  const restarted = await loadLayoutState();
  assert.equal(restarted.migrated, false);
  const bookmarks = restarted.state.widgets.find((widget) => widget.id === "bookmarks-restart-check");
  const calendar = restarted.state.widgets.find((widget) => widget.id === "calendar-restart-check");
  const timer = restarted.state.widgets.find((widget) => widget.id === "focus-timer-restart-check");
  const rss = restarted.state.widgets.find((widget) => widget.id === "rss-restart-check");
  assert.ok(bookmarks, "закладки должны восстановиться после перезапуска");
  assert.ok(calendar, "календарь дня должен восстановиться после перезапуска");
  assert.ok(timer, "свёрнутый таймер должен восстановиться после перезапуска");
  assert.ok(rss, "настройки RSS должны восстановиться после перезапуска");
  assert.deepEqual(bookmarks.config.links, [
    { id: "docs", label: "Документы", url: "https://docs.example.com/" },
    { id: "tasks", label: "Задачи", url: "https://tasks.example.com/" },
  ]);
  assert.equal(bookmarks.config.showDomain, false);
  assert.equal(calendar.config.offset, 2);
  assert.equal(timer.collapsed, true, "свёрнутое состояние таймера должно переживать перезапуск");
  assert.equal(timer.config.totalSeconds, 900);
  assert.equal(timer.config.remainingSeconds, 721);
  assert.equal(timer.config.running, true);
  assert.ok(timer.config.endsAt > Date.now(), "активный таймер должен сохранить будущую контрольную точку");
  assert.equal(rss.config.limit, 20);
  assert.equal(rss.config.autoRefresh, false);
  assert.equal(rss.config.refreshMinutes, 60);
  assert.equal(restarted.state.settings.dock.position, "left");
  assert.equal(restarted.state.settings.dock.compact, true);

  bookmarks.config.links[0].label = "Изменено только в памяти";
  const secondRestart = await loadLayoutState();
  const bookmarksAfterSecondRestart = secondRestart.state.widgets.find((widget) => widget.id === "bookmarks-restart-check");
  assert.equal(bookmarksAfterSecondRestart.config.links[0].label, "Документы", "хранилище должно возвращать независимый снимок состояния");
} finally {
  if (chromeDescriptor) Object.defineProperty(globalThis, "chrome", chromeDescriptor);
  else delete globalThis.chrome;
}

console.log("persistence-restart-smoke: passed");
