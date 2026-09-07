const svgNamespace = "http://www.w3.org/2000/svg";

const shapes = {
  add: [["path", { d: "M12 5v14M5 12h14" }]],
  close: [["path", { d: "M6 6l12 12M18 6L6 18" }]],
  minus: [["path", { d: "M5 12h14" }]],
  settings: [["circle", { cx: "12", cy: "12", r: "3" }], ["path", { d: "M19 12a7 7 0 0 0-.08-1l2-1.55-2-3.46-2.35.95a7.1 7.1 0 0 0-1.72-1L14.5 3h-5l-.35 2.94a7.1 7.1 0 0 0-1.72 1L5.08 6 3.08 9.46 5 11a7 7 0 0 0 0 2l-1.92 1.55L5.08 18l2.35-.95a7.1 7.1 0 0 0 1.72 1L9.5 21h5l.35-2.95a7.1 7.1 0 0 0 1.72-1l2.35.95 2-3.45L18.92 13c.05-.33.08-.66.08-1Z" }]],
  duplicate: [["rect", { x: "8", y: "8", width: "10", height: "10", rx: "1" }], ["path", { d: "M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" }]],
  pin: [["path", { d: "M8 4h8M9 4v5l-2 3h10l-2-3V4M12 12v8" }]],
  grip: [["circle", { cx: "9", cy: "7", r: "1" }], ["circle", { cx: "15", cy: "7", r: "1" }], ["circle", { cx: "9", cy: "12", r: "1" }], ["circle", { cx: "15", cy: "12", r: "1" }], ["circle", { cx: "9", cy: "17", r: "1" }], ["circle", { cx: "15", cy: "17", r: "1" }]],
  resize: [["path", { d: "M8 20h12V8M20 14l-6 6M20 19l-1 1" }]],
  chevronLeft: [["path", { d: "m14 6-6 6 6 6" }]],
  chevronRight: [["path", { d: "m10 6 6 6-6 6" }]],
  chevronUp: [["path", { d: "m6 14 6-6 6 6" }]],
  chevronDown: [["path", { d: "m6 10 6 6 6-6" }]],
  search: [["circle", { cx: "10.5", cy: "10.5", r: "5.5" }], ["path", { d: "m15 15 4 4" }]],
  clock: [["circle", { cx: "12", cy: "12", r: "8" }], ["path", { d: "M12 7v5l3.5 2" }]],
  calendar: [["rect", { x: "4", y: "5", width: "16", height: "15", rx: "1" }], ["path", { d: "M8 3v4M16 3v4M4 10h16" }]],
  calculator: [["rect", { x: "5", y: "3", width: "14", height: "18", rx: "1" }], ["path", { d: "M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" }]],
  note: [["path", { d: "M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h4" }]],
  lock: [["rect", { x: "5", y: "10", width: "14", height: "10", rx: "2" }], ["path", { d: "M8 10V7a4 4 0 0 1 8 0v3M12 14v2" }]],
  task: [["rect", { x: "4", y: "5", width: "16", height: "15", rx: "1" }], ["path", { d: "m8 12 2.5 2.5L16 9" }]],
  quote: [["path", { d: "M8.5 8H6.8A2.8 2.8 0 0 0 4 10.8V15h4.5v-4H6.7V10.8c0-.6.5-1 1.1-1h.7ZM19 8h-1.8a2.8 2.8 0 0 0-2.7 2.8V15H19v-4h-1.8v-.2c0-.6.5-1 1.1-1h.7Z" }]],
  snake: [["path", { d: "M5 8h7a3 3 0 1 1 0 6H9a3 3 0 1 0 0 6h8" }], ["circle", { cx: "18", cy: "20", r: "1" }]],
  weather: [["circle", { cx: "12", cy: "12", r: "3.5" }], ["path", { d: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" }]],
  cloud: [["path", { d: "M6.2 18h10.1a3.7 3.7 0 0 0 .3-7.4A5.1 5.1 0 0 0 7 9.3 4.3 4.3 0 0 0 6.2 18Z" }]],
  rain: [["path", { d: "M6.2 15h10.1a3.7 3.7 0 0 0 .3-7.4A5.1 5.1 0 0 0 7 6.3 4.3 4.3 0 0 0 6.2 15Z" }], ["path", { d: "m8 18-1 2m5-2-1 2m5-2-1 2" }]],
  snow: [["path", { d: "M6.2 14h10.1a3.7 3.7 0 0 0 .3-7.4A5.1 5.1 0 0 0 7 5.3 4.3 4.3 0 0 0 6.2 14Z" }], ["path", { d: "M8 18h.01M12 20h.01M16 18h.01" }]],
  bolt: [["path", { d: "M13 2 6 13h5l-1 9 7-11h-5z" }]],
  currency: [["path", { d: "M5 8h11l-2.5-2.5M19 16H8l2.5 2.5M16 8l2.5 2.5M8 16l-2.5-2.5" }]],
  translate: [["path", { d: "M4 5h8M8 3v2m-3 0c.7 3.6 2.4 6.3 5 8M5 15h7M15 8l5 11m-3.8-3h5.6" }]],
  timer: [["circle", { cx: "12", cy: "13", r: "7" }], ["path", { d: "M9 3h6M12 6v2M12 13l3 2" }]],
  temperature: [["path", { d: "M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0ZM12 9v7" }]],
  arrowSwap: [["path", { d: "M5 8h12l-3-3M19 16H7l3 3" }]],
  play: [["path", { d: "m9 6 8 6-8 6Z" }]],
  pause: [["path", { d: "M9 6v12M15 6v12" }]],
  skipBack: [["path", { d: "M7 6v12" }], ["path", { d: "m17 6-6 6 6 6" }]],
  skipForward: [["path", { d: "M17 6v12" }], ["path", { d: "m7 6 6 6-6 6" }]],
  volume: [["path", { d: "M5 10h4l5-4v12l-5-4H5z" }], ["path", { d: "M17 9.5a4 4 0 0 1 0 5" }], ["path", { d: "M19.5 7a7.5 7.5 0 0 1 0 10" }]],
  volumeOff: [["path", { d: "M5 10h4l5-4v12l-5-4H5z" }], ["path", { d: "m17 10 4 4m0-4-4 4" }]],
  external: [["path", { d: "M14 5h5v5M19 5l-8 8" }], ["path", { d: "M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" }]],
  rest: [["path", { d: "M7 16.5A7 7 0 0 0 16.5 7 6.2 6.2 0 1 1 7 16.5Z" }], ["path", { d: "M15.5 4.5v3M14 6h3" }]],
  eye: [["path", { d: "M3.5 12s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5Z" }], ["circle", { cx: "12", cy: "12", r: "2.2" }]],
  eyeOff: [["path", { d: "M3.5 12s3.1-5 8.5-5c1.5 0 2.8.38 3.9.94M20.5 12s-3.1 5-8.5 5c-1.5 0-2.8-.38-3.9-.94" }], ["path", { d: "m4 4 16 16" }]],
  rss: [["circle", { cx: "6", cy: "18", r: "1.2" }], ["path", { d: "M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" }]],
  system: [["rect", { x: "4", y: "5", width: "16", height: "14", rx: "1" }], ["path", { d: "M8 15h2v-3h2v3h2v-5h2M8 3v2M16 3v2M8 19v2M16 19v2" }]],
};

export function createLineIcon(name, { size = 16, className = "", label = "" } = {}) {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", `line-icon ${className}`.trim());
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", label ? "false" : "true");
  if (label) svg.setAttribute("aria-label", label);
  (shapes[name] || shapes.note).forEach(([tag, attributes]) => {
    const node = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes).forEach(([attribute, value]) => node.setAttribute(attribute, value));
    svg.append(node);
  });
  return svg;
}

export function weatherIconName(code) {
  const value = Number(code);
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(value)) return "snow";
  if ([95, 96, 99].includes(value)) return "bolt";
  if ([1, 2, 3, 45, 48].includes(value)) return "cloud";
  return "weather";
}

export function iconNameForWidget(type) {
  const names = { clock: "clock", weather: "weather", currency: "currency", todo: "task", timer: "timer", "focus-timer": "timer", "browser-media": "play", translator: "translate", calculator: "calculator", calendar: "calendar", quote: "quote", player: "play", rest: "rest", note: "note", snake: "snake", search: "search", countdown: "timer", link: "note", random: "calculator", "password-generator": "lock", game: "calculator" };
  return names[type] || "note";
}
