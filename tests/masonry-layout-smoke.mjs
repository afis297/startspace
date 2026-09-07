import assert from "node:assert/strict";
import { autoLayoutMinimumSizeFor } from "../src/app/geometry.js";
import { calculateMasonryLayout } from "../src/app/masonry-layout.js";

const widgetTypes = [
  "clock", "link", "calendar", "countdown", "note", "todo", "bookmarks", "quote",
  "weather", "currency", "translator", "rss", "browser-media", "player", "random",
  "password-generator", "stopwatch", "focus-timer", "calculator", "system-monitor", "search",
  "game", "snake", "rest",
];
const area = { x: 32, y: 24, width: 2400, height: 1800, gap: 14 };

function makeWidgets(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `masonry-${count}-${index + 1}`,
    type: widgetTypes[index % widgetTypes.length],
    position: { x: 0, y: 0 },
    size: { w: 320, h: 240 },
    zIndex: index + 1,
    style: {},
    config: {},
  }));
}

function overlap(left, right) {
  return left.position.x < right.position.x + right.size.w
    && left.position.x + left.size.w > right.position.x
    && left.position.y < right.position.y + right.size.h
    && left.position.y + left.size.h > right.position.y;
}

for (let count = 1; count <= 24; count += 1) {
  const widgets = makeWidgets(count);
  const first = calculateMasonryLayout(widgets, area);
  const second = calculateMasonryLayout(widgets, area);
  assert.deepEqual(second, first, `Мозаика из ${count} карточек должна быть детерминированной.`);
  assert.equal(first.count, count);
  assert.equal(first.unplacedCount, 0, `Все ${count} карточек должны помещаться в тестовой рабочей области.`);
  assert.equal(first.placements.length, count, `Мозаика из ${count} карточек должна вернуть все размещения.`);

  for (const placement of first.placements) {
    const widget = widgets.find((item) => item.id === placement.id);
    const minimum = autoLayoutMinimumSizeFor(widget.type, null, count);
    assert.ok(placement.size.w >= minimum.w, `${placement.id} не должен быть уже минимальной ширины.`);
    assert.ok(placement.size.h >= minimum.h, `${placement.id} не должен быть ниже минимальной высоты.`);
    assert.ok(placement.position.x >= area.x && placement.position.y >= area.y, `${placement.id} не должен выходить за верхнюю или левую границу.`);
    assert.ok(placement.position.x + placement.size.w <= area.x + area.width, `${placement.id} не должен выходить за правую границу.`);
    assert.ok(placement.position.y + placement.size.h <= area.y + area.height, `${placement.id} не должен выходить за нижнюю границу.`);
  }

  for (let left = 0; left < first.placements.length; left += 1) {
    for (let right = left + 1; right < first.placements.length; right += 1) {
      assert.equal(overlap(first.placements[left], first.placements[right]), false, `Карточки ${first.placements[left].id} и ${first.placements[right].id} не должны пересекаться.`);
    }
  }
}

console.log("masonry-layout-smoke: passed (1–24 widgets)");
