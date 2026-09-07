export const STANDARD_WIDGET_PACKS = Object.freeze([
  Object.freeze({
    id: "daily",
    title: "На каждый день",
    description: "Часы, календарь, задачи и заметка.",
    icon: "calendar",
    types: Object.freeze(["clock", "calendar", "todo", "note"]),
  }),
  Object.freeze({
    id: "information",
    title: "Информация",
    description: "Погода, курсы валют и переводчик.",
    icon: "weather",
    types: Object.freeze(["weather", "currency", "translator"]),
  }),
  Object.freeze({
    id: "tools",
    title: "Инструменты",
    description: "Калькулятор, пароли, таймер и секундомер.",
    icon: "calculator",
    types: Object.freeze(["calculator", "password-generator", "focus-timer", "timer"]),
  }),
  Object.freeze({
    id: "study",
    title: "Учёба",
    description: "Фокус, задачи, заметки, календарь и переводчик.",
    icon: "note",
    types: Object.freeze(["focus-timer", "todo", "note", "calendar", "translator"]),
  }),
  Object.freeze({
    id: "work",
    title: "Работа",
    description: "Задачи, календарь, заметки, поиск и курсы валют.",
    icon: "task",
    types: Object.freeze(["todo", "calendar", "note", "search", "currency"]),
  }),
  Object.freeze({
    id: "rest",
    title: "Отдых",
    description: "Звуки отдыха, управление воспроизведением, цитата и змейка.",
    icon: "rest",
    types: Object.freeze(["rest", "browser-media", "quote", "snake"]),
  }),
]);

export function getWidgetPack(id) {
  return STANDARD_WIDGET_PACKS.find((pack) => pack.id === id) || null;
}

export function uniquePackTypes(pack) {
  return [...new Set(pack?.types || [])];
}
