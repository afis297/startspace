function validCommand(command) {
  return command
    && typeof command.undo === "function"
    && typeof command.redo === "function";
}

/**
 * Session-only undo/redo stack. Commands are registered only after a completed
 * user operation, so drag previews and animation frames never flood history.
 */
export function createUndoHistory({ limit = 40, notify = () => {} } = {}) {
  const capacity = Math.max(1, Math.floor(Number(limit) || 40));
  const undoStack = [];
  const redoStack = [];

  const announce = (title, message, type = "info") => notify({ title, message, type });
  const commandLabel = (command, fallback) => command?.label || fallback;
  const reportFailure = (operation, command, error) => {
    console.warn(`Не удалось ${operation} действие истории.`, error);
    announce(
      operation === "отменить" ? "Не удалось отменить действие" : "Не удалось повторить действие",
      `${commandLabel(command, "Изменение виджета")}. Состояние не изменено; можно попробовать ещё раз.`,
      "warning",
    );
  };

  return Object.freeze({
    record(command) {
      if (!validCommand(command)) return false;
      undoStack.push(command);
      if (undoStack.length > capacity) undoStack.splice(0, undoStack.length - capacity);
      redoStack.length = 0;
      return true;
    },
    undo() {
      const command = undoStack.pop();
      if (!command) return false;
      try {
        command.undo();
      } catch (error) {
        undoStack.push(command);
        reportFailure("отменить", command, error);
        return false;
      }
      redoStack.push(command);
      announce(
        `Отменено: ${commandLabel(command, "Последнее изменение виджета")}`,
        "Действие можно повторить сочетанием Ctrl+Shift+Z или Ctrl+Y.",
      );
      return true;
    },
    redo() {
      const command = redoStack.pop();
      if (!command) return false;
      try {
        command.redo();
      } catch (error) {
        redoStack.push(command);
        reportFailure("повторить", command, error);
        return false;
      }
      undoStack.push(command);
      announce(
        `Повторено: ${commandLabel(command, "Изменение виджета")}`,
        "Действие снова применено.",
      );
      return true;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  });
}
