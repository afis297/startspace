import { element } from "../ui/dom.js";
import { patchConfig } from "./helpers.js";
import { createLineIcon } from "../ui/icons.js";

export const searchEngines = [
  { value: "google", label: "Google", endpoint: "https://www.google.com/search?q=" },
  { value: "yandex", label: "Яндекс", endpoint: "https://yandex.ru/search/?text=" },
  { value: "duckduckgo", label: "DuckDuckGo", endpoint: "https://duckduckgo.com/?q=" },
  { value: "bing", label: "Bing", endpoint: "https://www.bing.com/search?q=" },
  { value: "brave", label: "Brave Search", endpoint: "https://search.brave.com/search?q=" },
];

function getConfig(context, id) {
  return context.store.getState().widgets.find((widget) => widget.id === id)?.config || {};
}

function engineById(value) {
  return searchEngines.find((engine) => engine.value === value) || searchEngines[0];
}

function runSearch(context, id, root) {
  const input = root.querySelector("[data-role='query']");
  const config = getConfig(context, id);
  const preferences = context.store.getState().settings.search || {};
  const query = input.value.trim();
  patchConfig(context, id, { query });
  if (!query) { input.focus(); return; }
  const engine = engineById(preferences.defaultEngine);
  const openInNewTab = config.openInNewTab === "new" ? true : config.openInNewTab === "current" ? false : Boolean(preferences.openInNewTab ?? true);
  const url = `${engine.endpoint}${encodeURIComponent(query)}`;
  if (openInNewTab) window.open(url, "_blank", "noopener,noreferrer");
  else window.location.assign(url);
}

function createSearch(widget, context) {
  const input = element("input", { className: "search-input", attrs: { type: "search", placeholder: "Найти в интернете", maxlength: "240", "data-role": "query", "aria-label": "Поисковый запрос" } });
  const button = element("button", { className: "search-submit", attrs: { type: "submit", "aria-label": "Искать" } }, [createLineIcon("search", { size: 18 })]);
  const form = element("form", { className: "search-form", on: { submit: (event) => { event.preventDefault(); runSearch(context, widget.id, form); } } }, [input, button]);
  input.addEventListener("input", () => patchConfig(context, widget.id, { query: input.value }, "search-query"));
  return element("div", { className: "search-widget widget-fill" }, [form]);
}

function updateSearch(root, widget, context) {
  const config = widget.config || {};
  const input = root.querySelector("[data-role='query']");
  if (document.activeElement !== input) input.value = String(config.query || "");
}

export const searchDefinition = {
  type: "search",
  title: "Поиск",
  icon: "search",
  category: "Инструменты",
  accent: "#d9b45f",
  defaultSize: { w: 380, h: 170 },
  excludedCommonProperties: ["fontScale"],
  defaultConfig: { openInNewTab: "default", query: "" },
  properties: [
    { key: "openInNewTab", label: "Открывать результаты", section: "Поведение", type: "select", default: "default", options: [{ value: "default", label: "Как в настройках" }, { value: "new", label: "В новой вкладке" }, { value: "current", label: "В текущей вкладке" }] },
  ],
  create: createSearch,
  update: updateSearch,
};
