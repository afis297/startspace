export const THEME_VARIABLES = [
  "--bg-0", "--bg-1", "--surface", "--surface-strong", "--surface-hover", "--text", "--muted", "--line", "--accent", "--accent-contrast", "--danger", "--shadow", "--wallpaper-fallback",
];

export const themePresets = [
  {
    id: "midnight",
    name: "Полночный синий",
    description: "Холодный графит и единый синий акцент без тёплых оттенков.",
    colors: {
      "--bg-0": "#090d16", "--bg-1": "#111827", "--surface": "rgb(15 23 42 / 95%)", "--surface-strong": "#121b2e", "--surface-hover": "#1a2740", "--text": "#d9e5ff", "--muted": "#9ab1da", "--line": "rgb(96 165 250 / 23%)", "--accent": "#2d8cff", "--accent-contrast": "#071018", "--danger": "#ff7186", "--shadow": "rgb(0 0 0 / 52%)", "--wallpaper-fallback": "radial-gradient(circle at 82% 8%, rgb(45 140 255 / 12%), transparent 28%), linear-gradient(145deg, #090d16, #121b2e)",
    },
  },
  {
    id: "paper",
    name: "Тёплый пергамент",
    description: "Тёплая бумага с графитово‑терракотовым акцентом.",
    colors: {
      "--bg-0": "#ece6da", "--bg-1": "#f6f1e8", "--surface": "rgb(253 250 243 / 95%)", "--surface-strong": "#faf5ec", "--surface-hover": "#e7ded0", "--text": "#292720", "--muted": "#68645b", "--line": "rgb(53 49 42 / 18%)", "--accent": "#8a5a43", "--accent-contrast": "#ffffff", "--danger": "#a84349", "--shadow": "rgb(65 53 37 / 15%)", "--wallpaper-fallback": "linear-gradient(135deg, #f5f0e7, #ddd4c5)",
    },
  },
  {
    id: "green-console",
    name: "Зелёный терминал",
    description: "Чёрные поверхности, кислотно‑зелёные контуры и текст.",
    colors: {
      "--bg-0": "#000000", "--bg-1": "#000000", "--surface": "rgb(0 0 0 / 100%)", "--surface-strong": "#000000", "--surface-hover": "#001906", "--text": "#70ff92", "--muted": "#00b92f", "--line": "#008f24", "--accent": "#00ff41", "--accent-contrast": "#000000", "--danger": "#ff737d", "--shadow": "rgb(0 0 0 / 88%)", "--wallpaper-fallback": "#000000",
    },
  },
  {
    id: "forest",
    name: "Хвойная ночь",
    description: "Хвойная глубина и живой травяной акцент.",
    colors: {
      "--bg-0": "#111b14", "--bg-1": "#1c2a20", "--surface": "rgb(28 42 32 / 94%)", "--surface-strong": "#203126", "--surface-hover": "#2c4030", "--text": "#eff3ea", "--muted": "#aab7a6", "--line": "rgb(222 239 222 / 15%)", "--accent": "#a9c86b", "--accent-contrast": "#17210f", "--danger": "#e78678", "--shadow": "rgb(5 13 8 / 44%)", "--wallpaper-fallback": "radial-gradient(circle at 74% 10%, rgb(169 200 107 / 9%), transparent 26%), linear-gradient(150deg, #132016, #26372a)",
    },
  },
  {
    id: "ocean",
    name: "Глубокий океан",
    description: "Холодная морская глубина с чистой бирюзой.",
    colors: {
      "--bg-0": "#0d1d25", "--bg-1": "#17313a", "--surface": "rgb(24 50 59 / 94%)", "--surface-strong": "#1d3c45", "--surface-hover": "#274e57", "--text": "#edf7f5", "--muted": "#b0c6c5", "--line": "rgb(218 241 238 / 15%)", "--accent": "#72d0c1", "--accent-contrast": "#092724", "--danger": "#f08b82", "--shadow": "rgb(3 13 17 / 45%)", "--wallpaper-fallback": "radial-gradient(circle at 80% 7%, rgb(114 208 193 / 9%), transparent 27%), linear-gradient(145deg, #102630, #24424b)",
    },
  },
  {
    id: "violet",
    name: "Фиолетовые сумерки",
    description: "Пыльная слива, глубокая тень и мягкий лиловый сигнал.",
    colors: {
      "--bg-0": "#201927", "--bg-1": "#2b2134", "--surface": "rgb(43 33 52 / 94%)", "--surface-strong": "#35263e", "--surface-hover": "#46324f", "--text": "#f4eff4", "--muted": "#c6b8c6", "--line": "rgb(245 233 246 / 15%)", "--accent": "#d7a8d6", "--accent-contrast": "#2a1d30", "--danger": "#e9829e", "--shadow": "rgb(12 6 16 / 46%)", "--wallpaper-fallback": "radial-gradient(circle at 77% 8%, rgb(215 168 214 / 8%), transparent 27%), linear-gradient(145deg, #231a2b, #3a2a44)",
    },
  },
  {
    id: "ember",
    name: "Медный уголь",
    description: "Тёмный уголь, медь и мягкое тепло живого огня.",
    colors: {
      "--bg-0": "#211612", "--bg-1": "#302019", "--surface": "rgb(52 35 28 / 95%)", "--surface-strong": "#3c2820", "--surface-hover": "#503429", "--text": "#f8eee6", "--muted": "#ceb7a6", "--line": "rgb(249 228 211 / 15%)", "--accent": "#e0a167", "--accent-contrast": "#301d0d", "--danger": "#eb8072", "--shadow": "rgb(22 9 5 / 46%)", "--wallpaper-fallback": "radial-gradient(circle at 78% 8%, rgb(224 161 103 / 9%), transparent 27%), linear-gradient(145deg, #261914, #493026)",
    },
  },
];


