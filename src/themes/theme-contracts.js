const CONSOLE_THEME_IDS = new Set([
  "green-console",
  "color-blue",
  "color-cyan",
  "color-orange",
  "color-violet",
  "color-red",
  "color-yellow",
  "color-pink",
]);

/**
 * Describes visual behaviour only. Geometry must never depend on this contract.
 * Palette values remain the responsibility of theme presets.
 */
export function getThemeContract(themeId) {
  const id = String(themeId || "midnight");
  const consoleFamily = CONSOLE_THEME_IDS.has(id);

  return Object.freeze({
    family: consoleFamily ? "console" : "classic",
    treatment: id === "midnight" ? "flat" : (consoleFamily ? "signal" : "soft"),
  });
}

export function isConsoleTheme(themeId) {
  return getThemeContract(themeId).family === "console";
}

export const THEME_FAMILIES = Object.freeze(["classic", "console"]);
export const THEME_TREATMENTS = Object.freeze(["flat", "soft", "signal"]);
