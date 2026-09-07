import { clear, element, safeUrl } from "./dom.js";
import { createColorEditor } from "./color-editor.js";
import { createFloatingMenuLayer, createSelectMenu, disposeSelectMenus } from "./select-menu.js";
import { exportWidget } from "../app/backup-service.js";
import { createLineIcon } from "./icons.js";
import { animatePanel } from "./motion.js";
import { createDatePicker } from "./date-picker.js";

const colorPattern = /^#[0-9a-f]{6}$/i;

function getFieldValue(widget, field) {
  if (field.target === "root") return widget[field.key] ?? field.default ?? "";
  if (field.target === "style") return widget.style?.[field.key] ?? field.default ?? "";
  return widget.config?.[field.key] ?? field.default ?? "";
}
function sanitize(field, raw) {
  if (field.validate) return field.validate(raw);
  if (field.type === "toggle") return Boolean(raw);
  if (field.type === "number" || field.type === "range") {
    const value = Number(raw);
    if (!Number.isFinite(value)) return Number(field.default || 0);
    return Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, value));
  }
  if (field.type === "color") return colorPattern.test(raw) ? raw : (field.default || "#d9b45f");
  if (field.type === "url") {
    const value = String(raw ?? "").trim();
    const normalized = safeUrl(value);
    if (!value || !normalized) return "";
    return field.httpsOnly && !normalized.startsWith("https://") ? "" : normalized;
  }
  return String(raw ?? "").slice(0, field.maxLength || 1000);
}
function patchForField(widget, field, value) {
  if (field.target === "root") return { [field.key]: value };
  if (field.target === "style") return { style: { ...widget.style, [field.key]: value } };
  return { config: { ...widget.config, [field.key]: value } };
}
function materialDescription(value) {
  return ({ solid: "Плотная заливка · 100%", soft: "Мягкая матовая прозрачность", glass: "Лёгкое стекло · блюр 14px", acrylic: "Плотный акрил · блюр 30px", clear: "Почти прозрачная поверхность", custom: "Точные параметры вручную" })[value] || "Настройка поверхности";
}

const propertySectionOrder = ["Основное", "Содержимое", "Пароль", "Трек", "Источник", "Воспроизведение", "Языки", "Местоположение", "Валютная пара", "Событие", "Время", "Игра", "Поведение", "Обновление", "Масштаб", "Макет", "Текст", "Поверхность", "Граница"];
const expandedPropertySections = new Set(["Основное", "Содержимое"]);
let propertyGroupSequence = 0;
let materialMenuSequence = 0;