const createColorTheme = (id, name, description, accent, text, contrast = "#071018") => ({
  id,
  name,
  description,
  colors: {
    "--bg-0": "#000000", "--bg-1": "#000000", "--surface": "#000000",
    "--surface-strong": "#000000", "--surface-hover": "#090909", "--text": text,
    "--muted": "#9aa1aa", "--line": accent, "--accent": accent, "--accent-contrast": contrast, "--danger": "#ff5c70", "--shadow": "rgb(0 0 0 / 42%)",
    "--wallpaper-fallback": "#000000"
  }
});

themePresets.push(
  createColorTheme("color-blue", "\u0421\u0438\u043d\u0438\u0439 \u0441\u0438\u0433\u043d\u0430\u043b", "\u0425\u043e\u043b\u043e\u0434\u043d\u044b\u0439 \u0441\u0438\u043d\u0438\u0439 \u0430\u043a\u0446\u0435\u043d\u0442.", "#2d8cff", "#d8eaff"),
  createColorTheme("color-cyan", "\u041b\u0430\u0437\u0443\u0440\u043d\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b", "\u042f\u0440\u043a\u0438\u0439 \u0433\u043e\u043b\u0443\u0431\u043e\u0439 \u0441\u0438\u0433\u043d\u0430\u043b.", "#00d9ff", "#d4f8ff"),
  createColorTheme("color-orange", "\u041e\u0440\u0430\u043d\u0436\u0435\u0432\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b", "\u0422\u0451\u043f\u043b\u044b\u0439 \u043e\u0440\u0430\u043d\u0436\u0435\u0432\u044b\u0439 \u0430\u043a\u0446\u0435\u043d\u0442.", "#ff862f", "#ffe0c7"),
  createColorTheme("color-violet", "\u0424\u0438\u043e\u043b\u0435\u0442\u043e\u0432\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b", "\u0413\u043b\u0443\u0431\u043e\u043a\u0438\u0439 \u0444\u0438\u043e\u043b\u0435\u0442\u043e\u0432\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b.", "#963ae6", "#f0dcff", "#ffffff"),
  createColorTheme("color-red", "\u041a\u0440\u0430\u0441\u043d\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b", "\u041a\u043e\u043d\u0442\u0440\u0430\u0441\u0442\u043d\u044b\u0439 \u043a\u0440\u0430\u0441\u043d\u044b\u0439 \u0430\u043a\u0446\u0435\u043d\u0442.", "#ff3b5b", "#ffd8df"),
  createColorTheme("color-yellow", "\u0416\u0451\u043b\u0442\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b", "\u042f\u0441\u043d\u044b\u0439 \u0436\u0451\u043b\u0442\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b.", "#f5d542", "#fff3b5"),
  createColorTheme("color-pink", "\u0420\u043e\u0437\u043e\u0432\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b", "\u041c\u044f\u0433\u043a\u0438\u0439 \u0440\u043e\u0437\u043e\u0432\u044b\u0439 \u0430\u043a\u0446\u0435\u043d\u0442.", "#ff4fa6", "#ffd8ee")
);
const THEME_ORDER = [
  "midnight", "forest", "ocean", "violet", "ember", "paper", "green-console",
  "color-blue", "color-cyan", "color-violet", "color-pink", "color-red", "color-orange", "color-yellow",
];

themePresets.sort((left, right) => THEME_ORDER.indexOf(left.id) - THEME_ORDER.indexOf(right.id));

export const getPreset = (id) => themePresets.find((theme) => theme.id === id) || themePresets[0];
