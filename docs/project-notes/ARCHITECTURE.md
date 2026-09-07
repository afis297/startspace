# My Free Layout Tab — архитектура V5

> **Статус:** актуальная сводка слоёв V5. Для полного поведения отдельных виджетов используйте [карту функций](../widget-function-map-2026-08-16.md); для навигации — [индекс документации](../README.md).

## Цель

V5 сохраняет расширение без фреймворков и сборки, но переводит его на явные ES-модульные контракты. Каждый модуль знает только свой слой: состояние не создаёт DOM, виджет не пишет напрямую в `chrome.storage`, а UI-панель не содержит бизнес-логику конкретного виджета.

## Слои

| Слой | Папка | Ответственность |
|---|---|---|
| Точка входа | `src/app/bootstrap.js` | Загружает данные, темы, UI и реестр виджетов. |
| Состояние | `src/app/store.js` | Иммутабельное состояние, подписки, транзакции и API обновления. |
| Хранение | `src/app/persistence.js` | `chrome.storage.local`, debounce и миграции устаревших данных. |
| Геометрия | `src/app/geometry.js` | Нормализация позиции/размера, snap и безопасные границы. |
| Виджеты | `src/widgets/` | Реализация отдельных виджетов, не зависящая от панели свойств. |
| Реестр | `src/widgets/registry.js` | Поиск определения типа, создание/mount/update/dispose. |
| Интерфейс | `src/ui/` | Рабочий стол, dock, редактор свойств, настройки и диалоги. |
| Сервисы | `src/services/` | HTTP-клиенты с таймаутом, кэшем и единым контрактом ошибок. |
| Темы | `src/themes/` | Схемы CSS-переменных и пресеты тем. |
| Стили | `src/styles/` | Tokens, layout, windows, controls и виджеты. |

## Формат состояния

```js
{
  schemaVersion: 5,
  widgets: [{
    id: "uuid",
    type: "clock",
    title: "Часы",
    position: { x: 80, y: 80 },
    size: { w: 260, h: 180 },
    zIndex: 101,
    style: { opacity: 1, accent: "#76a9ff", fontScale: 1 },
    config: { /* данные конкретного виджета */ }
  }],
  settings: {
    themeId: "midnight",
    wallpaper: { mode: "gradient", value: "" },
    dock: { position: "bottom", autoHide: false, compact: false },
    behavior: { snapToGrid: true, gridSize: 12, lockWidgets: false, roundedCorners: true }
  },
  ui: { nextZIndex: 101 }
}
```

## Контракт WidgetDefinition

```js
{
  type: "clock",
  title: "Часы",
  icon: "◷",
  category: "Основное",
  defaultSize: { w: 260, h: 180 },
  defaultConfig: { mode: "digital", showSeconds: true },
  properties: [/* schema fields */],
  create(widget, context) => HTMLElement,
  update(element, widget, context) => void,
  dispose(element, context) => void
}
```

Новый тип добавляется в отдельном модуле и регистрируется одной строкой в `src/widgets/definitions.js`. Настройки описываются декларативной схемой; редактор свойств строится автоматически и не содержит условия по конкретному типу виджета.

## Контракт свойства

```js
{
  key: "showSeconds",
  label: "Показывать секунды",
  type: "toggle", // text | textarea | number | range | select | color | url | toggle
  section: "Содержимое",
  default: true,
  options: [{ value: "24", label: "24 часа" }],
  validate(value) => sanitizedValue
}
```

## Инварианты

1. Никакое пользовательское значение не вставляется через `innerHTML`.
2. Виджет обновляет данные только через `store.updateWidget(id, patch)`.
3. Внешние окна и виджеты не масштабируются CSS-transform. Координаты и размеры измеряются в CSS-пикселях.
4. Сохранение всегда получает сериализуемый снимок состояния V5.
5. Любой change-обработчик сначала валидирует ввод, затем обновляет Store.
6. DOM-ссылки уничтожаются при удалении виджета или размонтировании рабочего стола.

## Миграция

При первом запуске V5 считывает действующие ключи `widgets`, `settings`, `topZIndex`, кэш валют и старые позиции. Объекты старого формата `{ pos, size, content }` преобразуются в V5-виджеты с `position`, `size`, `style` и `config`. Удалённый тип `daily-calendar` отфильтровывается как при миграции, так и при загрузке сохранённого состояния; текущая связь сроков реализована только через тип `calendar`. Исходные ключи не удаляются до успешного сохранения нового ключа `layoutStateV5`.
