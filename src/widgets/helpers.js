import { clear, element, safeUrl } from "../ui/dom.js";

export function currentWidget(context, id) {
  return context.store.getState().widgets.find((widget) => widget.id === id);
}

export function currentConfig(context, id) {
  return currentWidget(context, id)?.config || {};
}

export function beginRequest(root, key) {
  root[key] = Number(root[key] || 0) + 1;
  return root[key];
}

export function isCurrentRequest(context, id, root, key, request) {
  return root?.[key] === request && Boolean(currentWidget(context, id));
}

export function patchConfig(context, id, patch, reason = "widget-content") {
  const widget = currentWidget(context, id);
  if (!widget) return;
  context.store.updateWidget(id, { config: { ...widget.config, ...patch } }, reason);
}

export function patchWidget(context, id, patch, reason = "widget-content") {
  context.store.updateWidget(id, patch, reason);
}

export function setStatus(root, message, kind = "muted") {
  const status = root.querySelector("[data-role='status']");
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

export function renderEmpty(root, message) {
  clear(root).append(element("p", { className: "widget-empty", text: message }));
}

export function openSafeLink(value) {
  const url = safeUrl(value);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

export function disposeTimer(root) {
  if (root.__timer) clearInterval(root.__timer);
  root.__timer = null;
}
