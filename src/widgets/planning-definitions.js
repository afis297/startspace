import { clear, element } from "../ui/dom.js";
import { createLineIcon } from "../ui/icons.js";

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function domainFor(value) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "Ссылка"; }
}

function linkId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizedLinks(value) {
  const input = Array.isArray(value) ? value : [];
  return input.map((item) => {
    const url = safeHttpUrl(item?.url);
    if (!url) return null;
    return {
      id: String(item?.id || linkId()),
      label: String(item?.label || domainFor(url)).trim().slice(0, 48) || domainFor(url),
      url,
    };
  }).filter(Boolean).slice(0, 18);
}

function linksFromText(value) {
  if (typeof value !== "string") return [];
  return value.split(/\r?\n/).map((line, index) => {
    const [label, url] = line.split("|").map((part) => String(part || "").trim());
    return label && url ? { id: `custom-${index}`, label, url } : null;
  }).filter(Boolean);
}

const legacyStarterLinks = [
  ["Google", "https://www.google.com/"],
  ["YouTube", "https://www.youtube.com/"],
  ["GitHub", "https://github.com/"],
  ["Календарь", "https://calendar.google.com/"],
];

function isLegacyStarterSet(links) {
  return links.length === legacyStarterLinks.length && links.every((link, index) => {
    const [label, url] = legacyStarterLinks[index];
    return link.label === label && link.url === url;
  });
}

function quickLinksConfig(config = {}) {
  const textLinks = linksFromText(config.linksText);
  const candidateLinks = normalizedLinks(textLinks.length ? textLinks : config.links);
  const savedLinks = isLegacyStarterSet(candidateLinks) ? [] : candidateLinks;
  return { links: savedLinks, showDomain: config.showDomain !== false };
}

function renderQuickLinks(root) {
  const state = root.__quickLinksState;
  const config = quickLinksConfig(state.config);
  const maxLinks = 18;
  const overview = element("div", { className: "quick-links-overview" }, [
    element("span", { className: "quick-links-eyebrow", text: "Сохранённые маршруты" }),
    element("span", { className: "quick-links-count", text: `${config.links.length} / ${maxLinks}`, attrs: { title: "Количество сохранённых ссылок" } }),
  ]);
  const grid = element("div", { className: "quick-links-grid", attrs: { role: "list", "aria-label": "Быстрые ссылки" } });

  if (!config.links.length) {
    grid.append(element("div", { className: "quick-links-empty" }, [
      element("span", { className: "quick-links-empty-index", text: "00", attrs: { "aria-hidden": "true" } }),
      element("span", { className: "quick-links-empty-copy" }, [
        element("strong", { text: "Ссылок пока нет" }),
        element("small", { text: "Добавьте их в свойствах виджета" }),
      ]),
    ]));
  }

  config.links.forEach((link, index) => {
    const open = element("button", {
      className: "quick-link-open",
      attrs: { type: "button", title: `Открыть ${link.label}` },
      on: { click: () => window.open(link.url, "_blank", "noopener,noreferrer") },
    }, [
      element("span", { className: "quick-link-order", text: String(index + 1).padStart(2, "0"), attrs: { "aria-hidden": "true" } }),
      element("span", { className: "quick-link-mark", text: link.label.slice(0, 1).toUpperCase(), attrs: { "aria-hidden": "true" } }),
      element("span", { className: "quick-link-copy" }, [
        element("strong", { text: link.label }),
        ...(config.showDomain ? [element("small", { text: domainFor(link.url) })] : []),
      ]),
      element("span", { className: "quick-link-open-icon", attrs: { "aria-hidden": "true" } }, [createLineIcon("external-link", { size: 14 })]),
    ]);
    grid.append(element("article", { className: "quick-link-item", attrs: { role: "listitem" } }, [open]));
  });

  clear(root);
  root.append(overview, grid);
}

function createQuickLinks(widget, context) {
  const root = element("section", { className: "quick-links-widget widget-fill" });
  root.__quickLinksState = { widgetId: widget.id, context, config: widget.config || {} };
  renderQuickLinks(root);
  return root;
}

function updateQuickLinks(root, widget, context) {
  root.__quickLinksState = { widgetId: widget.id, context, config: widget.config || {} };
  renderQuickLinks(root);
}

export const planningDefinitions = [
  {
    type: "bookmarks",
    title: "Быстрые ссылки",
    icon: "link",
    category: "Планирование",
    accent: "#d6b266",
    defaultSize: { w: 370, h: 330 },
    defaultConfig: {
      links: [],
      linksText: "",
      showDomain: true,
    },
    properties: [
      { key: "showDomain", label: "Показывать домен", section: "Вид", type: "toggle", default: true },
      { key: "linksText", label: "Ссылки", section: "Содержимое", type: "textarea", maxLength: 4000, default: "", placeholder: "Google | https://google.com\nGitHub | https://github.com", hint: "Добавляйте по одной ссылке на строку: Название | HTTPS-адрес. Список в виджете предназначен только для открытия ссылок." },
    ],
    create: createQuickLinks,
    update: updateQuickLinks,
  },
];
