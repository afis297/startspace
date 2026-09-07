export const MIN_WIDGET_SIZE = Object.freeze({ w: 180, h: 130 });
export const MAX_WIDGET_SIZE = Object.freeze({ w: 1200, h: 900 });
export const AUTO_LAYOUT_MIN_SIZE = Object.freeze({ w: 172, h: 80 });
export const WIDGET_MIN_SIZES = Object.freeze({
  clock: { w: 210, h: 132 }, note: { w: 230, h: 170 }, todo: { w: 256, h: 220 }, link: { w: 210, h: 120 }, quote: { w: 240, h: 160 },
  "browser-media": { w: 280, h: 265 }, player: { w: 290, h: 280 }, random: { w: 220, h: 160 }, "password-generator": { w: 260, h: 205 },
  calendar: { w: 280, h: 250 }, countdown: { w: 240, h: 140 }, timer: { w: 220, h: 145 }, "focus-timer": { w: 255, h: 320 },
  calculator: { w: 250, h: 300 }, game: { w: 260, h: 310 }, snake: { w: 280, h: 320 }, weather: { w: 240, h: 190 },
  currency: { w: 250, h: 185 }, translator: { w: 280, h: 250 }, rest: { w: 245, h: 210 }, search: { w: 260, h: 120 },
  rss: { w: 280, h: 220 }, "system-monitor": { w: 270, h: 210 },
});

const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function getWorkspaceBounds(element) {
  const rect = element.getBoundingClientRect();
  return { w: Math.max(0, rect.width), h: Math.max(0, rect.height) };
}

export function minimumSizeFor(type, definitionMinSize) {
  const typed = WIDGET_MIN_SIZES[type] || MIN_WIDGET_SIZE;
  return {
    w: Math.max(MIN_WIDGET_SIZE.w, typed.w, number(definitionMinSize?.w, 0)),
    h: Math.max(MIN_WIDGET_SIZE.h, typed.h, number(definitionMinSize?.h, 0)),
  };
}

export function autoLayoutMinimumSizeFor(type, definitionMinSize, count = 1) {
  const normal = minimumSizeFor(type, definitionMinSize);
  const dense = count > 18 ? { w: 172, h: 80 } : count > 12 ? { w: 186, h: 102 } : { w: 202, h: 116 };
  return {
    w: Math.min(normal.w, Math.max(AUTO_LAYOUT_MIN_SIZE.w, dense.w)),
    h: Math.min(normal.h, Math.max(AUTO_LAYOUT_MIN_SIZE.h, dense.h)),
  };
}

export function normalizeSize(size, bounds = MAX_WIDGET_SIZE, minSize = MIN_WIDGET_SIZE) {
  const minW = Math.max(MIN_WIDGET_SIZE.w, number(minSize?.w, MIN_WIDGET_SIZE.w));
  const minH = Math.max(MIN_WIDGET_SIZE.h, number(minSize?.h, MIN_WIDGET_SIZE.h));
  const maxW = Math.max(minW, Math.min(MAX_WIDGET_SIZE.w, bounds.w || MAX_WIDGET_SIZE.w));
  const maxH = Math.max(minH, Math.min(MAX_WIDGET_SIZE.h, bounds.h || MAX_WIDGET_SIZE.h));
  return {
    w: Math.round(Math.min(maxW, Math.max(minW, number(size?.w, 280)))),
    h: Math.round(Math.min(maxH, Math.max(minH, number(size?.h, 180)))),
  };
}

export function clampPosition(position, size, bounds, padding = 8) {
  const maxX = Math.max(padding, bounds.w - size.w - padding);
  const maxY = Math.max(padding, bounds.h - size.h - padding);
  return {
    x: Math.round(Math.min(maxX, Math.max(padding, number(position?.x, padding)))),
    y: Math.round(Math.min(maxY, Math.max(padding, number(position?.y, padding)))),
  };
}

export function snap(value, gridSize, enabled) {
  if (!enabled || !Number.isFinite(gridSize) || gridSize < 2) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

export function moveWidget({ startPosition, delta, size, bounds, settings }) {
  const x = snap(number(startPosition.x, 0) + number(delta.x, 0), settings.gridSize, settings.snapToGrid);
  const y = snap(number(startPosition.y, 0) + number(delta.y, 0), settings.gridSize, settings.snapToGrid);
  return clampPosition({ x, y }, size, bounds);
}

export function resizeWidget({ startPosition, startSize, delta, bounds, settings, minSize = MIN_WIDGET_SIZE }) {
  const size = normalizeSize({
    w: snap(number(startSize.w, 280) + number(delta.x, 0), settings.gridSize, settings.snapToGrid),
    h: snap(number(startSize.h, 180) + number(delta.y, 0), settings.gridSize, settings.snapToGrid),
  }, bounds, minSize);
  return { size, position: clampPosition(startPosition, size, bounds) };
}

export function nextWidgetPosition(count, bounds) {
  const column = count % 5;
  const row = Math.floor(count / 5) % 4;
  const position = { x: 48 + column * 34, y: 48 + row * 34 };
  return clampPosition(position, { w: 280, h: 180 }, bounds);
}
