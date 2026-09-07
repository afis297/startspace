export function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  const {
    className, text, attrs = {}, dataset = {}, on = {}, value, checked, title,
  } = options;
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (value !== undefined) node.value = value;
  if (checked !== undefined) node.checked = Boolean(checked);
  if (title) node.title = title;
  Object.entries(attrs).forEach(([name, attrValue]) => {
    if (attrValue !== undefined && attrValue !== null) node.setAttribute(name, String(attrValue));
  });
  Object.entries(dataset).forEach(([name, dataValue]) => { node.dataset[name] = String(dataValue); });
  Object.entries(on).forEach(([event, listener]) => node.addEventListener(event, listener));
  const items = Array.isArray(children) ? children : [children];
  items.filter(Boolean).forEach((child) => node.append(child instanceof Node ? child : document.createTextNode(String(child))));
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function uid(prefix = "widget") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function formatDate(value, locale = "ru-RU", options = {}) {
  try { return new Intl.DateTimeFormat(locale, options).format(value); } catch { return ""; }
}
