import { AUTO_LAYOUT_MIN_SIZE } from "../app/geometry.js";
import { calculateMasonryLayout } from "../app/masonry-layout.js";
import { getMasonryFeedback } from "../app/masonry-feedback.js";
import { animateMasonryReflow } from "./motion.js";

function getBounds(root) {
  const rect = root.getBoundingClientRect();
  return { w: Math.max(320, Math.round(rect.width)), h: Math.max(260, Math.round(rect.height)), rect };
}

function getDockInsets(rootRect, padding) {
  const dock = document.getElementById("dock");
  if (!dock || dock.hidden || dock.classList.contains("is-manually-hidden")) return { top: 0, right: 0, bottom: 0, left: 0 };
  const rect = dock.getBoundingClientRect();
  const position = dock.dataset.position || "bottom";
  const clearance = Math.max(6, Math.round(padding * .5));
  if (position === "top") return { top: Math.max(0, rect.bottom + clearance - rootRect.top - padding), right: 0, bottom: 0, left: 0 };
  if (position === "left") return { top: 0, right: 0, bottom: 0, left: Math.max(0, rect.right + clearance - rootRect.left - padding) };
  if (position === "right") return { top: 0, right: Math.max(0, rootRect.right - rect.left + clearance - padding), bottom: 0, left: 0 };
  return { top: 0, right: 0, bottom: Math.max(0, rootRect.bottom - rect.top + clearance - padding), left: 0 };
}

/** Applies the pure masonry plan to persisted widgets using the current DOM-safe area. */
export function arrangeWidgets(store, workspaceRoot, { onHistoryCommand = () => {}, recordHistory = false } = {}) {
  const bounds = getBounds(workspaceRoot);
  const state = store.getState();
  const padding = Math.min(20, Math.max(10, Math.round(Math.min(bounds.w, bounds.h) * .018)));
  const gap = Math.min(12, Math.max(7, Math.round(padding * .55)));
  const insets = getDockInsets(bounds.rect, padding);
  const plan = calculateMasonryLayout(state.widgets, {
    x: padding + insets.left,
    y: padding + insets.top,
    width: Math.max(AUTO_LAYOUT_MIN_SIZE.w, bounds.w - padding * 2 - insets.left - insets.right),
    height: Math.max(AUTO_LAYOUT_MIN_SIZE.h, bounds.h - padding * 2 - insets.top - insets.bottom),
    gap,
  });
  if (!plan.count) return plan;
  const widgetById = new Map(state.widgets.map((widget) => [widget.id, widget]));
  const patches = plan.placements.map((placement) => {
    const widget = widgetById.get(placement.id);
    if (!widget) return null;
    return {
      id: widget.id,
      before: { position: structuredClone(widget.position), size: structuredClone(widget.size), style: structuredClone(widget.style || {}) },
      after: { position: structuredClone(placement.position), size: structuredClone(placement.size), style: { ...(widget.style || {}), compactLayout: true } },
    };
  }).filter(Boolean).filter((patch) => JSON.stringify(patch.before) !== JSON.stringify(patch.after));
  // ResizeObserver and window.resize may legitimately schedule the same geometry more than once.
  // Avoid an empty animation and an empty store batch when the computed plan is already applied.
  if (!patches.length) return { ...plan, unchanged: true };
  animateMasonryReflow(workspaceRoot, state.settings, () => {
    store.batch((api) => {
      patches.forEach((patch) => api.updateWidget(patch.id, patch.after, "auto-layout-natural-masonry"));
    }, "auto-layout-natural-masonry");
    if (recordHistory && patches.length) {
      onHistoryCommand({
        label: "Авторасстановка мозаики",
        undo: () => store.batch((api) => patches.forEach((patch) => api.updateWidget(patch.id, structuredClone(patch.before), "history-undo")), "history-undo"),
        redo: () => store.batch((api) => patches.forEach((patch) => api.updateWidget(patch.id, structuredClone(patch.after), "history-redo")), "history-redo"),
      });
    }
  });
  return plan;
}

export function mountAutoLayoutTools({ root, store, workspaceRoot, notify, onHistoryCommand = () => {} }) {
  const section = document.createElement("section");
  section.className = "settings-section auto-layout-tools";
  const title = document.createElement("h3");
  title.textContent = "Авторасстановка мозаики";
  const description = document.createElement("p");
  description.textContent = "Разложить карточки как естественную мозаику: разная ширина и высота, без наложений и с заполнением рабочей области до нижней панели.";
  const row = document.createElement("div");
  row.className = "button-row";
  const action = document.createElement("button");
  action.type = "button";
  action.className = "primary-action";
  action.textContent = "Заполнить экран";
  action.addEventListener("click", () => {
    const result = arrangeWidgets(store, workspaceRoot, { onHistoryCommand, recordHistory: true });
    notify?.(getMasonryFeedback(result));
  });
  row.append(action);
  section.append(title, description, row);
  const attach = () => {
    if (root.dataset.settingsTab !== "behavior") { section.remove(); return; }
    const stack = root.querySelector(".settings-tab-stack");
    const sections = [...(stack?.querySelectorAll(":scope > .settings-section") || [])];
    const layoutSection = sections.find((item) => item.querySelector("h3")?.textContent === "Раскладка виджетов");
    if (!stack || !layoutSection || section.parentElement === stack) return;
    stack.insertBefore(section, layoutSection.nextSibling);
  };
  const observer = new MutationObserver(attach);
  observer.observe(root, { childList: true });
  attach();
  return { destroy() { observer.disconnect(); section.remove(); } };
}
