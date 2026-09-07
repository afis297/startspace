import { clear, element } from "./dom.js";
import { themePresets } from "../themes/presets.js";
import { searchEngines } from "../widgets/search-definition.js";
import { downloadLayout, downloadWebPanel, exportThemePack, exportUserPreferences, importThemePack, importUserPreferences, importWidget, readLayoutFile, readWebPanelFile } from "../app/backup-service.js";
import { createColorEditor } from "./color-editor.js";
import { createSelectMenu, disposeSelectMenus } from "./select-menu.js";
import { createLineIcon } from "./icons.js";
import { animatePanel } from "./motion.js";
import { getWidgetDiagnostics } from "../app/widget-diagnostics.js";
import { requestWidgetPermissions } from "../services/permissions.js";
import { ensureBrowserMediaPermission } from "../services/browser-media-controller.js";
import { callExtensionApi, getExtensionApi } from "../services/extension-api.js";

const customColors = [["--bg-0", "Основной фон"], ["--surface", "Поверхности"], ["--text", "Текст"], ["--accent", "Акцент"]];
const tabs = [["appearance", "Темы"], ["colors", "Мои цвета"], ["wallpaper", "Обои"], ["behavior", "Рабочий стол"], ["desktop", "Пространства"], ["web-panel", "Панель сайтов"], ["backup", "Перенос"], ["diagnostics", "Проверка"]];

const WALLPAPER_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_WALLPAPER_FILE_BYTES = 12 * 1024 * 1024;
const MAX_WALLPAPER_DATA_URL_LENGTH = 3_000_000;
const MAX_WALLPAPER_DIMENSION = 1600;
const WEB_PANEL_INJECTION_DIAGNOSTICS_KEY = "mfltWebPanelInjectionDiagnosticsV1";
const WEB_PANEL_CONTENT_DIAGNOSTICS_KEY = "mfltWebPanelContentDiagnosticsV1";
const WEB_PANEL_DATA_KEY = "mfltWebPanelDataV1";
const WEB_PANEL_WIDGET_CHOICES = [["clock", "Часы"], ["tasks", "Задачи"], ["note", "Заметка"], ["timer", "Таймер"], ["stopwatch", "Секундомер"], ["media", "Управление воспроизведением"], ["weather", "Погода"], ["translator", "Переводчик"], ["rest", "Отдых"]];

function canvasToDataUrl(canvas, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const finish = (value) => value ? resolve(value) : reject(new Error("Не удалось сжать изображение для обоев."));
    if (typeof canvas.toBlob !== "function") { finish(canvas.toDataURL("image/webp", quality)); return; }
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Не удалось сжать изображение для обоев.")); return; }
      const reader = new FileReader();
      reader.onload = () => finish(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось подготовить изображение для обоев."));
      reader.readAsDataURL(blob);
    }, "image/webp", quality);
  });
}

function readImageFile(file) {
  if (!file) return Promise.reject(new Error("Изображение не выбрано."));
  if (!WALLPAPER_TYPES.has(file.type)) return Promise.reject(new Error("Выберите PNG, JPEG, WEBP или GIF."));
  if (!file.size) return Promise.reject(new Error("Выбранный файл пустой."));
  if (file.size > MAX_WALLPAPER_FILE_BYTES) return Promise.reject(new Error("Изображение больше 12 МБ. Выберите более компактный файл."));
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();
    let released = false;
    const release = () => { if (!released) { released = true; URL.revokeObjectURL(sourceUrl); } };
    const fail = (error) => { release(); reject(error instanceof Error ? error : new Error("Не удалось подготовить изображение для обоев.")); };
    image.decoding = "async";
    image.onload = async () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) throw new Error("Не удалось определить размер изображения.");
        const canvas = document.createElement("canvas");
        const compressionSteps = [
          { maxDimension: MAX_WALLPAPER_DIMENSION, quality: 0.82 },
          { maxDimension: 1280, quality: 0.74 },
          { maxDimension: 1024, quality: 0.66 },
        ];
        let value = "";
        for (const step of compressionSteps) {
          const scale = Math.min(1, step.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Не удалось подготовить изображение для обоев.");
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          value = await canvasToDataUrl(canvas, step.quality);
          if (/^data:image\/(png|jpeg|webp);base64,/i.test(value) && value.length <= MAX_WALLPAPER_DATA_URL_LENGTH) break;
        }
        if (!/^data:image\/(png|jpeg|webp);base64,/i.test(value) || value.length > MAX_WALLPAPER_DATA_URL_LENGTH) throw new Error("Не удалось компактно сохранить изображение. Выберите файл меньшего размера.");
        release();
        resolve(value);
      } catch (error) { fail(error); }
    };
    image.onerror = () => fail(new Error("Не удалось открыть выбранное изображение."));
    image.src = sourceUrl;
  });
}

