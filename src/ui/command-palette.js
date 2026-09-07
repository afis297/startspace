import { clear, element } from "./dom.js";
import { animatePanel } from "./motion.js";

function searchable(action) {
  return `${action.title} ${action.description || ""} ${(action.keywords || []).join(" ")}`.toLocaleLowerCase("ru");
}

/** Keyboard-first shortcut menu for the most frequent Startspace actions. */
export function mountCommandPalette({ root, actions, store }) {
  let overlay = null;
  let input = null;
  let list = null;
  let activeIndex = 0;
  let visibleActions = [];
  let returnFocus = null;

  const close = ({ restoreFocus = true } = {}) => {
    if (!overlay) return;
    document.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
    overlay = null;
    input = null;
    list = null;
    visibleActions = [];
    const target = returnFocus;
    returnFocus = null;
    if (restoreFocus && target?.isConnected && typeof target.focus === "function") target.focus({ preventScroll: true });
  };

  const execute = (action) => {
    close({ restoreFocus: false });
    action.run?.();
  };

  const render = () => {
    if (!list || !input) return;
    const query = input.value.trim().toLocaleLowerCase("ru");
    visibleActions = actions.filter((action) => !query || searchable(action).includes(query));
    activeIndex = Math.min(activeIndex, Math.max(0, visibleActions.length - 1));
    clear(list);
    if (!visibleActions.length) {
      list.removeAttribute("aria-activedescendant");
      list.append(element("p", { className: "command-palette-empty", text: "Нет подходящих команд" }));
      return;
    }
    list.setAttribute("aria-activedescendant", `command-palette-option-${activeIndex}`);
    visibleActions.forEach((action, index) => {
      const button = element("button", {
        className: `command-palette-item${index === activeIndex ? " is-active" : ""}`,
        attrs: { id: `command-palette-option-${index}`, type: "button", role: "option", "aria-selected": index === activeIndex ? "true" : "false" },
      }, [
        element("span", { className: "command-palette-copy" }, [
          element("strong", { text: action.title }),
          element("small", { text: action.description || "" }),
        ]),
        action.hint ? element("kbd", { text: action.hint }) : element("span", { className: "command-palette-enter", text: "↵" }),
      ]);
      button.addEventListener("mouseenter", () => { activeIndex = index; render(); });
      button.addEventListener("click", () => execute(action));
      list.append(button);
    });
  };

  const onKeyDown = (event) => {
    if (!overlay) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      const focusable = Array.from(overlay?.querySelectorAll("button:not([disabled]), input:not([disabled])") || []);
      if (!focusable.length) return;
      event.preventDefault();
      event.stopPropagation();
      const currentIndex = focusable.indexOf(document.activeElement);
      const nextIndex = currentIndex < 0
        ? (event.shiftKey ? focusable.length - 1 : 0)
        : (currentIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      focusable[nextIndex]?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (!visibleActions.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + direction + visibleActions.length) % visibleActions.length;
      render();
      return;
    }
    if (event.key === "Enter" && visibleActions[activeIndex]) {
      event.preventDefault();
      event.stopPropagation();
      execute(visibleActions[activeIndex]);
    }
  };

  const open = () => {
    if (overlay) {
      input?.focus();
      return;
    }
    returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    const dialog = element("section", {
      className: "command-palette-dialog",
      attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "command-palette-title", "aria-keyshortcuts": "Control+K Meta+K" },
    });
    const closeButton = element("button", {
      className: "command-palette-close",
      text: "×",
      attrs: { type: "button", "aria-label": "Закрыть командную палитру" },
      on: { click: close },
    });
    input = element("input", {
      className: "command-palette-input",
      attrs: { type: "search", autocomplete: "off", placeholder: "Найти действие…", "aria-label": "Поиск действия" },
    });
    input.addEventListener("input", () => { activeIndex = 0; render(); });
    list = element("div", { className: "command-palette-list", attrs: { role: "listbox", "aria-label": "Команды" } });
    dialog.append(
      closeButton,
      element("div", { className: "command-palette-heading" }, [
        element("p", { className: "command-palette-kicker", text: "STARTSPACE / БЫСТРЫЕ ДЕЙСТВИЯ" }),
        element("h2", { attrs: { id: "command-palette-title" }, text: "Командная палитра" }),
      ]),
      input,
      list,
      element("p", { className: "command-palette-help", text: "↑↓ выбрать · Enter выполнить · Esc закрыть" }),
    );
    overlay = element("div", { className: "command-palette-overlay" }, [dialog]);
    overlay.addEventListener("pointerdown", (event) => { if (event.target === overlay) close(); });
    root.append(overlay);
    render();
    animatePanel(dialog, store?.getState().settings, { fromX: 0, fromY: -10 });
    document.addEventListener("keydown", onKeyDown, true);
    queueMicrotask(() => input?.focus());
  };

  return { open, close, destroy: () => close({ restoreFocus: false }) };
}
