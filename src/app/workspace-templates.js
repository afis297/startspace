import { getWidgetPack, uniquePackTypes } from "../ui/widget-packs.js";

const emptyTemplate = Object.freeze({
  id: "empty",
  title: "Пустое пространство",
  description: "Чистый рабочий стол для собственной раскладки.",
  types: Object.freeze([]),
});

const fromPack = (id) => {
  const pack = getWidgetPack(id);
  if (!pack) throw new Error(`Не найден набор виджетов для шаблона: ${id}.`);
  return Object.freeze({
    id: pack.id,
    title: pack.title,
    description: pack.description,
    types: Object.freeze(uniquePackTypes(pack)),
  });
};

/** Recommended, editable starts for a new independent workspace. */
export const WORKSPACE_TEMPLATES = Object.freeze([
  emptyTemplate,
  fromPack("work"),
  fromPack("study"),
  fromPack("rest"),
]);

export function getWorkspaceTemplate(id) {
  return WORKSPACE_TEMPLATES.find((template) => template.id === id) || emptyTemplate;
}