function propertySectionRank(name) {
  const index = propertySectionOrder.indexOf(name);
  return index < 0 ? propertySectionOrder.length : index;
}
function createPropertiesGroup(title, children, { expanded = false, className = "" } = {}) {
  const contentId = `properties-group-${++propertyGroupSequence}`;
  const titleNode = element("span", { className: "property-group-title", text: title });
  const chevron = element("span", { className: "property-group-chevron", attrs: { "aria-hidden": "true" } }, [createLineIcon("chevronDown", { size: 15 })]);
  const trigger = element("button", { className: "property-group-trigger", attrs: { type: "button", "aria-controls": contentId } }, [titleNode, chevron]);
  const content = element("div", { className: "property-group-content", attrs: { id: contentId } });
  children.forEach((child) => content.append(child));
  const group = element("section", { className: `properties-section property-group ${className}`.trim() }, [trigger, content]);
  const setExpanded = (next) => {
    group.classList.toggle("is-expanded", next);
    trigger.setAttribute("aria-expanded", String(next));
    content.hidden = !next;
    content.setAttribute("aria-hidden", String(!next));
  };
  trigger.addEventListener("click", () => setExpanded(content.hidden));
  setExpanded(expanded);
  return group;
}
function controlForField(field, value, onChange) {
  if (field.type === "color") return createColorEditor({ label: field.label, value, fallback: field.default || "#d9b45f", onChange });
  let control;
  if (field.type === "textarea") {
    control = element("textarea", { value, attrs: { maxlength: field.maxLength || 1000, placeholder: field.placeholder || "" } });
    control.addEventListener("input", () => onChange(control.value));
  } else if (field.type === "select") {
    if (field.key === "surfaceMode") {
      const options = field.options || [];
      const initial = options.find((option) => option.value === String(value)) || options[0];
      const material = element("div", { className: "material-control", attrs: { "data-material": initial?.value || "custom" } });
      const selectedLabel = element("span", { className: "material-trigger-label", text: initial?.label || "Выберите материал" });
      const chevron = element("span", { className: "material-chevron", attrs: { "aria-hidden": "true" } }, [createLineIcon("chevronDown", { size: 15 })]);
      const menuId = `material-menu-${++materialMenuSequence}`;
      const trigger = element("button", { className: "material-trigger", attrs: { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-controls": menuId } }, [element("span", { className: "material-swatch", attrs: { "aria-hidden": "true" } }), selectedLabel, chevron]);
      const menu = element("div", { className: "material-menu", attrs: { id: menuId, role: "listbox", "aria-label": "Материал поверхности", "aria-hidden": "true" } });
      menu.hidden = true;
      const floatingLayer = createFloatingMenuLayer({ trigger, menu, restoreParent: material });
      let isOpen = false;
      const onDocumentPointerDown = (event) => { if (!floatingLayer.contains(event.target)) closeMenu(); };
      const closeMenu = () => {
        if (!isOpen) return;
        isOpen = false;
        menu.setAttribute("aria-hidden", "true");
        trigger.setAttribute("aria-expanded", "false");
        material.classList.remove("is-open");
        document.removeEventListener("pointerdown", onDocumentPointerDown, true);
        floatingLayer.close();
      };
      const openMenu = () => {
        if (isOpen) return;
        isOpen = true;
        menu.setAttribute("aria-hidden", "false");
        trigger.setAttribute("aria-expanded", "true");
        material.classList.add("is-open");
        floatingLayer.open();
        document.addEventListener("pointerdown", onDocumentPointerDown, true);
      };
      const selectOption = (option) => {
        material.dataset.material = option.value;
        selectedLabel.textContent = option.label;
        [...menu.querySelectorAll(".material-option")].forEach((item) => {
          const active = item.dataset.value === option.value;
          item.classList.toggle("is-selected", active);
          item.setAttribute("aria-selected", String(active));
        });
        closeMenu();
        onChange(option.value);
      };
      options.forEach((option) => {
        const optionButton = element("button", { className: `material-option${option.value === initial?.value ? " is-selected" : ""}`, attrs: { type: "button", role: "option", "aria-selected": String(option.value === initial?.value), "data-value": option.value, "data-material": option.value } }, [
          element("span", { className: "material-swatch", attrs: { "aria-hidden": "true" } }),
          element("span", { className: "material-option-copy" }, [element("strong", { text: option.label }), element("small", { text: materialDescription(option.value) })]),
        ]);
        optionButton.addEventListener("click", () => selectOption(option));
        menu.append(optionButton);
      });
      trigger.addEventListener("click", () => { if (isOpen) closeMenu(); else openMenu(); });
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { closeMenu(); trigger.focus(); }
        if (event.key === "ArrowDown") { event.preventDefault(); openMenu(); menu.querySelector(".material-option")?.focus(); }
      });
      material.__dispose = closeMenu;
      material.append(trigger, menu);
      control = material;
    } else {
      control = createSelectMenu({ value, options: field.options, onChange, ariaLabel: field.label, className: "property-select-menu" }).root;
    }
  } else if (field.type === "datetime-local") {
    const current = String(value || "");
    const [datePart = "", timePart = ""] = current.split("T");
    const composite = element("div", { className: "datetime-composite" });
    const time = element("input", { className: "datetime-time-input", value: /^\d{2}:\d{2}/.test(timePart) ? timePart.slice(0, 5) : "", attrs: { type: "text", inputmode: "numeric", placeholder: "ЧЧ:ММ", maxlength: "5", "aria-label": `${field.label}: время` } });
    const normalizeTime = (raw) => {
      const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
      return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    };
    const commit = (date) => {
      const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : datePicker.root.dataset.value;
      const timeValue = /^\d{2}:\d{2}$/.test(time.value) ? time.value : "00:00";
      if (dateValue) onChange(`${dateValue}T${timeValue}`);
    };
    const datePicker = createDatePicker({ value: datePart, ariaLabel: `${field.label}: дата`, className: "property-date-picker", onChange: (date) => commit(date) });
    time.addEventListener("input", () => {
      const cursorAtEnd = time.selectionStart === time.value.length;
      time.value = normalizeTime(time.value);
      if (cursorAtEnd) time.setSelectionRange(time.value.length, time.value.length);
      if (/^\d{2}:\d{2}$/.test(time.value)) commit();
    });
    time.addEventListener("change", () => commit());
    composite.append(datePicker.root, time);
    control = composite;
  } else if (field.type === "toggle") {
    control = element("input", { checked: Boolean(value), attrs: { type: "checkbox" } });
    control.addEventListener("change", () => onChange(control.checked));
  } else {
    const type = ["text", "url", "number", "range", "datetime-local"].includes(field.type) ? field.type : "text";
    control = element("input", { value, attrs: { type, min: field.min, max: field.max, step: field.step, maxlength: field.maxLength, placeholder: field.placeholder || "" } });
    control.addEventListener("pointerdown", (event) => event.stopPropagation());
    control.addEventListener(type === "range" ? "input" : "change", () => onChange(control.value));
  }
  return control;
}

function createWidgetActions(widget, store, registry, notify) {
  const actions = element("div", { className: "widget-quick-actions" });
  const reset = element("button", { className: "text-action", text: "Сбросить только оформление", attrs: { type: "button" } });
  reset.addEventListener("click", () => {
    const base = registry.createWidget(widget.type);
    store.updateWidget(widget.id, { style: base.style }, "style-reset");
    notify({ title: "Оформление сброшено", message: "Данные виджета сохранены", type: "success" });
  });
  const download = element("button", { className: "text-action", text: "Скачать этот виджет", attrs: { type: "button" } });
  download.addEventListener("click", () => {
    try {
      const current = store.getState().widgets.find((item) => item.id === widget.id);
      exportWidget(current);
      notify({ title: "Виджет сохранён", message: "JSON-файл готов к импорту", type: "success" });
    } catch (error) {
      notify({ title: "Не удалось сохранить виджет", message: error.message, type: "error" });
    }
  });
  actions.append(reset, download);
  return createPropertiesGroup("Быстрые действия", [actions], { className: "widget-actions-section" });
}

function createSizeSection(widget, store) {
  const grid = element("div", { className: "widget-size-controls" });
  const makeControl = (key, label, min, max) => {
    const caption = element("span", { text: `${label}: ${Math.round(widget.size?.[key] || min)} px` });
    const input = element("input", { value: Math.round(widget.size?.[key] || min), attrs: { type: "range", min, max, step: "1", "aria-label": label } });
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      const current = store.getState().widgets.find((item) => item.id === widget.id);
      if (!current) return;
      const value = Number(input.value);
      caption.textContent = `${label}: ${value} px`;
      store.updateWidget(current.id, { size: { ...current.size, [key]: value } }, "property-change");
    });
    return element("label", { className: "property-field" }, [caption, input]);
  };
  grid.append(makeControl("w", "Ширина", 160, 900), makeControl("h", "Высота", 90, 900));
  return createPropertiesGroup("Размер виджета", [grid], { expanded: true, className: "widget-size-section" });
}

