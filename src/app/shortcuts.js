export function isEditableShortcutTarget(target) {
  return typeof Element !== "undefined"
    && target instanceof Element
    && Boolean(target.closest("input, textarea, select, [contenteditable='true']") || target.isContentEditable);
}

export function routeGlobalShortcut(event, { workspaceManager, closePanels, toggleWidgetsVisibility, openCommandPalette, undo, redo }) {
  if (event.defaultPrevented || event.isComposing) return false;
  const editableTarget = isEditableShortcutTarget(event.target);
  const shortcut = /^Digit([1-9])$/.exec(event.code) || /^Numpad([1-9])$/.exec(event.code);

  if (!editableTarget && (event.ctrlKey || event.metaKey) && !event.altKey && event.code === "KeyZ") {
    const handled = event.shiftKey ? redo?.() : undo?.();
    if (handled) event.preventDefault();
    return Boolean(handled);
  }

  if (!editableTarget && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === "KeyY") {
    const handled = redo?.();
    if (handled) event.preventDefault();
    return Boolean(handled);
  }

  if (!editableTarget && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === "KeyK") {
    event.preventDefault();
    openCommandPalette?.();
    return true;
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !editableTarget && shortcut) {
    const index = Number(shortcut[1]) - 1;
    if (workspaceManager.getSnapshot().layouts[index]) {
      event.preventDefault();
      workspaceManager.switchTo(index);
      return true;
    }
  }

  if (!editableTarget && event.key === "Escape") {
    closePanels();
    return true;
  }

  if (!editableTarget && event.ctrlKey && event.shiftKey && !event.altKey && event.code === "KeyH") {
    event.preventDefault();
    toggleWidgetsVisibility();
    return true;
  }

  return false;
}
