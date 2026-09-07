import { AUTO_LAYOUT_MIN_SIZE, autoLayoutMinimumSizeFor } from "./geometry.js";

const NATURAL_HEIGHTS = Object.freeze({
  clock: 165, link: 140, search: 116, stopwatch: 180, quote: 190, game: 280, snake: 300,
  calendar: 255, weather: 205, currency: 205, translator: 285, note: 235, rss: 285,
  "browser-media": 280, player: 290, calculator: 295, "focus-timer": 285, countdown: 185,
  todo: 260, random: 180, "password-generator": 210, rest: 210, "system-monitor": 215,
});

const HEIGHT_STRETCH = Object.freeze({
  search: .5, link: .58, currency: .68, clock: .72, stopwatch: .78, countdown: .8,
  weather: .88, calendar: .94, quote: .96, note: 1.02, timer: 1.04, "focus-timer": 1.1,
  calculator: 1.12, game: 1.14, translator: 1.16, "browser-media": 1.16, player: 1.18,
  rss: 1.06, todo: 1.08, snake: 1.15,
});

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seededRandom(seed) {
  let state = hash(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function minimumColumnWidth(widgets, count) {
  return Math.max(AUTO_LAYOUT_MIN_SIZE.w, ...widgets.map((widget) => autoLayoutMinimumSizeFor(widget.type, null, count).w));
}

function maximumColumns(width, gap, minWidth) {
  return Math.max(1, Math.min(6, Math.floor((width + gap) / (minWidth + gap))));
}

function chooseColumns(count, width, gap, minWidth) {
  const maximum = maximumColumns(width, gap, minWidth);
  const intended = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : count <= 15 ? 4 : count <= 20 ? 5 : 6;
  return Math.max(1, Math.min(maximum, intended));
}

function buildColumnWidths(columns, usableWidth, gap, minWidth, random) {
  if (columns === 1) return [usableWidth];
  const available = usableWidth - gap * (columns - 1);
  const baseline = Math.max(minWidth, Math.floor(available / columns));
  const slack = Math.max(0, available - baseline * columns);
  const rhythm = shuffle([0.76, 0.88, 0.96, 1.06, 1.16, 1.24], random).slice(0, columns);
  const rhythmTotal = rhythm.reduce((sum, value) => sum + value, 0) || 1;
  let remainder = slack;
  return rhythm.map((weight, index) => {
    const extra = index === rhythm.length - 1 ? remainder : Math.min(remainder, Math.round(slack * weight / rhythmTotal));
    remainder -= extra;
    return baseline + extra;
  });
}

function densityFor(count) {
  if (count <= 10) return 1;
  if (count <= 16) return .94;
  if (count <= 20) return .87;
  return .77;
}

function naturalCardHeight(widget, count, random) {
  const compact = autoLayoutMinimumSizeFor(widget.type, null, count);
  const base = NATURAL_HEIGHTS[widget.type] || 190;
  const variation = .93 + random() * .14;
  return Math.max(compact.h, Math.round(base * densityFor(count) * variation));
}

function buildLanes(widgets, columns, random) {
  const cards = shuffle(widgets, random).map((widget) => ({ widget, height: naturalCardHeight(widget, widgets.length, random) }));
  const lanes = Array.from({ length: columns }, () => ({ cards: [], footprint: 0 }));
  const maximumCards = Math.ceil(cards.length / columns);
  cards.sort((left, right) => right.height - left.height || String(left.widget.id).localeCompare(String(right.widget.id))).forEach((card) => {
    const candidates = lanes.filter((lane) => lane.cards.length < maximumCards);
    const ranked = [...candidates].sort((left, right) => left.footprint - right.footprint || left.cards.length - right.cards.length);
    const lane = random() < .09 && ranked.length > 1 ? ranked[1] : ranked[0];
    lane.cards.push(card);
    lane.footprint += card.height;
  });
  return lanes;
}

function distributeExtraHeight(lane, heights, extra) {
  if (extra <= 0 || !heights.length) return heights;
  const weights = lane.cards.map((card, index) => Math.max(1, heights[index] * (HEIGHT_STRETCH[card.widget.type] || 1)));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let remainder = extra;
  return heights.map((height, index) => {
    const gain = index === heights.length - 1 ? remainder : Math.min(remainder, Math.floor(extra * weights[index] / total));
    remainder -= gain;
    return height + gain;
  });
}

function fitLaneHeights(lane, usableHeight, gap, count) {
  const available = Math.max(1, usableHeight - gap * Math.max(0, lane.cards.length - 1));
  const desired = lane.cards.map((card) => card.height);
  const desiredTotal = desired.reduce((sum, height) => sum + height, 0);
  if (desiredTotal <= available) return distributeExtraHeight(lane, desired, available - desiredTotal);
  const minima = lane.cards.map((card) => autoLayoutMinimumSizeFor(card.widget.type, null, count).h);
  const minimumTotal = minima.reduce((sum, height) => sum + height, 0);
  // Never return a size below the compact-layout minimum: CSS would expand it later and create an overlap.
  if (minimumTotal >= available) return minima;
  const flexible = desiredTotal - minimumTotal;
  const room = available - minimumTotal;
  const compressed = desired.map((height, index) => Math.max(minima[index], Math.floor(minima[index] + (height - minima[index]) * room / flexible)));
  const used = compressed.reduce((sum, height) => sum + height, 0);
  return distributeExtraHeight(lane, compressed, available - used);
}

function lanesFitHeight(lanes, usableHeight, gap, count) {
  return lanes.every((lane) => {
    const minimumHeight = lane.cards.reduce((sum, card) => sum + autoLayoutMinimumSizeFor(card.widget.type, null, count).h, 0);
    const gaps = gap * Math.max(0, lane.cards.length - 1);
    return minimumHeight + gaps <= usableHeight;
  });
}

function rectanglesOverlap(left, right, gap = 0) {
  return left.x < right.x + right.w + gap
    && left.x + left.w + gap > right.x
    && left.y < right.y + right.h + gap
    && left.y + left.h + gap > right.y;
}

function pinnedRect(widget) {
  return {
    id: widget.id,
    x: Math.round(Number(widget.position?.x) || 0),
    y: Math.round(Number(widget.position?.y) || 0),
    w: Math.max(AUTO_LAYOUT_MIN_SIZE.w, Math.round(Number(widget.size?.w) || AUTO_LAYOUT_MIN_SIZE.w)),
    h: Math.max(AUTO_LAYOUT_MIN_SIZE.h, Math.round(Number(widget.size?.h) || AUTO_LAYOUT_MIN_SIZE.h)),
  };
}

function findPinnedAwarePosition(card, columns, area, gap, occupied) {
  const step = Math.max(4, Math.round(gap) || 4);
  const initialY = Math.round(Number(area.y) || 0);
  const maxY = initialY + Math.max(0, Math.round(Number(area.height) || 0) - card.h);
  for (let y = initialY; y <= maxY; y += step) {
    for (const column of columns) {
      const candidate = { id: card.widget.id, x: column.x, y, w: column.w, h: card.h };
      if (occupied.every((rect) => !rectanglesOverlap(candidate, rect, gap))) return candidate;
    }
  }
  return null;
}

function columnsFor(widths, area, gap) {
  let x = Math.round(Number(area.x) || 0);
  return widths.map((width) => {
    const column = { x, w: width };
    x += width + gap;
    return column;
  });
}

function comparePinnedCards(left, right, seed) {
  const heightDifference = right.h - left.h;
  if (heightDifference) return heightDifference;
  const rankDifference = hash(`${seed}:${left.widget.id}`) - hash(`${seed}:${right.widget.id}`);
  return rankDifference || String(left.widget.id).localeCompare(String(right.widget.id));
}

function packAroundPinned(pinned, movable, area, columns, minWidth, random, compact) {
  const gap = Math.max(0, Number(area.gap) || 0);
  const count = movable.length + pinned.length;
  const widths = buildColumnWidths(columns, Math.max(AUTO_LAYOUT_MIN_SIZE.w, Math.round(Number(area.width) || 0)), gap, minWidth, random);
  const cards = movable.map((widget) => ({
    widget,
    h: compact ? autoLayoutMinimumSizeFor(widget.type, null, count).h : naturalCardHeight(widget, count, random),
  })).sort((left, right) => comparePinnedCards(left, right, `${columns}:${count}`));
  const occupied = pinned.map(pinnedRect);
  const placements = [];
  const layoutColumns = columnsFor(widths, area, gap);
  for (const card of cards) {
    const placement = findPinnedAwarePosition(card, layoutColumns, area, gap, occupied);
    if (!placement) return null;
    occupied.push(placement);
    placements.push({ id: placement.id, position: { x: placement.x, y: placement.y }, size: { w: placement.w, h: placement.h } });
  }
  return placements;
}

function calculatePinnedMasonryLayout(pinned, movable, area, random) {
  const gap = Math.max(0, Number(area.gap) || 0);
  const width = Math.max(AUTO_LAYOUT_MIN_SIZE.w, Math.round(Number(area.width) || 0));
  const count = movable.length + pinned.length;
  const minWidth = minimumColumnWidth(movable, count);
  const initialColumns = chooseColumns(movable.length, width, gap, minWidth);
  const finalColumns = maximumColumns(width, gap, minWidth);
  for (const compact of [false, true]) {
    for (let columns = initialColumns; columns <= finalColumns; columns += 1) {
      const placements = packAroundPinned(pinned, movable, area, columns, minWidth, random, compact);
      if (placements) return { count, columns, placements, pinnedCount: pinned.length, unplacedCount: 0 };
    }
  }
  return { count, columns: initialColumns, placements: [], pinnedCount: pinned.length, unplacedCount: movable.length };
}

function layoutSeed(widgets, area) {
  const ids = widgets.map((widget) => `${widget.id}:${widget.type}:${widget.pinned ? 1 : 0}`).join("|");
  return `${ids}@${area.width}x${area.height}:${area.gap}`;
}

/**
 * Computes a complete widget mosaic without reading or writing the DOM.
 * The caller owns persistence and supplies the safe placement area.
 */
export function calculateMasonryLayout(widgets, area, random = null) {
  const visible = widgets.filter((widget) => !widget.collapsed);
  if (!visible.length) return { count: 0, columns: 0, placements: [], pinnedCount: 0, unplacedCount: 0 };
  const randomizer = typeof random === "function" ? random : seededRandom(layoutSeed(visible, area));
  const pinned = visible.filter((widget) => widget.pinned);
  const movable = visible.filter((widget) => !widget.pinned);
  if (pinned.length) return calculatePinnedMasonryLayout(pinned, movable, area, randomizer);
  const gap = Math.max(0, Number(area.gap) || 0);
  const width = Math.max(AUTO_LAYOUT_MIN_SIZE.w, Math.round(Number(area.width) || 0));
  const height = Math.max(AUTO_LAYOUT_MIN_SIZE.h, Math.round(Number(area.height) || 0));
  const minWidth = minimumColumnWidth(visible, visible.length);
  const initialColumns = chooseColumns(visible.length, width, gap, minWidth);
  const finalColumns = maximumColumns(width, gap, minWidth);
  for (let columns = initialColumns; columns <= finalColumns; columns += 1) {
    const lanes = buildLanes(visible, columns, randomizer);
    if (!lanesFitHeight(lanes, height, gap, visible.length)) continue;
    const columnWidths = buildColumnWidths(columns, width, gap, minWidth, randomizer);
    const placements = [];
    let x = Math.round(Number(area.x) || 0);
    lanes.forEach((lane, column) => {
      const cardHeights = fitLaneHeights(lane, height, gap, visible.length);
      let y = Math.round(Number(area.y) || 0);
      lane.cards.forEach((card, index) => {
        placements.push({ id: card.widget.id, position: { x, y }, size: { w: columnWidths[column], h: cardHeights[index] } });
        y += cardHeights[index] + gap;
      });
      x += columnWidths[column] + gap;
    });
    return { count: visible.length, columns, placements, pinnedCount: 0, unplacedCount: 0 };
  }
  return { count: visible.length, columns: initialColumns, placements: [], pinnedCount: 0, unplacedCount: visible.length };
}
