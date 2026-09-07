import { uid } from "../ui/dom.js";

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

function freezeDefinition(definition) {
  const properties = (definition.properties || []).map((property) => Object.freeze({
    ...property,
    options: Array.isArray(property.options) ? Object.freeze(property.options.map((option) => Object.freeze({ ...option }))) : property.options,
  }));
  return Object.freeze({
    category: "Другое",
    ...definition,
    properties: Object.freeze(properties),
    defaultSize: Object.freeze({ ...definition.defaultSize }),
    minSize: definition.minSize ? Object.freeze({ ...definition.minSize }) : undefined,
    defaultConfig: Object.freeze(structuredClone(definition.defaultConfig || {})),
  });
}

export function createWidgetRegistry() {
  const definitions = new Map();

  const assertDefinition = (definition) => {
    if (!definition || !/^[a-z][a-z0-9-]*$/.test(String(definition.type || ""))) throw new Error("Тип виджета должен быть непустым идентификатором в нижнем регистре.");
    if (typeof definition.title !== "string" || !definition.title.trim()) throw new Error(`Виджет «${definition.type}» должен иметь заголовок.`);
    if (typeof definition.create !== "function" || typeof definition.update !== "function") throw new Error(`Виджет «${definition.type}» должен содержать create и update.`);
    if (definition.dispose !== undefined && typeof definition.dispose !== "function") throw new Error(`dispose виджета «${definition.type}» должен быть функцией.`);
    if (!isPlainObject(definition.defaultSize) || !finitePositive(definition.defaultSize.w) || !finitePositive(definition.defaultSize.h)) throw new Error(`Виджет «${definition.type}» должен иметь положительный defaultSize.`);
    if (definition.minSize !== undefined && (!isPlainObject(definition.minSize) || !finitePositive(definition.minSize.w) || !finitePositive(definition.minSize.h) || Number(definition.minSize.w) > Number(definition.defaultSize.w) || Number(definition.minSize.h) > Number(definition.defaultSize.h))) throw new Error(`Виджет «${definition.type}» должен иметь корректный minSize, не превышающий defaultSize.`);
    if (definition.defaultConfig !== undefined && !isPlainObject(definition.defaultConfig)) throw new Error(`defaultConfig виджета «${definition.type}» должен быть объектом.`);
    if (definition.properties !== undefined && !Array.isArray(definition.properties)) throw new Error(`properties виджета «${definition.type}» должен быть массивом.`);
    const keys = new Set();
    (definition.properties || []).forEach((property) => {
      if (!property?.key || keys.has(property.key)) throw new Error(`Свойства виджета «${definition.type}» должны иметь уникальные ключи.`);
      keys.add(property.key);
    });
  };

  return Object.freeze({
    register(definition) {
      assertDefinition(definition);
      if (definitions.has(definition.type)) throw new Error(`Тип «${definition.type}» уже зарегистрирован.`);
      definitions.set(definition.type, freezeDefinition(definition));
    },
    get(type) { return definitions.get(type) || definitions.get("note"); },
    list() { return [...definitions.values()]; },
    createWidget(type, { position, zIndex } = {}) {
      const definition = definitions.get(type);
      if (!definition) throw new Error(`Неизвестный тип виджета: ${type}`);
      return {
        id: uid(type),
        type,
        title: definition.title,
        position: position ? { ...position } : { x: 48, y: 48 },
        size: { ...definition.defaultSize },
        zIndex: Number.isFinite(Number(zIndex)) ? Number(zIndex) : 101,
        pinned: false,
        style: {
          surfaceMode: "solid",
          opacity: 1,
          accent: definition.accent || "#d9b45f",
          useThemeAccent: true,
          background: "",
          color: "",
          borderColor: "",
          borderWidth: 1,
          shadow: 34,
          blur: 16,
          padding: 13,
          fontScale: 1,
          interfaceScale: 1,
          autoScale: true,
          fontWeight: 400,
          contentAlign: "left",
          headerOpacity: 0.64,
          headerColor: "",
          headerTextColor: "",
        },
        config: structuredClone(definition.defaultConfig),
      };
    },
    propertiesFor(widget) {
      const common = [
        { key: "title", label: "Заголовок", type: "text", section: "Основное", target: "root", maxLength: 72 },
        { key: "surfaceMode", label: "Материал поверхности", type: "select", section: "Поверхность", target: "style", default: "custom", hint: "Ползунок прозрачности работает во всех режимах, кроме «Непрозрачная».", options: [{ value: "solid", label: "Непрозрачная" }, { value: "soft", label: "Мягкая прозрачность" }, { value: "glass", label: "Стекло с блюром" }, { value: "acrylic", label: "Акрил" }, { value: "clear", label: "Почти прозрачная" }, { value: "custom", label: "Ручная настройка" }] },
        { key: "opacity", label: "Прозрачность поверхности", type: "range", section: "Поверхность", target: "style", min: 0, max: 1, step: 0.05, default: 1, hint: "Работает от 0% до 100% во всех режимах, кроме «Непрозрачная»." },
        { key: "background", label: "Цвет поверхности", type: "color", section: "Поверхность", target: "style", default: "#1b1e25" },
        { key: "blur", label: "Размытие фона", type: "range", section: "Поверхность", target: "style", min: 0, max: 40, step: 1, default: 0, hint: "В ручном режиме задаёт силу блюра фона." },
        { key: "shadow", label: "Мягкость тени", type: "range", section: "Поверхность", target: "style", min: 0, max: 60, step: 1, default: 34 },
        { key: "useThemeAccent", label: "Использовать акцент темы", type: "toggle", section: "Граница", target: "style", default: true, hint: "Включено: виджет следует акценту выбранной темы. Отключите, чтобы сохранить собственный цвет." },
        { key: "accent", label: "Акцент", type: "color", section: "Граница", target: "style", default: "#d9b45f" },
        { key: "borderColor", label: "Цвет границы", type: "color", section: "Граница", target: "style", default: "#d9b45f" },
        { key: "borderWidth", label: "Толщина границы", type: "range", section: "Граница", target: "style", min: 0, max: 4, step: 1, default: 1 },
        { key: "color", label: "Цвет текста", type: "color", section: "Текст", target: "style", default: "#f3f0e8" },
        { key: "fontScale", label: "Размер текста", type: "range", section: "Текст", target: "style", min: 0.75, max: 1.6, step: 0.05, default: 1 },
        { key: "autoScale", label: "Автомасштабирование", type: "toggle", section: "Масштаб", target: "style", default: true, hint: "Подстраивает внутренний интерфейс под текущий размер виджета, не изменяя его рамку и положение." },
        { key: "interfaceScale", label: "Масштаб интерфейса", type: "range", section: "Масштаб", target: "style", min: 0.65, max: 1.5, step: 0.05, default: 1, hint: "Ручная поправка масштаба внутреннего содержимого. Работает вместе с автоматическим масштабированием." },
        { key: "fontWeight", label: "Насыщенность", type: "select", section: "Текст", target: "style", default: "400", options: [{ value: "400", label: "Обычный" }, { value: "500", label: "Средний" }, { value: "600", label: "Полужирный" }, { value: "700", label: "Жирный" }] },
        { key: "contentAlign", label: "Выравнивание", type: "select", section: "Текст", target: "style", default: "left", options: [{ value: "left", label: "Слева" }, { value: "center", label: "По центру" }, { value: "right", label: "Справа" }] },
        { key: "padding", label: "Внутренний отступ", type: "range", section: "Макет", target: "style", min: 6, max: 28, step: 1, default: 13 },
        { key: "headerOpacity", label: "Контраст заголовка", type: "range", section: "Макет", target: "style", min: 0, max: 1, step: 0.05, default: 0.64 },
        { key: "headerColor", label: "Цвет заголовка", type: "color", section: "Макет", target: "style", default: "#1b1e25" },
        { key: "headerTextColor", label: "Текст заголовка", type: "color", section: "Макет", target: "style", default: "#f3f0e8" },
      ];
      const definition = this.get(widget.type);
      const excludedCommonProperties = new Set(definition?.excludedCommonProperties || []);
      return [...common.filter((property) => !excludedCommonProperties.has(property.key)), ...(definition?.properties || [])];
    },
  });
}
