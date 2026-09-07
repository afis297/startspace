import { clear, element } from "./dom.js";
import { getWorkspaceBounds, nextWidgetPosition } from "../app/geometry.js";
import { permissionDeniedMessage, requestWidgetPermissions } from "../services/permissions.js";
import { createLineIcon, iconNameForWidget } from "./icons.js";
import { mountFloatingPanel } from "./floating-panel.js";
import { animateDockEnter } from "./motion.js";
import { arrangeWidgets } from "./auto-layout-ui.js";
import { getMasonryFeedback } from "../app/masonry-feedback.js";
import { STANDARD_WIDGET_PACKS, uniquePackTypes } from "./widget-packs.js";
import { getCollapsedSummary } from "./collapsed-summary.js";

export function mountDock({ root, store, registry, workspaceRoot, notify, onOpenSettings, onHistoryCommand = () => {} }) {
  const picker = element("section", { className: "widget-picker", attrs: { "aria-label": "Каталог виджетов", hidden: "" } });
  const collapsed = element("div", { className: "dock-collapsed", attrs: { "aria-label": "Свернутые виджеты" }, hidden: "" });
  let dockOpen = false;
  let closeTimer = 0;
  const clearDockClose = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; } };
  const reveal = element("button", { className: "dock-reveal", attrs: { type: "button", hidden: "", title: "Выдвинуть нижнюю панель", "aria-label": "Выдвинуть нижнюю панель" } });
  const iconButton = (name, className, title, onClick) => element("button", { className, title, attrs: { type: "button", "aria-label": title }, on: { click: onClick } }, [createLineIcon(name, { size: 17 })]);

  const renderPicker = () => {
    clear(picker);
    const header = element("div", { className: "picker-heading", attrs: { "data-role": "panel-drag", title: "Перетащить каталог" } }, [element("h2", { text: "Добавить виджет" }), element("span", { className: "panel-drag-hint", text: "Переместить" }), iconButton("close", "panel-close", "Закрыть каталог", () => { picker.hidden = true; })]);
    picker.append(header);

    const addPack = async (pack, trigger) => {
      const types = uniquePackTypes(pack);
      const missing = types.find((type) => !registry.get(type));
      if (missing) {
        notify?.({ title: "Набор недоступен", message: `Не найден виджет: ${missing}.`, type: "warning" });
        return;
      }
      trigger.disabled = true;
      try {
        for (const type of types) {
          const granted = await requestWidgetPermissions(type);
          if (!granted) {
            notify?.({ title: "Набор не добавлен", message: permissionDeniedMessage(type), type: "warning" });
            return;
          }
        }
        const state = store.getState();
        const bounds = getWorkspaceBounds(workspaceRoot);
        const createdIds = [];
        store.batch((api) => {
          types.forEach((type, index) => {
            const widget = registry.createWidget(type, {
              position: nextWidgetPosition(state.widgets.length + index, bounds),
              zIndex: state.ui.nextZIndex + index + 1,
            });
            createdIds.push(api.addWidget(widget, "widget-pack-add").id);
          });
        }, "widget-pack-add");
        const layout = arrangeWidgets(store, workspaceRoot);
        const snapshot = store.getState().widgets.filter((widget) => createdIds.includes(widget.id)).map((widget) => structuredClone(widget));
        onHistoryCommand({
          label: `Добавление набора «${pack.title}»`,
          undo: () => store.batch((api) => snapshot.forEach((widget) => api.removeWidget(widget.id, "history-undo")), "history-undo"),
          redo: () => store.batch((api) => snapshot.forEach((widget) => api.addWidget(structuredClone(widget), "history-redo")), "history-redo"),
        });
        picker.hidden = true;
        notify?.(getMasonryFeedback(layout, { addedCount: types.length }));
      } finally {
        trigger.disabled = false;
      }
    };

    const packs = element("section", { className: "picker-section picker-pack-section" }, [element("h3", { text: "Готовые наборы" })]);
    const packGrid = element("div", { className: "widget-pack-grid" });
    STANDARD_WIDGET_PACKS.forEach((pack) => {
      const types = uniquePackTypes(pack);
      const card = element("button", { className: "widget-pack-choice", attrs: { type: "button" } }, [
        element("span", { className: "widget-choice-icon", attrs: { "aria-hidden": "true" } }, [createLineIcon(pack.icon, { size: 19 })]),
        element("span", { className: "widget-pack-copy" }, [
          element("strong", { text: pack.title }),
          element("small", { text: pack.description }),
        ]),
        element("span", { className: "widget-pack-count", text: String(types.length) }),
      ]);
      card.addEventListener("click", () => { addPack(pack, card); });
      packGrid.append(card);
    });
    packs.append(packGrid);
    picker.append(packs);

    const groups = new Map();
    registry.list().forEach((definition) => {
      if (!groups.has(definition.category)) groups.set(definition.category, []);
      groups.get(definition.category).push(definition);
    });
    groups.forEach((definitions, category) => {
      const section = element("section", { className: "picker-section" }, [element("h3", { text: category })]);
      const grid = element("div", { className: "picker-grid" });
      definitions.forEach((definition) => {
        const card = element("button", { className: "widget-choice", attrs: { type: "button" } }, [element("span", { className: "widget-choice-icon", attrs: { "aria-hidden": "true" } }, [createLineIcon(iconNameForWidget(definition.type), { size: 19 })]), element("strong", { text: definition.title })]);
        card.addEventListener("click", async () => {
          const granted = await requestWidgetPermissions(definition.type);
          if (!granted) {
            notify?.({
              title: "Доступ не предоставлен",
              message: permissionDeniedMessage(definition.type),
              type: "warning",
            });
            return;
          }
          const state = store.getState();
          const widget = registry.createWidget(definition.type, {
            position: nextWidgetPosition(state.widgets.length, getWorkspaceBounds(workspaceRoot)),
            zIndex: state.ui.nextZIndex + 1,
          });
          const created = store.addWidget(widget);
          const snapshot = structuredClone(created);
          onHistoryCommand({
            label: "Добавление виджета",
            undo: () => store.removeWidget(snapshot.id, "history-undo"),
            redo: () => store.addWidget(structuredClone(snapshot), "history-redo"),
          });
          picker.hidden = true;
        });
        grid.append(card);
      });
      section.append(grid);
      picker.append(section);
    });
    picker.append(element("button", { className: "panel-resize-handle", title: "Изменить размер каталога", attrs: { type: "button", "data-action": "resize-panel", "aria-label": "Изменить размер каталога" } }, [createLineIcon("resize", { size: 15 })]));
  };

  const renderCollapsed = (state = store.getState()) => {
    const widgets = state.widgets.filter((widget) => widget.collapsed);
    collapsed.hidden = widgets.length === 0;
    clear(collapsed);
    widgets.forEach((widget) => {
      const definition = registry.get(widget.type);
      const title = widget.title || definition.title;
      const summary = getCollapsedSummary(widget);
      const button = element("button", {
        className: `dock-button dock-collapsed-item${summary ? " has-summary" : ""}`,
        title: summary ? `Вернуть: ${title} — ${summary}` : `Вернуть: ${title}`,
        attrs: { type: "button", "aria-label": summary ? `Вернуть виджет ${title}: ${summary}` : `Вернуть виджет ${title}` },
      }, [createLineIcon(iconNameForWidget(definition.type), { size: 16 })]);
      if (summary) button.append(element("span", { className: "dock-collapsed-summary", text: summary }));
      button.addEventListener("click", () => {
        store.updateWidget(widget.id, { collapsed: false }, "widget-expand");
        store.bringToFront(widget.id, "widget-expand-focus");
      });
      collapsed.append(button);
    });
  };

  const add = iconButton("add", "dock-button dock-add", "Добавить виджет", () => {
    const opening = picker.hidden;
    if (opening) {
      renderPicker();
      floatingPicker.apply();
    }
    picker.hidden = !opening;
    add.setAttribute("aria-expanded", String(opening));
  });
  const settings = iconButton("settings", "dock-button dock-settings", "Настройки", onOpenSettings);
  const syncDockVisibility = (state = store.getState()) => {
    const dock = state.settings.dock || {};
    const position = dock.position || "bottom";
    const manuallyHidden = Boolean(dock.hidden);
    if (!manuallyHidden) dockOpen = false;
    root.dataset.position = position;
    root.hidden = false;
    root.classList.toggle("is-manually-hidden", manuallyHidden && !dockOpen);
    root.classList.toggle("is-dock-open", manuallyHidden && dockOpen);
    reveal.hidden = !manuallyHidden || dockOpen;
    reveal.dataset.position = position;
    clear(reveal);
    reveal.append(createLineIcon(position === "top" ? "chevronDown" : position === "left" ? "chevronRight" : position === "right" ? "chevronLeft" : "chevronUp", { size: 15 }));
  };
  const openDock = () => {
    if (!store.getState().settings.dock?.hidden) return;
    clearDockClose();
    dockOpen = true;
    syncDockVisibility();
    window.setTimeout(() => {
      if (!root.matches(":hover") && !root.contains(document.activeElement)) queueDockClose();
    }, 420);
  };
  const queueDockClose = () => {
    clearDockClose();
    if (!store.getState().settings.dock?.hidden) return;
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      dockOpen = false;
      syncDockVisibility();
    }, 260);
  };
  const openDockOnHover = () => {
    const dock = store.getState().settings.dock || {};
    if (dock.hidden && dock.autoReveal) openDock();
  };
  reveal.addEventListener("click", openDock);
  reveal.addEventListener("pointerenter", openDockOnHover);
  root.addEventListener("pointerenter", clearDockClose);
  root.addEventListener("pointerleave", queueDockClose);
  root.addEventListener("focusin", clearDockClose);
  root.addEventListener("focusout", () => window.setTimeout(() => { if (!root.contains(document.activeElement)) queueDockClose(); }, 0));
  root.append(collapsed, add, settings);
  // Dock uses CSS transforms for its position; a fixed child of such an element can be laid out off-screen.
  // The picker is therefore portalled to document.body like other floating controls.
  document.body.append(picker, reveal);
  const floatingPicker = mountFloatingPanel({ root: picker, store, key: "widgetPicker" });

  const updateDock = (state) => {
    const dock = state.settings.dock || {};
    root.classList.toggle("is-compact", Boolean(dock.compact));
    syncDockVisibility(state);
    renderCollapsed(state);
  };
  const unsubscribe = store.subscribe((state) => updateDock(state));
  updateDock(store.getState());
  animateDockEnter(root, store.getState().settings);
  return { destroy() { clearDockClose(); unsubscribe(); floatingPicker.destroy(); picker.remove(); reveal.remove(); clear(root); } };
}