export function mountSettingsPanel({ root, store, registry, onClose, notify = () => {} }) {
  let activeTab = "appearance";
  const broadcastWebPanelSettings = (settings) => {
    const runtime = getExtensionApi()?.runtime;
    if (!runtime?.sendMessage) return;
    callExtensionApi(runtime.sendMessage, runtime, [{ type: "mflt-web-panel-settings-update", settings }]).catch(() => undefined);
  };
  const update = (patch, reason = "settings-panel") => {
    const nextState = store.updateSettings(patch, reason);
    if (patch?.webPanel) broadcastWebPanelSettings(nextState.settings);
    return nextState;
  };
  const updateWallpaper = (patch, reason = "wallpaper-change") => update({ wallpaper: { ...(store.getState().settings.wallpaper || {}), ...patch } }, reason);
  const selectTab = (tab) => { activeTab = tab; render(); };

  const createTabBar = () => {
    const nav = element("nav", { className: "settings-tabs", attrs: { "aria-label": "Разделы настроек" } });
    tabs.forEach(([id, label]) => nav.append(element("button", { className: `settings-tab${activeTab === id ? " is-active" : ""}`, text: label, attrs: { type: "button", "aria-current": activeTab === id ? "page" : "false" }, on: { click: () => selectTab(id) } })));
    return nav;
  };

  const createThemeTab = (settings) => {
    const section = element("section", { className: "settings-section" }, [element("h3", { text: "Тема" }), element("p", { className: "settings-copy", text: "Выберите готовую основу. Точные оттенки можно изменить во вкладке «Цвета»." })]);
    const grid = element("div", { className: "theme-grid" });
    themePresets.forEach((theme) => grid.append(element("button", { className: `theme-card${settings.themeId === theme.id ? " is-active" : ""}`, attrs: { type: "button", "aria-pressed": String(settings.themeId === theme.id) }, on: { click: () => update({ themeId: theme.id }, "theme-change") } }, [element("span", { className: "theme-swatch", attrs: { style: `background: ${theme.colors["--wallpaper-fallback"]}` } }), element("strong", { text: theme.name }), element("small", { text: theme.description })])));
    /* Theme swatch gradient contract. */
    grid.querySelectorAll(".theme-card").forEach((card, index) => {
      const swatch = card.querySelector(".theme-swatch");
      const palette = themePresets[index]?.colors || {};
      const color = palette["--accent"] || palette["--text"] || "#6f8eff";
      if (!swatch) return;
      card.style.setProperty("--theme-preview-color", color);
      swatch.style.setProperty("background", `linear-gradient(90deg, color-mix(in srgb, ${color} 32%, #05060a), color-mix(in srgb, ${color} 72%, #171220), color-mix(in srgb, ${color} 32%, #05060a))`, "important");
    });
    section.append(grid);
    return section;
  };

  const createColorsTab = (settings) => {
    const section = element("section", { className: "settings-section" }, [element("h3", { text: "Мои цвета" }), element("p", { className: "settings-copy", text: "Удерживайте курсор на цветовом поле и ведите его для непрерывного предпросмотра." })]);
    customColors.forEach(([key, label]) => {
      const value = settings.customTheme?.[key] || (key === "--text" ? "#f3f0e8" : key === "--accent" ? "#d9b45f" : key === "--surface" ? "#1b1e25" : "#101216");
      const field = element("div", { className: "property-field" }, [element("span", { text: label })]);
      field.append(createColorEditor({ label, value, fallback: value, onChange: (next) => update({ customTheme: { ...store.getState().settings.customTheme, [key]: next } }, "theme-color") }));
      section.append(field);
    });
    section.append(element("button", { className: "text-action", text: "Сбросить мои цвета", attrs: { type: "button" }, on: { click: () => update({ customTheme: {} }, "theme-reset") } }));
    return section;
  };

  const createWallpaperTab = (settings) => {
    const wallpaper = settings.wallpaper || {};
    const section = element("section", { className: "settings-section" }, [element("h3", { text: "Обои" }), element("p", { className: "settings-copy", text: "Разрешены PNG, JPEG, WEBP и GIF до 12 МБ. Файл оптимизируется перед сохранением." })]);
    const mode = createSelectMenu({
      value: wallpaper.mode || "gradient",
      options: [["gradient", "Градиент темы"], ["solid", "Сплошной цвет"], ["image", "Изображение"]].map(([value, label]) => ({ value, label })),
      ariaLabel: "Тип обоев",
      className: "settings-select-menu",
      onChange: (nextMode) => {
        const current = String(store.getState().settings.wallpaper?.value || "");
        updateWallpaper({ mode: nextMode, value: nextMode === "solid" ? (/^#[0-9a-f]{6}$/i.test(current) ? current : "#1b1e25") : nextMode === "gradient" ? "" : current });
      },
    });
    section.append(element("label", { className: "property-field" }, [element("span", { text: "Тип обоев" }), mode.root]));
    if (wallpaper.mode === "solid") {
      const value = /^#[0-9a-f]{6}$/i.test(wallpaper.value || "") ? wallpaper.value : "#1b1e25";
      const field = element("div", { className: "property-field" }, [element("span", { text: "Цвет" })]);
      field.append(createColorEditor({ label: "Цвет фона", value, fallback: "#1b1e25", onChange: (next) => updateWallpaper({ value: next }, "wallpaper-color") }));
      section.append(field);
    }
    if (wallpaper.mode === "image") {
      const url = element("input", { value: /^https?:\/\//i.test(wallpaper.value || "") ? wallpaper.value : "", attrs: { type: "url", placeholder: "https://example.com/wallpaper.jpg" } });
      url.addEventListener("change", () => updateWallpaper({ value: url.value.trim(), source: "url", fileName: "" }));
      const upload = element("input", { attrs: { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" } });
      const savedFileName = String(wallpaper.fileName || "").trim();
      const statusText = /^data:image\//i.test(wallpaper.value || "")
        ? `Загружен файл: ${savedFileName || "локальное изображение"}.`
        : "";
      const status = element("p", { className: "widget-muted wallpaper-upload-status", text: statusText });
      upload.addEventListener("change", async () => {
        const file = upload.files?.[0];
        status.textContent = file?.name ? `Подготовка файла: ${file.name}…` : "Подготовка изображения…";
        upload.disabled = true;
        try {
          const value = await readImageFile(file);
          updateWallpaper({ mode: "image", value, source: "upload", fileName: file.name, fileSize: file.size, fileUpdatedAt: Date.now() }, "wallpaper-upload");
          status.textContent = `Загружен файл: ${file.name}.`;
        } catch (error) {
          status.textContent = error?.message || "Не удалось загрузить изображение.";
        } finally {
          upload.value = "";
          upload.disabled = false;
        }
      });
      const position = createSelectMenu({ value: wallpaper.position || "center", options: [["center", "По центру"], ["top", "Сверху"], ["bottom", "Снизу"], ["left", "Слева"], ["right", "Справа"]].map(([value, label]) => ({ value, label })), ariaLabel: "Положение обоев", className: "settings-select-menu", onChange: (value) => updateWallpaper({ position: value }) });
      const size = createSelectMenu({ value: wallpaper.size || "cover", options: [["cover", "Заполнить экран"], ["contain", "Поместить целиком"], ["auto", "Исходный размер"]].map(([value, label]) => ({ value, label })), ariaLabel: "Масштабирование обоев", className: "settings-select-menu", onChange: (value) => updateWallpaper({ size: value }) });
      section.append(element("label", { className: "property-field" }, [element("span", { text: "Ссылка на изображение" }), url]));
      section.append(element("label", { className: "property-field" }, [element("span", { text: "Загрузить файл" }), upload]));
      section.append(status);
      section.append(element("label", { className: "property-field" }, [element("span", { text: "Положение" }), position.root]));
      section.append(element("label", { className: "property-field" }, [element("span", { text: "Масштабирование" }), size.root]));
    }
    return section;
  };

  const createBehaviorTab = (settings) => {
    const behavior = settings.behavior || {};
    const layoutSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Раскладка виджетов" }),
      element("p", { className: "settings-copy", text: "Настройте ручное перемещение и автоматическую мозаику рабочего стола." }),
    ]);
    const interfaceSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Вид рабочего стола" }),
      element("p", { className: "settings-copy", text: "Здесь находятся параметры отображения, не влияющие на ваши виджеты и данные." }),
    ]);
    const motionSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Анимации" }),
      element("p", { className: "settings-copy", text: "Выберите комфортную скорость переходов или полностью уменьшите движение." }),
    ]);
    const appendToggle = (section, key, label) => {
      const input = element("input", { checked: key === "roundedCorners" || key === "autoAdjustMosaic" ? behavior[key] !== false : Boolean(behavior[key]), attrs: { type: "checkbox" } });
      input.addEventListener("change", () => update({ behavior: { ...store.getState().settings.behavior, [key]: input.checked } }, "behavior-change"));
      section.append(element("label", { className: "toggle-field" }, [input, element("span", { text: label })]));
    };
    [["snapToGrid", "Привязывать виджеты к сетке"], ["lockWidgets", "Заблокировать перемещение и размер"], ["autoAdjustMosaic", "Автоподгонять мозаику"]].forEach(([key, label]) => appendToggle(layoutSection, key, label));
    [["presentationMode", "Режим презентации"], ["roundedCorners", "Скруглять границы интерфейса"]].forEach(([key, label]) => appendToggle(interfaceSection, key, label));
    appendToggle(motionSection, "reduceMotion", "Уменьшить анимацию");
    const requestedRadius = Number(behavior.cornerRadius);
    const currentRadius = Number.isFinite(requestedRadius) ? Math.min(24, Math.max(0, requestedRadius)) : 8;
    const cornerRadius = element("input", { value: currentRadius, attrs: { type: "range", min: "0", max: "24", step: "1", "aria-label": "Величина скругления интерфейса" } });
    cornerRadius.disabled = behavior.roundedCorners === false;
    const cornerCaption = element("span", { text: `Скругление интерфейса: ${cornerRadius.value}px` });
    cornerRadius.addEventListener("input", () => {
      cornerCaption.textContent = `Скругление интерфейса: ${cornerRadius.value}px`;
      root.style.setProperty("--checkbox-radius", behavior.roundedCorners === false ? "0px" : `${cornerRadius.value}px`);
      update({ behavior: { ...store.getState().settings.behavior, cornerRadius: Number(cornerRadius.value) } }, "corner-radius-change");
    });
    interfaceSection.append(element("label", { className: `property-field${cornerRadius.disabled ? " is-disabled" : ""}` }, [cornerCaption, cornerRadius]));
    const grid = element("input", { value: behavior.gridSize || 12, attrs: { type: "range", min: "4", max: "32", step: "1" } });
    const gridCaption = element("span", { text: `Шаг сетки: ${grid.value}px` });
    grid.addEventListener("input", () => { gridCaption.textContent = `Шаг сетки: ${grid.value}px`; update({ behavior: { ...store.getState().settings.behavior, gridSize: Number(grid.value) } }, "grid-change"); });
    layoutSection.append(element("label", { className: "property-field" }, [gridCaption, grid]));

    const dock = settings.dock || {};
    const dockSection = element("section", { className: "settings-section" }, [element("h3", { text: "Нижняя панель" })]);
    const dockHidden = element("input", { checked: Boolean(dock.hidden), attrs: { type: "checkbox", "aria-label": "Скрыть нижнюю панель" } });
    dockHidden.addEventListener("change", () => update({ dock: { ...(store.getState().settings.dock || {}), hidden: dockHidden.checked } }, "dock-visibility"));
    const dockAutoReveal = element("input", { checked: Boolean(dock.autoReveal), attrs: { type: "checkbox", "aria-label": "Выдвигать нижнюю панель при наведении на маркер" } });
    dockAutoReveal.addEventListener("change", () => update({ dock: { ...(store.getState().settings.dock || {}), autoReveal: dockAutoReveal.checked } }, "dock-auto-reveal"));
    const dockCompact = element("input", { checked: Boolean(dock.compact), attrs: { type: "checkbox", "aria-label": "Компактный режим нижней панели" } });
    dockCompact.addEventListener("change", () => update({ dock: { ...(store.getState().settings.dock || {}), compact: dockCompact.checked } }, "dock-compact"));
    dockSection.append(
      element("p", { className: "settings-copy", text: "Скрывает нижнюю панель с добавлением виджетов и кнопкой настроек. Её можно вернуть маркером у края экрана." }),
      element("label", { className: "toggle-field" }, [dockHidden, element("span", { text: "Скрыть нижнюю панель" })]),
      element("label", { className: "toggle-field" }, [dockAutoReveal, element("span", { text: "Выдвигать панель при наведении на маркер" })]),
      element("label", { className: "toggle-field" }, [dockCompact, element("span", { text: "Компактный режим" })]),
    );

    const search = settings.search || {};
    const searchSection = element("section", { className: "settings-section" }, [element("h3", { text: "Поиск" })]);
    const onboardingSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Знакомство с Startspace" }),
      element("p", { className: "settings-copy", text: "Повторно покажет краткую подсказку о виджетах, настройках и рабочих пространствах. Макет, тема и ваши данные не изменятся." }),
    ]);
    const replayOnboarding = element("button", { className: "primary-action", text: "Показать знакомство повторно", attrs: { type: "button" } });
    replayOnboarding.addEventListener("click", () => document.dispatchEvent(new Event("mflt-show-onboarding")));
    onboardingSection.append(element("div", { className: "button-row" }, [replayOnboarding]));
    const defaultEngine = createSelectMenu({ value: search.defaultEngine || "google", options: searchEngines, ariaLabel: "Система по умолчанию", className: "settings-select-menu", onChange: (value) => update({ search: { ...(store.getState().settings.search || {}), defaultEngine: value } }, "search-preferences") });
    const target = element("input", { checked: Boolean(search.openInNewTab ?? true), attrs: { type: "checkbox" } });
    target.addEventListener("change", () => update({ search: { ...(store.getState().settings.search || {}), openInNewTab: target.checked } }, "search-preferences"));
    searchSection.append(
      element("p", { className: "settings-copy", text: "Настройки применяются к виджету поиска." }),
      element("label", { className: "property-field" }, [element("span", { text: "Система по умолчанию" }), defaultEngine.root]),
      element("label", { className: "toggle-field" }, [target, element("span", { text: "Открывать результаты в новой вкладке" })]),
    );
    const animationSpeed = createSelectMenu({
      value: behavior.animationSpeed || "normal",
      options: [{ value: "off", label: "Отключены" }, { value: "fast", label: "Быстро" }, { value: "normal", label: "Обычно" }, { value: "slow", label: "Медленно" }],
      ariaLabel: "Скорость анимаций",
      className: "settings-select-menu",
      onChange: (next) => update({ behavior: { ...store.getState().settings.behavior, animationSpeed: next } }, "behavior-change"),
    });
    const parallaxEasing = createSelectMenu({
      value: behavior.parallaxEasing || "soft",
      options: [
        { value: "soft", label: "Плавное", description: "Мягкое завершение движения" },
        { value: "balanced", label: "Сбалансированное", description: "Ровный универсальный темп" },
        { value: "sharp", label: "Резкий старт", description: "Более заметный акцент на входе" },
        { value: "custom", label: "Своя кривая Безье", description: "Значение cubic-bezier(…) ниже" },
      ],
      ariaLabel: "Кривая параллакса иконок",
      className: "settings-select-menu",
      onChange: (next) => update({ behavior: { ...store.getState().settings.behavior, parallaxEasing: next } }, "behavior-change"),
    });
    const isCustomBezier = String(behavior.parallaxEasing || "soft") === "custom";
    const bezier = element("input", {
      value: behavior.parallaxBezier || "cubic-bezier(0.16, 1, 0.3, 1)",
      attrs: { type: "text", maxlength: "64", spellcheck: "false", "aria-label": "Пользовательская кривая Безье", placeholder: "cubic-bezier(0.16, 1, 0.3, 1)" },
    });
    bezier.disabled = !isCustomBezier;
    const saveBezier = () => {
      const value = bezier.value.trim();
      const valid = /^cubic-bezier\(\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*,\s*-?(?:\d+|\d*\.\d+)\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*,\s*-?(?:\d+|\d*\.\d+)\s*\)$/i.test(value);
      bezier.setCustomValidity(valid ? "" : "Введите CSS-кривую вида cubic-bezier(0.16, 1, 0.3, 1). Первое и третье значения — от 0 до 1.");
      if (!valid) { bezier.reportValidity(); return; }
      update({ behavior: { ...store.getState().settings.behavior, parallaxEasing: "custom", parallaxBezier: value } }, "behavior-change");
    };
    bezier.addEventListener("change", saveBezier);
    bezier.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); saveBezier(); bezier.blur(); } });
    motionSection.append(
      element("label", { className: "property-field" }, [element("span", { text: "Скорость анимаций" }), animationSpeed.root]),
      element("label", { className: "property-field" }, [element("span", { text: "Параллакс иконок при смене рабочего стола" }), parallaxEasing.root]),
      element("label", { className: `property-field${isCustomBezier ? "" : " is-disabled"}` }, [element("span", { text: "Своя кривая Безье" }), bezier]),
    );

    return element("div", { className: "settings-tab-stack" }, [layoutSection, interfaceSection, motionSection, dockSection, searchSection, onboardingSection]);
  };

  const createWebPanelTab = (settings) => {
    const webPanel = settings.webPanel || {};
    const section = element("section", { className: "settings-section" }, [element("h3", { text: "Появление и размер" })]);
    const appearanceSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Внешний вид" }),
      element("p", { className: "settings-copy", text: "Материал и прозрачность применяются к панели на обычных сайтах." }),
    ]);
    const weatherSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Погода в панели" }),
      element("p", { className: "settings-copy", text: "Город используется только виджетом погоды в панели сайтов." }),
    ]);
    const hidePanel = element("input", { checked: Boolean(webPanel.hidden) || webPanel.enabled === false, attrs: { type: "checkbox", "aria-label": "Скрыть выдвижную панель на сайтах" } });
    hidePanel.addEventListener("change", () => update({ webPanel: { ...(store.getState().settings.webPanel || {}), enabled: true, hidden: hidePanel.checked } }, "web-panel-visibility"));
    const edge = createSelectMenu({
      value: webPanel.edge === "left" ? "left" : "right",
      options: [["right", "Правый край"], ["left", "Левый край"]].map(([value, label]) => ({ value, label })),
      ariaLabel: "Край появления панели",
      className: "settings-select-menu",
      onChange: (nextEdge) => update({ webPanel: { ...(store.getState().settings.webPanel || {}), edge: nextEdge } }, "web-panel-settings"),
    });
    const requestedWidth = Number(webPanel.width);
    const widthValue = Number.isFinite(requestedWidth) ? Math.min(420, Math.max(280, requestedWidth)) : 340;
    const width = element("input", { value: widthValue, attrs: { type: "range", min: "280", max: "420", step: "10", "aria-label": "Ширина выдвижной панели" } });
    const widthCaption = element("span", { text: `Ширина панели: ${width.value}px` });
    width.addEventListener("input", () => {
      widthCaption.textContent = `Ширина панели: ${width.value}px`;
      update({ webPanel: { ...(store.getState().settings.webPanel || {}), width: Number(width.value) } }, "web-panel-settings");
    });
    const requestedScale = Number(webPanel.scale);
    const scaleValue = Number.isFinite(requestedScale) ? Math.min(130, Math.max(80, requestedScale)) : 100;
    const scale = element("input", { value: scaleValue, attrs: { type: "range", min: "80", max: "130", step: "5", "aria-label": "Масштаб панели" } });
    const scaleCaption = element("span", { text: `Масштаб панели: ${scale.value}%` });
    scale.addEventListener("input", () => {
      scaleCaption.textContent = `Масштаб панели: ${scale.value}%`;
      update({ webPanel: { ...(store.getState().settings.webPanel || {}), scale: Number(scale.value) } }, "web-panel-settings");
    });
    const requestedTransparency = Number(webPanel.transparency);
    const transparencyValue = Number.isFinite(requestedTransparency) ? Math.min(65, Math.max(0, requestedTransparency)) : 0;
    let panelMaterial = ["opaque", "transparent", "blur", "acrylic"].includes(webPanel.panelMaterial) ? webPanel.panelMaterial : (transparencyValue > 0 ? "transparent" : "opaque");
    const transparency = element("input", { value: transparencyValue, attrs: { type: "range", min: "0", max: "65", step: "1", "aria-label": "Прозрачность выдвижной панели" } });
    const transparencyCaption = element("span");
    const syncTransparencyControl = () => {
      const disabled = panelMaterial === "opaque";
      transparency.disabled = disabled;
      transparencyCaption.textContent = disabled ? "Прозрачность: выключена" : `Прозрачность: ${transparency.value}%`;
    };
    const material = createSelectMenu({
      value: panelMaterial,
      options: [["opaque", "Непрозрачная"], ["transparent", "Прозрачная"], ["blur", "Blur"], ["acrylic", "Акрил"]].map(([value, label]) => ({ value, label })),
      ariaLabel: "Материал выдвижной панели",
      className: "settings-select-menu",
      onChange: (nextMaterial) => {
        panelMaterial = nextMaterial;
        if (panelMaterial !== "opaque" && Number(transparency.value) === 0) transparency.value = "35";
        if (panelMaterial === "opaque") transparency.value = "0";
        syncTransparencyControl();
        update({ webPanel: { ...(store.getState().settings.webPanel || {}), panelMaterial, transparency: Number(transparency.value) } }, "web-panel-settings");
      },
    });
    transparency.addEventListener("input", () => {
      syncTransparencyControl();
      update({ webPanel: { ...(store.getState().settings.webPanel || {}), transparency: Number(transparency.value) } }, "web-panel-settings");
    });
    syncTransparencyControl();
    const weatherCity = element("input", { value: typeof webPanel.weatherCity === "string" && webPanel.weatherCity.trim() ? webPanel.weatherCity.trim() : "Москва", attrs: { type: "text", maxlength: "80", placeholder: "Например: Москва", "aria-label": "Город для погоды панели" } });
    const saveWeatherCity = () => update({ webPanel: { ...(store.getState().settings.webPanel || {}), weatherCity: weatherCity.value.trim() || "Москва" } }, "web-panel-weather-city");
    weatherCity.addEventListener("change", saveWeatherCity);
    weatherCity.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); saveWeatherCity(); weatherCity.blur(); } });
    const requestedFontScale = Number(webPanel.fontScale);
    const fontScaleValue = Number.isFinite(requestedFontScale) ? Math.min(160, Math.max(80, requestedFontScale)) : 100;
    const fontScale = element("input", { value: fontScaleValue, attrs: { type: "range", min: "80", max: "160", step: "5", "aria-label": "Размер текста панели" } });
    const fontScaleCaption = element("span", { text: `Размер текста: ${fontScale.value}%` });
    fontScale.addEventListener("input", () => {
      fontScaleCaption.textContent = `Размер текста: ${fontScale.value}%`;
      update({ webPanel: { ...(store.getState().settings.webPanel || {}), fontScale: Number(fontScale.value) } }, "web-panel-settings");
    });
    section.append(
      element("p", { className: "settings-copy", text: "На обычном сайте наведите курсор к выбранному краю окна. Даже при скрытой панели здесь по-прежнему можно менять её параметры и добавлять или убирать виджеты." }),
      element("label", { className: "toggle-field" }, [hidePanel, element("span", { text: "Скрыть выдвижную панель на сайтах" })]),
      element("label", { className: "property-field" }, [element("span", { text: "Край появления" }), edge.root]),
      element("label", { className: "property-field" }, [widthCaption, width]),
      element("label", { className: "property-field" }, [scaleCaption, scale]),
    );
    appearanceSection.append(
      element("label", { className: "property-field" }, [element("span", { text: "Материал панели" }), material.root]),
      element("label", { className: "property-field" }, [transparencyCaption, transparency]),
      element("label", { className: "property-field" }, [fontScaleCaption, fontScale]),
    );
    weatherSection.append(element("label", { className: "property-field" }, [element("span", { text: "Город" }), weatherCity]));

    const widgetsSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Виджеты текущего пространства" }),
      element("p", { className: "settings-copy", text: "Отметьте карточки для текущего рабочего стола. При переключении рабочего стола состав панели меняется вместе с его раскладкой." }),
    ]);
    const widgetInputs = new Map();
    const selectedWidgets = Array.isArray(webPanel.widgets)
      ? WEB_PANEL_WIDGET_CHOICES.filter(([type]) => webPanel.widgets.includes(type)).map(([type]) => type)
      : WEB_PANEL_WIDGET_CHOICES.map(([type]) => type);
    const saveWidgetSelection = () => {
      const selected = WEB_PANEL_WIDGET_CHOICES.filter(([type]) => widgetInputs.get(type)?.checked).map(([type]) => type);
      update({ webPanel: { ...(store.getState().settings.webPanel || {}), widgets: selected } }, "web-panel-settings");
    };
    WEB_PANEL_WIDGET_CHOICES.forEach(([type, label]) => {
      const input = element("input", { checked: selectedWidgets.includes(type), attrs: { type: "checkbox" } });
      input.addEventListener("change", saveWidgetSelection);
      widgetInputs.set(type, input);
      widgetsSection.append(element("label", { className: "toggle-field" }, [input, element("span", { text: label })]));
    });

    const transferSection = element("section", { className: "settings-section" }, [
      element("h3", { text: "Перенос и резервная копия" }),
      element("p", { className: "settings-copy", text: "Экспорт включает параметры, тему, состав и порядок карточек, их высоты, заметки, задачи и таймер. Импорт заменяет только состояние панели сайтов и выбранную тему." }),
    ]);
    const transferFile = element("input", { attrs: { type: "file", accept: "application/json,.json", hidden: "" } });
    const exportPanel = element("button", { className: "primary-action", text: "Экспортировать панель", attrs: { type: "button" } });
    const importPanel = element("button", { className: "text-action", text: "Импортировать панель", attrs: { type: "button" } });
    exportPanel.addEventListener("click", async () => {
      try {
        const storage = getExtensionApi()?.storage?.local;
        if (!storage) throw new Error("Хранилище расширения недоступно.");
        const values = await callExtensionApi(storage.get, storage, [[WEB_PANEL_DATA_KEY]]);
        downloadWebPanel({ settings: store.getState().settings, data: values?.[WEB_PANEL_DATA_KEY] || {} });
        notify({ title: "Панель экспортирована", message: "JSON-файл готов для переноса на другое устройство.", type: "success" });
      } catch (error) {
        notify({ title: "Не удалось экспортировать панель", message: error?.message || "Проверьте хранилище расширения.", type: "error" });
      }
    });
    transferFile.addEventListener("change", async () => {
      try {
        const imported = await readWebPanelFile(transferFile.files?.[0]);
        const storage = getExtensionApi()?.storage?.local;
        if (!storage) throw new Error("Хранилище расширения недоступно.");
        await callExtensionApi(storage.set, storage, [{ [WEB_PANEL_DATA_KEY]: imported.data }]);
        update({ webPanel: imported.settings, themeId: imported.theme.themeId, customTheme: imported.theme.customTheme }, "web-panel-import");
        notify({ title: "Панель импортирована", message: "Настройки, виджеты и данные панели применены.", type: "success" });
      } catch (error) {
        notify({ title: "Не удалось импортировать панель", message: error?.message || "Выберите корректный JSON-файл панели.", type: "error" });
      }
      transferFile.value = "";
    });
    transferSection.append(transferFile, element("div", { className: "button-row" }, [exportPanel, importPanel]));
    importPanel.addEventListener("click", () => transferFile.click());

    const diagnosticsSection = element("section", { className: "settings-section diagnostics-section" }, [
      element("h3", { text: "Проверка появления панели" }),
      element("p", { className: "settings-copy", text: "Показывает результат последней отправки панели во вкладки и состояние панели на последней обычной странице. Адреса отображаются только до домена, без пути и содержимого страницы." }),
    ]);
    const diagnosticsList = element("div", { className: "diagnostics-list", attrs: { "aria-live": "polite" } }, [element("p", { className: "widget-muted", text: "Запрашиваем состояние…" })]);
    const refresh = element("button", { className: "text-action", text: "Обновить сведения", attrs: { type: "button" } });
    const reinject = element("button", { className: "primary-action", text: "Отправить на вкладки", attrs: { type: "button" } });
    const timeLabel = (value) => {
      const date = new Date(value || 0);
      return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date.toLocaleString(settings.locale || "ru-RU") : "ещё нет";
    };
    const diagnosticRow = (label, detail, kind = "idle") => {
      const row = element("div", { className: `diagnostic-row is-${kind}` });
      row.append(
        element("div", { className: "diagnostic-copy" }, [element("strong", { text: label }), element("span", { text: detail })]),
        element("span", { className: "diagnostic-badge", text: kind === "ok" ? "Готово" : kind === "error" ? "Ошибка" : "Нет данных" }),
      );
      return row;
    };
    const refreshDiagnostics = async () => {
      refresh.disabled = true;
      diagnosticsList.replaceChildren(element("p", { className: "widget-muted", text: "Запрашиваем состояние…" }));
      try {
        const api = getExtensionApi();
        const storage = api?.storage?.local;
        if (!storage) throw new Error("Хранилище расширения недоступно в этом браузере.");
        const values = await callExtensionApi(storage.get, storage, [[WEB_PANEL_INJECTION_DIAGNOSTICS_KEY, WEB_PANEL_CONTENT_DIAGNOSTICS_KEY]]);
        const injection = values?.[WEB_PANEL_INJECTION_DIAGNOSTICS_KEY];
        const content = values?.[WEB_PANEL_CONTENT_DIAGNOSTICS_KEY];
        const injectionDetail = injection
          ? `${timeLabel(injection.updatedAt)} · вкладок: ${injection.lastRun?.total ?? 0}, отправлено: ${injection.lastRun?.injected ?? 0}, ошибок: ${injection.lastRun?.failed ?? 0}${injection.entries?.find((entry) => entry.status === "error")?.detail ? ` · ${injection.entries.find((entry) => entry.status === "error").detail}` : ""}`
          : "Фоновый модуль ещё не запускал отправку. Нажмите «Отправить на вкладки».";
        const injectionKind = injection ? (injection.lastRun?.failed ? "error" : injection.lastRun?.injected ? "ok" : "idle") : "idle";
        const contentDetail = content
          ? `${timeLabel(content.updatedAt)} · ${content.origin || "адрес не указан"} · ${content.detail || "без сообщения"}`
          : "Панель ещё не сообщила о запуске. Откройте обычный сайт и нажмите «Отправить на вкладки».";
        const contentKind = content ? (content.status === "ready" ? "ok" : content.status === "error" ? "error" : "idle") : "idle";
        diagnosticsList.replaceChildren(
          diagnosticRow("Внедрение во вкладки", injectionDetail, injectionKind),
          diagnosticRow("Состояние панели на странице", contentDetail, contentKind),
        );
      } catch (error) {
        diagnosticsList.replaceChildren(diagnosticRow("Отладка недоступна", error?.message || "Не удалось получить сведения.", "error"));
      } finally {
        if (diagnosticsSection.isConnected) refresh.disabled = false;
      }
    };
    refresh.addEventListener("click", refreshDiagnostics);
    reinject.addEventListener("click", async () => {
      reinject.disabled = true;
      try {
        const runtime = getExtensionApi()?.runtime;
        if (!runtime) throw new Error("Фоновый модуль расширения недоступен.");
        await callExtensionApi(runtime.sendMessage, runtime, [{ type: "mflt-web-panel-reinject" }]);
      } catch (error) {
        notify({ title: "Не удалось отправить панель", message: error?.message || "Проверьте состояние расширения.", type: "error" });
      } finally {
        if (diagnosticsSection.isConnected) reinject.disabled = false;
        await refreshDiagnostics();
      }
    });
    diagnosticsSection.append(element("div", { className: "diagnostics-toolbar" }, [element("span", { className: "widget-muted", text: "Состояние контентной панели" }), element("div", { className: "button-row" }, [refresh, reinject])]), diagnosticsList);
    queueMicrotask(refreshDiagnostics);
    return element("div", { className: "settings-tab-stack" }, [section, appearanceSection, weatherSection, widgetsSection, transferSection, diagnosticsSection]);
  };

    const createDiagnosticsTab = (settings) => {
    const section = element("section", { className: "settings-section diagnostics-section" }, [
      element("h3", { text: "Проверка сервисов" }),
      element("p", { className: "settings-copy", text: "Показывает сохранённое состояние источников и уже выданные разрешения. Проверка не запускает новые запросы к погоде, курсам или медиавкладкам." }),
    ]);
    const list = element("div", { className: "diagnostics-list", attrs: { "aria-live": "polite" } }, [element("p", { className: "widget-muted", text: "Проверка состояния…" })]);
    const refresh = element("button", { className: "text-action", text: "Проверить снова", attrs: { type: "button" } });

    const refreshDiagnostics = async () => {
      refresh.disabled = true;
      list.replaceChildren(element("p", { className: "widget-muted", text: "Проверка состояния…" }));
      try {
        const diagnostics = await getWidgetDiagnostics(store.getState(), { locale: settings.locale });
        if (!section.isConnected) return;
        list.replaceChildren(...diagnostics.map((status) => {
          const row = element("div", { className: `diagnostic-row is-${status.kind}` });
          const details = element("div", { className: "diagnostic-copy" }, [element("strong", { text: status.label }), element("span", { text: status.detail })]);
          const badgeText = { ok: "Готово", warning: "Нужно внимание", error: "Ошибка", checking: "Проверка", idle: "Ожидание" }[status.kind] || "Неизвестно";
          row.append(details, element("span", { className: "diagnostic-badge", text: badgeText }));
          if (status.action) {
            row.append(element("button", {
              className: "text-action diagnostic-action",
              text: "Разрешить",
              attrs: { type: "button" },
              on: { click: async () => {
                const result = status.action === "browser-media"
                  ? await ensureBrowserMediaPermission()
                  : { granted: await requestWidgetPermissions(status.action) };
                notify({ title: result.granted ? "Доступ предоставлен" : "Доступ не предоставлен", message: result.granted ? "Диагностика будет обновлена." : (result.message || "Проверьте разрешение в браузере и повторите попытку."), type: result.granted ? "success" : "error" });
                await refreshDiagnostics();
              } } },
            ));
          }
          return row;
        }));
      } catch (error) {
        if (section.isConnected) list.replaceChildren(element("p", { className: "widget-muted", text: error?.message || "Не удалось проверить состояние источников." }));
      } finally {
        if (section.isConnected) refresh.disabled = false;
      }
    };

    refresh.addEventListener("click", refreshDiagnostics);
    section.append(element("div", { className: "diagnostics-toolbar" }, [element("span", { className: "widget-muted", text: "Состояние сервисов" }), refresh]), list);
    queueMicrotask(refreshDiagnostics);
    return section;
  };

  const createBackupTab = () => {

    const section = element("section", { className: "settings-section" }, [element("h3", { text: "Перенос и резервная копия" }), element("p", { className: "settings-copy", text: "Экспорт макета сохраняет виджеты, их положение, размеры, оформление и общие настройки в один JSON-файл. Отдельно можно перенести один виджет или выбранную тему." })]);
    const restoreFile = element("input", { attrs: { type: "file", accept: "application/json,.json", hidden: "" } });
    const widgetFile = element("input", { attrs: { type: "file", accept: "application/json,.json", hidden: "" } });
    const themeFile = element("input", { attrs: { type: "file", accept: "application/json,.json", hidden: "" } });
    const preferencesFile = element("input", { attrs: { type: "file", accept: "application/json,.json", hidden: "" } });
    restoreFile.addEventListener("change", async () => {
      try {
        const state = await readLayoutFile(restoreFile.files?.[0]);
        store.replaceState(state, "layout-import");
        notify({ title: "Макет импортирован", message: "Виджеты и настройки заменены", type: "success" });
      } catch (error) { notify({ title: "Не удалось импортировать макет", message: error.message, type: "error" }); }
      restoreFile.value = "";
    });
    widgetFile.addEventListener("change", async () => {
      try {
        const widget = await importWidget(widgetFile.files?.[0], store, registry);
        notify({ title: "Виджет импортирован", message: widget.title, type: "success" });
      } catch (error) { notify({ title: "Не удалось импортировать виджет", message: error.message, type: "error" }); }
      widgetFile.value = "";
    });
    themeFile.addEventListener("change", async () => {
      try {
        const theme = await importThemePack(themeFile.files?.[0], store);
        notify({ title: "Тема импортирована", message: theme.themeId, type: "success" });
      } catch (error) { notify({ title: "Не удалось импортировать тему", message: error.message, type: "error" }); }
      themeFile.value = "";
    });
    preferencesFile.addEventListener("change", async () => {
      try {
        const result = await importUserPreferences(preferencesFile.files?.[0], store);
        notify({ title: "Настройки применены", message: `Тема: ${result.themeId}; настроено виджетов: ${result.appliedWidgets}. Раскладка не изменена.`, type: "success" });
      } catch (error) { notify({ title: "Не удалось импортировать настройки", message: error.message, type: "error" }); }
      preferencesFile.value = "";
    });
    section.append(
      element("h4", { text: "Макет и настройки" }),
      restoreFile,
      element("div", { className: "button-row" }, [
        element("button", { className: "primary-action", text: "Экспортировать JSON", attrs: { type: "button" }, on: { click: () => { downloadLayout(store.getState()); notify({ title: "Макет экспортирован", message: "JSON-файл подготовлен", type: "success" }); } } }),
        element("button", { className: "text-action", text: "Импортировать JSON", attrs: { type: "button" }, on: { click: () => restoreFile.click() } }),
      ]),
      element("h4", { text: "Один виджет" }),
      widgetFile,
      element("div", { className: "button-row" }, [element("button", { className: "text-action", text: "Импортировать виджет", attrs: { type: "button" }, on: { click: () => widgetFile.click() } })]),
      element("h4", { text: "Набор темы" }),
      themeFile,
      element("div", { className: "button-row" }, [
        element("button", { className: "text-action", text: "Скачать тему", attrs: { type: "button" }, on: { click: () => { exportThemePack(store.getState().settings); notify({ title: "Тема сохранена", message: "JSON-файл подготовлен", type: "success" }); } } }),
        element("button", { className: "text-action", text: "Импортировать тему", attrs: { type: "button" }, on: { click: () => themeFile.click() } }),
      ]),
      element("h4", { text: "Мои настройки виджетов и темы" }),
      element("p", { className: "settings-copy", text: "Переносит цвета, обои, названия, свойства и содержимое совпадающих виджетов. Позиции, размеры, рабочие пространства и другие данные на устройстве остаются как есть." }),
      preferencesFile,
      element("div", { className: "button-row" }, [
        element("button", { className: "primary-action", text: "Экспортировать настройки", attrs: { type: "button" }, on: { click: () => { exportUserPreferences(store.getState()); notify({ title: "Настройки экспортированы", message: "JSON-файл с темой и настройками виджетов подготовлен.", type: "success" }); } } }),
        element("button", { className: "text-action", text: "Импортировать настройки", attrs: { type: "button" }, on: { click: () => preferencesFile.click() } }),
      ]),
    );
    return section;
  };

  const disposeControls = () => disposeSelectMenus(root);
  const render = () => {
    const settings = store.getState().settings;
    root.dataset.settingsTab = activeTab;
    const behavior = settings.behavior || {};
    const requestedRadius = Number(behavior.cornerRadius);
    const cornerRadius = Number.isFinite(requestedRadius) ? Math.min(24, Math.max(0, requestedRadius)) : 8;
    root.style.setProperty("--checkbox-radius", behavior.roundedCorners === false ? "0px" : `${cornerRadius}px`);
    disposeControls();
    clear(root);
    root.append(element("div", { className: "panel-heading panel-drag-region", attrs: { "data-role": "panel-drag" } }, [
      element("div", {}, [element("span", { className: "panel-kicker", text: "Startspace" }), element("h2", { text: "Настройки" })]),
      element("button", { className: "panel-close", attrs: { type: "button", "aria-label": "Закрыть настройки" }, on: { click: onClose } }, [createLineIcon("close", { size: 17 })]),
    ]));
    root.append(createTabBar());
    root.append(activeTab === "appearance" ? createThemeTab(settings) : activeTab === "colors" ? createColorsTab(settings) : activeTab === "wallpaper" ? createWallpaperTab(settings) : activeTab === "behavior" ? createBehaviorTab(settings) : activeTab === "web-panel" ? createWebPanelTab(settings) : activeTab === "diagnostics" ? createDiagnosticsTab(settings) : activeTab === "desktop" ? document.createDocumentFragment() : createBackupTab());
    root.append(element("button", { className: "panel-resize-handle", attrs: { type: "button", "data-action": "resize-panel", "aria-label": "Изменить размер панели" }, title: "Изменить размер" }, [createLineIcon("resize", { size: 13 })]));
    root.dispatchEvent(new Event("panel-content-rendered"));
  };
  const unsubscribe = store.subscribe((_state, event) => {
    if (event?.reason === "theme-color" || event?.reason === "wallpaper-color" || event?.reason === "wallpaper-upload" || event?.reason === "grid-change" || event?.reason === "corner-radius-change" || event?.reason === "web-panel-settings") return;
    if (["settings", "replace", "batch"].includes(event?.type)) render();
  });
  return {
    open(tab = activeTab) {
      if (tabs.some(([id]) => id === tab)) activeTab = tab;
      root.hidden = false;
      render();
      animatePanel(root, store.getState().settings);
    },
    close() {
      const wasOpen = !root.hidden;
      root.hidden = true;
      disposeControls();
      clear(root);
      if (wasOpen) document.dispatchEvent(new Event("mflt-settings-closed"));
    },
    destroy() { unsubscribe(); disposeControls(); clear(root); },
  };
}