export function mountPropertiesPanel({ root, store, registry, onClose, notify = () => {} }) {
  let selectedId = null;
  const disposeControls = () => {
    disposeSelectMenus(root);
    root.querySelectorAll(".material-control").forEach((control) => control.__dispose?.());
  };
  const render = () => {
    const behavior = store.getState().settings?.behavior || {};
    const requestedRadius = Number(behavior.cornerRadius);
    const cornerRadius = Number.isFinite(requestedRadius) ? Math.min(24, Math.max(0, requestedRadius)) : 8;
    root.style.setProperty("--checkbox-radius", behavior.roundedCorners === false ? "0px" : `${cornerRadius}px`);
    disposeControls();
    clear(root);
    const widget = store.getState().widgets.find((item) => item.id === selectedId);
    if (!widget) return;
    const definition = registry.get(widget.type);
    const close = element("button", { className: "panel-close", attrs: { type: "button", "aria-label": "Закрыть н.в." }, on: { click: onClose } }, [createLineIcon("close", { size: 17 })]);
    root.append(element("div", { className: "panel-heading panel-drag-region", attrs: { "data-role": "panel-drag" } }, [element("div", {}, [element("span", { className: "panel-kicker", text: definition.category }), element("h2", { text: widget.title || definition.title })]), close ]));
    root.append(createSizeSection(widget, store));
    root.append(createWidgetActions(widget, store, registry, notify));
    const fields = registry.propertiesFor(widget);
    const sections = new Map();
    fields.forEach((field) => {
      const sectionName = field.section || "Содержимое";
      if (!sections.has(sectionName)) sections.set(sectionName, element("div", { className: "property-group-fields" }));
      const fieldId = `property-${widget.id}-${field.target || "config"}-${field.key}`;
      const label = element("label", { className: "property-field", attrs: { for: fieldId } }, [element("span", { text: field.label })]);
      const control = controlForField(field, getFieldValue(widget, field), (raw) => {
        const current = store.getState().widgets.find((item) => item.id === selectedId);
        if (!current) return;
        const value = sanitize(field, raw);
        const patch = patchForField(current, field, value);
        // A deliberately chosen accent must take precedence immediately, including in themed palettes.
        if (field.target === "style" && field.key === "accent") {
          patch.style = { ...patch.style, useThemeAccent: false };
          const themeAccentToggle = root.querySelector(`#property-${current.id}-style-useThemeAccent`);
          if (themeAccentToggle) themeAccentToggle.checked = false;
        }
        store.updateWidget(current.id, patch, "property-change");
        if (field.key === "surfaceMode") render();
      });
      if (field.key === "opacity" && widget.style?.surfaceMode === "solid") {
        control.disabled = true;
        label.classList.add("is-disabled");
        label.title = "В непрозрачном режиме прозрачность зафиксирована на 100%.";
      }
      control.id = fieldId; label.append(control);
      if (field.hint) label.append(element("small", { text: field.hint }));
      sections.get(sectionName).append(label);
    });
    [...sections.entries()]
      .sort(([first], [second]) => propertySectionRank(first) - propertySectionRank(second) || first.localeCompare(second, "ru"))
      .forEach(([sectionName, fieldsRoot]) => root.append(createPropertiesGroup(sectionName, [fieldsRoot], { expanded: expandedPropertySections.has(sectionName) })));

    root.append(element("button", { className: "panel-resize-handle", attrs: { type: "button", "data-action": "resize-panel", "aria-label": "Изменить размер панели" }, title: "Изменить размер" }, [createLineIcon("resize", { size: 13 })]));
    root.dispatchEvent(new Event("panel-content-rendered"));
  };
  const unsubscribe = store.subscribe((_state, event) => {
    if (!selectedId) return;
    if (event?.type === "widget-remove" && event.id === selectedId) { onClose(); return; }
    if (event?.reason === "property-change") return;
    if (event?.id === selectedId || event?.type === "replace" || event?.type === "settings") render();
  });
  return { open(id) { selectedId = id; root.hidden = false; render(); animatePanel(root, store.getState().settings); }, close() { selectedId = null; root.hidden = true; disposeControls(); clear(root); }, destroy() { unsubscribe(); disposeControls(); clear(root); } };
}


