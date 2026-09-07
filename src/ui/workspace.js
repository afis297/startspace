import { element, clear } from "./dom.js";
import { animateWidgetEnter, animateWidgetExit, animateWorkspaceEnter, animateWorkspaceStart } from "./motion.js";
import { autoLayoutMinimumSizeFor, getWorkspaceBounds, minimumSizeFor, moveWidget, resizeWidget } from "../app/geometry.js";
import { createLineIcon } from "./icons.js";
import { arrangeWidgets } from "./auto-layout-ui.js";

const surfaceModes = new Set(["solid", "soft", "glass", "acrylic", "clear", "custom"]);

function materialAlpha(mode, value) {
  const parsed = Number(value);
  const opacity = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
  return mode === "solid" ? 1 : opacity;
}

function widgetAction(name, title, action) {
  return element("button", { className: "widget-action", title, attrs: { type: "button", "data-action": action, "aria-label": title } }, [createLineIcon(name, { size: 14 })]);
}

export function mountWorkspace({ root, store, registry, context, onOpenProperties, notify = () => {}, onHistoryCommand = () => {} }) {
  const entries = new Map();
  let active = null;
  let lastLockNotice = 0;
  let frame = null;
  let adaptiveLayoutFrame = null;
  const recordWidgetPatch = (id, before, after, label) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    onHistoryCommand({
      label,
      undo: () => store.updateWidget(id, structuredClone(before), "history-undo"),
      redo: () => store.updateWidget(id, structuredClone(after), "history-redo"),
    });
  };

  const hasCompleteAutoMosaic = (state = store.getState()) => {
    const visible = state.widgets.filter((widget) => !widget.collapsed);
    return visible.length > 0 && visible.every((widget) => widget.style?.compactLayout === true);
  };
  const canAutoAdjustMosaic = (state = store.getState()) => state.settings?.behavior?.autoAdjustMosaic !== false;
  const scheduleAdaptiveMasonry = () => {
    cancelAnimationFrame(adaptiveLayoutFrame);
    adaptiveLayoutFrame = requestAnimationFrame(() => {
      adaptiveLayoutFrame = null;
      if (!active && canAutoAdjustMosaic() && hasCompleteAutoMosaic()) arrangeWidgets(store, root);
    });
  };

  const renderWidget = (widget) => {
    const definition = registry.get(widget.type);
    let entry = entries.get(widget.id);
    if (!entry) {
      const body = element("div", { className: "widget-body" });
      const scaleLayer = element("div", { className: "widget-scale-layer" });
      const title = element("span", { className: "widget-title" });
      const article = element("article", { className: "desktop-widget", dataset: { widgetId: widget.id, widgetType: widget.type, flipId: widget.id } }, [
        element("header", { className: "widget-header", attrs: { "data-role": "drag-region" } }, [
          element("span", { className: "widget-drag-handle", title: "Перетащить", attrs: { "aria-hidden": "true" } }, [createLineIcon("grip", { size: 14 })]),
          title,
          element("div", { className: "widget-actions" }, [
            widgetAction("minus", "Свернуть виджет", "toggle-collapse"),
            widgetAction("pin", "Закрепить положение виджета", "toggle-pin"),
            widgetAction("settings", "Свойства виджета", "properties"),
            widgetAction("duplicate", "Дублировать виджет", "duplicate"),
            widgetAction("close", "Удалить виджет", "remove"),
          ]),
        ]),
        body,
        element("button", { className: "widget-resize-handle", title: "Изменить размер", attrs: { type: "button", "data-action": "resize", "aria-label": "Изменить размер виджета" } }, [createLineIcon("resize", { size: 13 })]),
      ]);
      const content = definition.create(widget, context);
      scaleLayer.append(content);
      body.append(scaleLayer);
      entry = { article, body, scaleLayer, content, definition };
      entries.set(widget.id, entry);
      root.append(article);
      article.addEventListener("pointerdown", (event) => onPointerDown(event, widget.id));
      article.addEventListener("click", (event) => onWidgetClick(event, widget.id));
    }

    entry.article.style.left = `${widget.position.x}px`;
    entry.article.style.top = `${widget.position.y}px`;
    const style = widget.style || {};
    const layoutCount = store.getState().widgets.filter((item) => !item.collapsed).length;
    const minSize = style.compactLayout
      ? autoLayoutMinimumSizeFor(widget.type, definition.minSize, layoutCount)
      : minimumSizeFor(widget.type, definition.minSize);
    const renderedSize = {
      w: Math.max(Number(widget.size.w) || 0, minSize.w),
      h: Math.max(Number(widget.size.h) || 0, minSize.h),
    };
    entry.article.style.width = `${renderedSize.w}px`;
    entry.article.style.height = `${renderedSize.h}px`;
    entry.article.style.minWidth = `${minSize.w}px`;
    entry.article.style.minHeight = `${minSize.h}px`;
    entry.article.style.zIndex = String(widget.zIndex);
    const surfaceMode = surfaceModes.has(style.surfaceMode) ? style.surfaceMode : "custom";
    const parsedOpacity = Number(style.opacity);
    const controlOpacity = Number.isFinite(parsedOpacity) ? Math.min(1, Math.max(0, parsedOpacity)) : 1;
    const surfaceOpacity = materialAlpha(surfaceMode, controlOpacity);
    const headerOpacity = surfaceMode === "solid" ? 1 : Number(style.headerOpacity ?? .64) * surfaceOpacity;
    entry.article.dataset.surface = surfaceMode;
    entry.article.style.setProperty("--widget-surface-alpha", `${surfaceOpacity * 100}%`);
    entry.article.style.setProperty("--widget-glass-highlight-alpha", `${surfaceOpacity * 15}%`);
    entry.article.style.setProperty("--widget-acrylic-tint-alpha", `${surfaceOpacity * 9}%`);
    entry.article.style.setProperty("--widget-clear-highlight-alpha", `${surfaceOpacity * 7}%`);
    entry.article.style.setProperty("--widget-surface-control-alpha", String(controlOpacity));
    entry.article.style.setProperty("--widget-header-alpha", String(Math.min(1, Math.max(0, headerOpacity))));
    entry.article.style.setProperty("--widget-accent", style.useThemeAccent !== false ? "var(--accent)" : (style.accent || "#d9b45f"));
    entry.article.style.setProperty("--widget-font-scale", String(style.fontScale ?? 1));
    const manualInterfaceScale = Math.min(1.5, Math.max(.65, Number(style.interfaceScale) || 1));
    const defaultWidth = Math.max(1, Number(definition.defaultSize?.w) || widget.size.w);
    const defaultHeight = Math.max(1, Number(definition.defaultSize?.h) || widget.size.h);
    const minAutoScale = style.compactLayout ? .46 : .72;
    const minInterfaceScale = style.compactLayout ? .46 : .55;
    const autoFitScale = Math.min(1.35, Math.max(minAutoScale, Math.min(renderedSize.w / defaultWidth, renderedSize.h / defaultHeight)));
    const effectiveInterfaceScale = Math.min(1.7, Math.max(minInterfaceScale, manualInterfaceScale * (style.autoScale === false ? 1 : autoFitScale)));
    entry.article.style.setProperty("--widget-interface-scale", String(effectiveInterfaceScale));
    entry.article.style.setProperty("--widget-auto-fit-scale", String(style.autoScale === false ? 1 : autoFitScale));
    const behavior = store.getState().settings?.behavior || {};
    const useRoundedCorners = behavior.roundedCorners !== false;
    const requestedRadius = Number(behavior.cornerRadius);
    const cornerRadius = Number.isFinite(requestedRadius) ? Math.min(24, Math.max(0, requestedRadius)) : 8;
    entry.article.style.setProperty("--widget-border-width", `${style.borderWidth ?? 1}px`);
    entry.article.style.setProperty("--widget-radius", useRoundedCorners ? `${cornerRadius}px` : "0px");
    entry.article.style.setProperty("--widget-shadow", `${style.shadow ?? 34}px`);
    entry.article.style.setProperty("--widget-blur", `${style.blur ?? 16}px`);
    entry.article.style.setProperty("--widget-padding", `${style.padding ?? 13}px`);
    entry.article.style.setProperty("--widget-font-weight", String(style.fontWeight ?? 400));
    entry.article.style.setProperty("--widget-content-align", style.contentAlign || "left");

    const setOptionalStyle = (name, value) => {
      if (value) entry.article.style.setProperty(name, value);
      else entry.article.style.removeProperty(name);
    };
    // Keep user overrides separate from theme defaults. Themes can use these variables as an optional override.
    setOptionalStyle("--widget-user-header-color", style.headerColor);
    setOptionalStyle("--widget-user-header-text", style.headerTextColor);
    setOptionalStyle("--widget-user-surface", style.background);
    setOptionalStyle("--widget-user-color", style.color);
    setOptionalStyle("--widget-user-border-color", style.borderColor);
    setOptionalStyle("--widget-user-accent", style.useThemeAccent === false ? style.accent : "");
    entry.article.dataset.hasCustomBackground = style.background ? "true" : "false";
    entry.article.dataset.hasCustomAccent = style.useThemeAccent === false && style.accent ? "true" : "false";
    setOptionalStyle("--widget-header-color", style.headerColor);
    setOptionalStyle("--widget-header-text", style.headerTextColor);
    setOptionalStyle("--widget-surface", style.background);
    setOptionalStyle("--widget-custom-color", style.color);
    setOptionalStyle("--widget-border-color", style.borderColor);
    entry.article.hidden = Boolean(widget.collapsed);
    entry.article.classList.toggle("is-collapsed", Boolean(widget.collapsed));
    entry.body.hidden = Boolean(widget.collapsed);
    entry.article.querySelector("[data-action='toggle-collapse']").title = "Свернуть в панель";
    entry.article.querySelector("[data-action='toggle-collapse']").setAttribute("aria-label", "Свернуть в панель");
    const pinToggle = entry.article.querySelector("[data-action='toggle-pin']");
    const pinned = Boolean(widget.pinned);
    pinToggle.classList.toggle("is-active", pinned);
    pinToggle.setAttribute("aria-pressed", String(pinned));
    pinToggle.setAttribute("aria-label", "Закрепить положение виджета");
    pinToggle.title = pinned ? "Закреплён: не менять при авторасстановке" : "Закрепить положение при авторасстановке";
    entry.article.querySelector(".widget-title").textContent = widget.title || definition.title;

    const focusedEditor = entry.article.querySelector("input[type='text']:focus, input[type='url']:focus, input[type='number']:focus, textarea:focus, select:focus, [contenteditable='true']:focus");
    if (active?.id !== widget.id && !focusedEditor) definition.update(entry.content, widget, context);
  };

  const showDeleteMenu = (id) => {
    const entry = entries.get(id);
    const widget = store.getState().widgets.find((item) => item.id === id);
    if (!entry || !widget) return;
    entry.article.querySelector(".widget-delete-menu")?.remove();
    const definition = registry.get(widget.type);
    const cancel = element("button", { className: "text-action", text: "Отмена", attrs: { type: "button" } });
    const confirm = element("button", { className: "danger-action", text: "Удалить", attrs: { type: "button" } });
    const menu = element("div", { className: "widget-delete-menu", attrs: { role: "dialog", "aria-label": "Подтверждение удаления" } }, [
      element("strong", { text: "Удалить виджет?" }),
      element("span", { text: widget.title || definition.title }),
      element("div", { className: "widget-delete-menu-actions" }, [cancel, confirm]),
    ]);
    cancel.addEventListener("click", () => menu.remove());
    confirm.addEventListener("click", () => {
      const snapshot = structuredClone(widget);
      store.removeWidget(id);
      onHistoryCommand({
        label: "Удаление виджета",
        undo: () => store.addWidget(structuredClone(snapshot), "history-undo"),
        redo: () => store.removeWidget(snapshot.id, "history-redo"),
      });
      notify({ title: "Виджет удалён", message: widget.title || definition.title, type: "info" });
    });
    entry.article.append(menu);
  };

  const duplicateWidget = (id) => {
    const original = store.getState().widgets.find((item) => item.id === id);
    if (!original) return;
    const bounds = getWorkspaceBounds(root);
    const copy = registry.createWidget(original.type, {
      position: { x: Math.min(bounds.width - original.size.w, original.position.x + 26), y: Math.min(bounds.height - original.size.h, original.position.y + 26) },
      zIndex: store.getState().ui.nextZIndex + 1,
    });
    copy.title = `${original.title || registry.get(original.type).title} — копия`;
    copy.size = structuredClone(original.size);
    copy.style = structuredClone(original.style || copy.style);
    copy.config = structuredClone(original.config || copy.config);
    const created = store.addWidget(copy, "widget-duplicate");
    const snapshot = structuredClone(created);
    onHistoryCommand({
      label: "Дублирование виджета",
      undo: () => store.removeWidget(snapshot.id, "history-undo"),
      redo: () => store.addWidget(structuredClone(snapshot), "history-redo"),
    });
    notify({ title: "Виджет продублирован", message: copy.title, type: "success" });
  };

  const onWidgetClick = (event, id) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const widget = store.getState().widgets.find((item) => item.id === id);
    if (!widget) return;
    if (action === "properties") onOpenProperties(id);
    if (action === "toggle-collapse") {
      const before = { collapsed: Boolean(widget.collapsed) };
      const after = { collapsed: !before.collapsed };
      store.updateWidget(id, after, "widget-collapse");
      recordWidgetPatch(id, before, after, after.collapsed ? "Сворачивание виджета" : "Разворачивание виджета");
    }
    if (action === "toggle-pin") {
      const before = { pinned: Boolean(widget.pinned) };
      const after = { pinned: !before.pinned };
      store.updateWidget(id, after, "widget-pin");
      recordWidgetPatch(id, before, after, after.pinned ? "Закрепление виджета" : "Открепление виджета");
      notify({ title: after.pinned ? "Виджет закреплён" : "Виджет откреплён", message: after.pinned ? "Авторасстановка сохранит его положение." : "Виджет снова участвует в авторасстановке.", type: "info" });
    }
    if (action === "duplicate") duplicateWidget(id);
    if (action === "remove") showDeleteMenu(id);
  };

  const removeEntry = (id) => {
    const entry = entries.get(id);
    if (!entry) return;
    entry.definition.dispose?.(entry.content, context);
    entry.article.remove();
    entries.delete(id);
  };

  const renderAll = (state) => {
    root.classList.toggle("is-presentation-mode", Boolean(state.settings?.behavior?.presentationMode));
    const ids = new Set(state.widgets.map((widget) => widget.id));
    [...entries.keys()].filter((id) => !ids.has(id)).forEach(removeEntry);
    state.widgets.forEach(renderWidget);
  };

  const onPointerDown = (event, id) => {
    if (event.button !== undefined && event.button !== 0) return;
    const state = store.getState();
    const widget = state.widgets.find((item) => item.id === id);
    if (!widget) return;
    const action = event.target.closest("[data-action]")?.dataset.action;
    const resizeHandle = action === "resize";
    const dragRegion = event.target.closest("[data-role='drag-region']");
    if ((resizeHandle || dragRegion) && state.settings.behavior.lockWidgets) {
      const now = Date.now();
      if (now - lastLockNotice > 4000) {
        lastLockNotice = now;
        notify({ title: "Перемещение заблокировано", message: "Настройки → Рабочий стол → выключите «Заблокировать перемещение и размер».", type: "info" });
      }
      return;
    }
    if (!resizeHandle && !dragRegion) {
      if (!event.target.closest("input, textarea, button, select, a, [contenteditable='true']")) store.bringToFront(id);
      return;
    }
    if (action && !resizeHandle) return;
    if (widget.collapsed && resizeHandle) return;

    event.preventDefault();
    event.stopPropagation();
    store.bringToFront(id);
    active = {
      id,
      mode: resizeHandle ? "resize" : "move",
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      position: { ...widget.position },
      size: { ...widget.size },
      style: structuredClone(widget.style || {}),
      settings: state.settings.behavior,
      bounds: getWorkspaceBounds(root),
      preview: null,
      minSize: minimumSizeFor(widget.type, entries.get(id)?.definition.minSize),
    };
    const article = entries.get(id)?.article;
    article?.setPointerCapture?.(event.pointerId);
    article?.classList.add("is-interacting");
    document.documentElement.classList.add("is-pointer-interacting");
  };

  const onPointerMove = (event) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const entry = entries.get(active.id);
    if (!entry) return;
    const { settings, bounds } = active;
    const delta = { x: event.clientX - active.origin.x, y: event.clientY - active.origin.y };
    const patch = active.mode === "resize"
      ? resizeWidget({ startPosition: active.position, startSize: active.size, delta, bounds, settings, minSize: active.minSize })
      : { position: moveWidget({ startPosition: active.position, delta, size: active.size, bounds, settings }) };
    active.preview = patch;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (patch.position) {
        entry.article.style.left = `${patch.position.x}px`;
        entry.article.style.top = `${patch.position.y}px`;
      }
      if (patch.size) {
        entry.article.style.width = `${patch.size.w}px`;
        entry.article.style.height = `${patch.size.h}px`;
      }
    });
  };

  const finishPointer = (event) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const completed = active;
    active = null;
    cancelAnimationFrame(frame);
    const entry = entries.get(completed.id);
    entry?.article.classList.remove("is-interacting");
    document.documentElement.classList.remove("is-pointer-interacting");
    if (completed.preview) {
      const style = { ...(store.getState().widgets.find((item) => item.id === completed.id)?.style || {}), compactLayout: false };
      const patch = { ...completed.preview, style };
      const before = { position: completed.position, size: completed.size, style: completed.style };
      const after = { position: patch.position || completed.position, size: patch.size || completed.size, style };
      store.updateWidget(completed.id, patch, completed.mode === "resize" ? "resize" : "move");
      recordWidgetPatch(completed.id, before, after, completed.mode === "resize" ? "Изменение размера виджета" : "Перемещение виджета");
    }
  };

  const unsubscribe = store.subscribe((state, event) => {
    if (!event || event.type === "replace" || event.type === "batch" || event.type === "settings") {
      renderAll(state);
      if (event?.type === "replace") animateWorkspaceEnter(root, state.settings);
      else if (event?.type === "widget-add" && event.id) animateWidgetEnter(root.querySelector(`[data-widget-id="${event.id}"]`), state.settings);
    }
    const isAutoLayoutCommit = event?.type === "batch" && String(event.reason || "").startsWith("auto-layout-");
    const mosaicPreferenceChanged = event?.type === "settings" && Object.hasOwn(event.patch?.behavior || {}, "autoAdjustMosaic");
    if (event?.type === "replace" || (event?.type === "batch" && !isAutoLayoutCommit) || (event?.type === "settings" && (event.patch?.dock || mosaicPreferenceChanged))) scheduleAdaptiveMasonry();
    else if (event.type === "widget-add") renderWidget(state.widgets.find((item) => item.id === event.id));
    else if (event.type === "widget-remove") {
      const entry = entries.get(event.id);
      animateWidgetExit(entry?.article, state.settings, () => removeEntry(event.id));
    }
    else if (event.id) {
      const widget = state.widgets.find((item) => item.id === event.id);
      if (widget) {
        renderWidget(widget);
        if (event.type === "widget-add") animateWidgetEnter(entries.get(widget.id)?.article, state.settings);
        if (widget.type === "todo") state.widgets.filter((item) => item.type === "calendar").forEach(renderWidget);
      }
    }
  });

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleAdaptiveMasonry) : null;
  resizeObserver?.observe(root);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", finishPointer);
  window.addEventListener("pointercancel", finishPointer);
  window.addEventListener("resize", scheduleAdaptiveMasonry, { passive: true });
  renderAll(store.getState());
  animateWorkspaceStart(root, store.getState().settings);
  scheduleAdaptiveMasonry();

  return {
    destroy() {
      unsubscribe();
      resizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(adaptiveLayoutFrame);
      document.documentElement.classList.remove("is-pointer-interacting");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
      window.removeEventListener("resize", scheduleAdaptiveMasonry);
      [...entries.keys()].forEach(removeEntry);
      clear(root);
    },
  };
}
