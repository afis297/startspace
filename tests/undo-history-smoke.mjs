import assert from "node:assert/strict";
import { createUndoHistory } from "../src/app/undo-history.js";

const notices = [];
const history = createUndoHistory({ notify: (notice) => notices.push(notice) });
const state = { value: "после" };
const command = {
  label: "Перемещение «Погода»",
  undo() { state.value = "до"; },
  redo() { state.value = "после"; },
};

assert.equal(history.record(command), true, "история должна принять завершённое действие");
assert.equal(history.undo(), true, "действие должно отменяться");
assert.equal(state.value, "до", "undo должен применить предыдущее состояние");
assert.deepEqual(notices.at(-1), {
  title: "Отменено: Перемещение «Погода»",
  message: "Действие можно повторить сочетанием Ctrl+Shift+Z или Ctrl+Y.",
  type: "info",
}, "тост отмены должен явно называть отменённое действие");

assert.equal(history.redo(), true, "действие должно повторяться");
assert.equal(state.value, "после", "redo должен восстановить новое состояние");
assert.deepEqual(notices.at(-1), {
  title: "Повторено: Перемещение «Погода»",
  message: "Действие снова применено.",
  type: "info",
}, "тост повтора должен явно называть повторённое действие");

console.log("undo-history-smoke: passed");
