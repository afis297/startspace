import { element } from "./dom.js";

const defaults = { info: 3600, success: 3200, warning: 5000, error: 6500 };
const icons = { info: "i", success: "✓", warning: "!", error: "×" };

export function mountNotifications({ root }) {
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-relevant", "additions text");
  const timers = new Map();
  const dismiss = (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    const item = root.querySelector(`[data-notification-id="${id}"]`);
    if (!item) return;
    item.classList.add("is-leaving");
    window.setTimeout(() => item.remove(), 180);
  };
  const notify = ({ title = "Готово", message = "", type = "info", duration = defaults[type] ?? defaults.info } = {}) => {
    const id = crypto.randomUUID();
    const close = element("button", { className: "notification-close", text: "×", attrs: { type: "button", "aria-label": "Закрыть уведомление" } });
    const item = element("article", { className: `notification notification-${type}`, dataset: { notificationId: id }, attrs: { role: type === "error" ? "alert" : "status" } }, [
      element("span", { className: "notification-icon", text: icons[type] || icons.info, attrs: { "aria-hidden": "true" } }),
      element("div", { className: "notification-copy" }, [element("strong", { text: title }), message ? element("span", { text: message }) : null]),
      close,
    ]);
    close.addEventListener("click", () => dismiss(id));
    root.append(item);
    requestAnimationFrame(() => item.classList.add("is-visible"));
    while (root.children.length > 4) {
      const oldest = root.firstElementChild;
      if (!oldest) break;
      const oldestId = oldest.dataset.notificationId;
      if (oldestId) clearTimeout(timers.get(oldestId));
      if (oldestId) timers.delete(oldestId);
      oldest.remove();
    }
    if (duration > 0) timers.set(id, window.setTimeout(() => dismiss(id), duration));
    return id;
  };
  return { notify, destroy() { timers.forEach((timer) => clearTimeout(timer)); timers.clear(); root.replaceChildren(); } };
}
