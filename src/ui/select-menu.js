import { element } from "./dom.js";
import { createLineIcon } from "./icons.js";

function normalizeOptions(options) {
  return (options || []).map((option) => ({ value: String(option.value), label: String(option.label), description: String(option.description || "") }));
}

/**
 * Moves a listbox to document.body while it is open. This prevents scrollable panels,
 * cards and stacking contexts from clipping the list, and keeps all custom selects
 * above the workspace and dock.
 */
export function createFloatingMenuLayer({ trigger, menu, restoreParent = menu?.parentElement } = {}) {
  const originalParent = restoreParent;
  const originalNextSibling = menu?.nextSibling || null;
  let mounted = false;

  const restore = () => {
    if (!menu) return;
    if (originalParent?.isConnected) {
      if (originalNextSibling?.parentNode === originalParent) originalParent.insertBefore(menu, originalNextSibling);
      else originalParent.append(menu);
    } else menu.remove();
  };

  const place = () => {
    if (!menu || !trigger || menu.hidden) return;
    const anchor = trigger.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableBelow = Math.max(120, viewportHeight - anchor.bottom - margin);
    const availableAbove = Math.max(120, anchor.top - margin);
    const naturalHeight = Math.max(menu.offsetHeight, menu.scrollHeight, 160);
    const placeAbove = availableBelow < Math.min(naturalHeight, 260) && availableAbove > availableBelow;
    const maxHeight = placeAbove ? availableAbove : availableBelow;
    const isMaterialMenu = menu.classList.contains("material-menu");
    const preferredWidth = isMaterialMenu ? 320 : 236;
    const widestAllowed = isMaterialMenu ? 340 : 260;
    const targetWidth = Math.min(
      Math.max(Math.min(anchor.width, widestAllowed), preferredWidth),
      viewportWidth - margin * 2,
    );
    const left = Math.max(margin, Math.min(anchor.left, viewportWidth - targetWidth - margin));

    menu.style.setProperty("position", "fixed", "important");
    menu.style.setProperty("z-index", "7000", "important");
    menu.style.setProperty("display", "grid", "important");
    menu.style.setProperty("left", `${left}px`, "important");
    menu.style.setProperty("box-sizing", "border-box", "important");
    menu.style.setProperty("width", `${targetWidth}px`, "important");
    menu.style.setProperty("min-width", `${targetWidth}px`, "important");
    menu.style.setProperty("max-width", `${targetWidth}px`, "important");
    menu.style.setProperty("max-height", `${maxHeight}px`, "important");
    menu.style.setProperty("overflow", "auto", "important");
    menu.style.setProperty("top", "0px", "important");

    const actualHeight = Math.min(menu.offsetHeight || naturalHeight, maxHeight);
    const top = placeAbove ? Math.max(margin, anchor.top - actualHeight - 6) : Math.min(viewportHeight - actualHeight - margin, anchor.bottom + 6);
    menu.style.setProperty("top", `${top}px`, "important");
  };

  const onViewportChange = () => place();

  const open = () => {
    if (!menu || !trigger) return;
    if (menu.parentElement !== document.body) document.body.append(menu);
    mounted = true;
    menu.hidden = false;
    place();
    menu.style.setProperty("visibility", "visible", "important");
    window.addEventListener("resize", onViewportChange);
    document.addEventListener("scroll", onViewportChange, true);
  };

  const close = () => {
    if (!menu) return;
    window.removeEventListener("resize", onViewportChange);
    document.removeEventListener("scroll", onViewportChange, true);
    menu.hidden = true;
    ["position", "z-index", "display", "left", "top", "box-sizing", "width", "min-width", "max-width", "max-height", "overflow", "visibility"].forEach((property) => menu.style.removeProperty(property));
    if (mounted || menu.parentElement === document.body) restore();
    mounted = false;
  };

  return { open, close, place, contains: (target) => Boolean(trigger?.contains(target) || menu?.contains(target)) };
}

export function disposeSelectMenus(scope) {
  scope?.querySelectorAll?.(".select-menu").forEach((control) => control.__dispose?.());
}

export function createSelectMenu({ value, options, onChange, ariaLabel = "Выбор", className = "" }) {
  const items = normalizeOptions(options);
  const initial = items.find((item) => item.value === String(value)) || items[0] || { value: "", label: "Не выбрано", description: "" };
  const root = element("div", { className: `select-menu ${className}`.trim(), attrs: { "data-value": initial.value } });
  const label = element("span", { className: "select-menu-label", text: initial.label });
  const trigger = element("button", { className: "select-menu-trigger", attrs: { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": ariaLabel } }, [label, element("span", { className: "select-menu-chevron", attrs: { "aria-hidden": "true" } }, [createLineIcon("chevronDown", { size: 15 })])]);
  const list = element("div", { className: "select-menu-list", attrs: { role: "listbox", "aria-label": ariaLabel, "aria-hidden": "true", hidden: "" } });
  const floatingLayer = createFloatingMenuLayer({ trigger, menu: list, restoreParent: root });
  let open = false;
  const onDocumentPointerDown = (event) => { if (!floatingLayer.contains(event.target)) close(); };

  const close = () => {
    if (!open) return;
    open = false;
    root.classList.remove("is-open");
    list.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    floatingLayer.close();
  };
  const show = () => {
    if (open) return;
    open = true;
    root.classList.add("is-open");
    list.setAttribute("aria-hidden", "false");
    trigger.setAttribute("aria-expanded", "true");
    floatingLayer.open();
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
  };
  const setValue = (nextValue, { notify = false } = {}) => {
    const next = items.find((item) => item.value === String(nextValue)) || initial;
    root.dataset.value = next.value;
    label.textContent = next.label;
    [...list.querySelectorAll(".select-menu-option")].forEach((item) => {
      const active = item.dataset.value === next.value;
      item.classList.toggle("is-selected", active);
      item.setAttribute("aria-selected", String(active));
    });
    if (notify) onChange?.(next.value);
  };

  items.forEach((item) => {
    const copy = element("span", { className: "select-menu-option-copy" }, [element("strong", { text: item.label })]);
    if (item.description) copy.append(element("small", { text: item.description }));
    const option = element("button", { className: `select-menu-option${item.value === initial.value ? " is-selected" : ""}`, attrs: { type: "button", role: "option", "aria-selected": String(item.value === initial.value), "data-value": item.value } }, [copy]);
    option.addEventListener("click", () => { setValue(item.value, { notify: true }); close(); });
    list.append(option);
  });
  trigger.addEventListener("click", () => { if (open) close(); else show(); });
  const focusOption = (index) => {
    const options = [...list.querySelectorAll(".select-menu-option")];
    options[Math.max(0, Math.min(index, options.length - 1))]?.focus();
  };
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { close(); trigger.focus(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      show();
      focusOption(event.key === "ArrowUp" || event.key === "End" ? items.length - 1 : 0);
    }
  });
  list.addEventListener("keydown", (event) => {
    const options = [...list.querySelectorAll(".select-menu-option")];
    const index = options.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); close(); trigger.focus(); }
    if (event.key === "ArrowDown") { event.preventDefault(); focusOption(index + 1); }
    if (event.key === "ArrowUp") { event.preventDefault(); focusOption(index - 1); }
    if (event.key === "Home") { event.preventDefault(); focusOption(0); }
    if (event.key === "End") { event.preventDefault(); focusOption(options.length - 1); }
  });
  root.__dispose = close;
  root.append(trigger, list);
  return { root, setValue, close };
}
