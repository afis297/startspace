# 🌐 My New Tab — умная, настраиваемая вкладка для Chrome

> **Новая вкладка как рабочее пространство**: виджеты, drag-and-drop, локальное хранение, поддержка внешних API.

---

## 🚀 Что это?

Это **однофайловое** расширение для Chrome/Edge (с `index.html`, `style.css`, `script.js`, `manifest.json`), которое заменяет стандартную новую вкладку на **кастомизируемую панель** с виджетами.

- **Виджеты**: погода, таймер, заметки, переводчик, калькулятор, 2048, змейка, курс валют, цитаты, задачи, календарь и др.
- **Drag-and-drop**, сетка, минимизация, настройка стилей каждого виджета.
- **Локальное хранение** через `chrome.storage.local`.
- **Без внешних зависимостей** (кроме API-сервисов, таких как Open-Meteo).
- **Тема Catppuccin**, адаптивный дизайн, анимации.

---

## 🏗️ Архитектура

### Файлы:
- **`manifest.json`** — метаданные, разрешения (`storage`, `unlimitedStorage`, `activeTab`).
- **`index.html`** — минимальный шаблон (без содержимого — всё генерируется JS).
- **`style.css`** — стили, основанные на цветовой схеме Catppuccin.
- **`script.js`** — **основной файл** (~3000 строк), содержащий:
  - Генерацию DOM.
  - Управление виджетами.
  - Хранение данных (`widgets`, `globalSettings`).
  - Обработку событий (мышь, клавиатура, контекстное меню).
  - Интеграцию с API (погода, перевод, курсы).

---

## 🔧 Структура `script.js`

### 1. **Конфигурация и схемы**
- `SETTINGS_SCHEMA` — глобальные настройки (шрифт, прозрачность, анимации).
- `WIDGET_STYLE_SCHEMA` — стили по умолчанию для виджетов.
- `WEATHER_SOURCES` — поддержка разных API (Open-Meteo, wttr.in).

### 2. **Управление данными**
- `widgets` — массив объектов-виджетов.
- `globalSettings` — общие настройки (фон, масштаб, позиция дока).
- `chrome.storage.local` — синхронизация с диском.
- `debouncedSave()` — отложенное сохранение (оптимизация).

### 3. **Генерация виджетов**
- `addWidget(type)` — создание виджета с `config`.
- `createWidgetDOM(config)` — генерация HTML/CSS/JS для виджета.
- `initWeatherWidget(el, config)` — инициализация погоды (таймер, fetch).
- `initTimerWidget`, `initNoteWidget`, `initSnakeWidget` и т.д. — инициализация других виджетов.

### 4. **Обработка событий**
- `mousedown`, `mousemove`, `mouseup` — drag-and-drop.
- `keydown`, `keyup` — горячие клавиши.
- `contextmenu` — контекстное меню виджета.
- `resize`, `scroll` — адаптация под размер экрана.

### 5. **Настройки и UI**
- `initSettingsPanel()` — модальное окно настроек.
- `render(tab)` — рендер вкладок (общие, виджет-специфичные).
- `activeWidgetId` — ID активного виджета для привязки настроек.

---

## 🧩 Модульность и расширение

### Добавление нового виджета:
1. Добавить `case 'myWidget'` в `createWidgetDOM`.
2. Создать `initMyWidget(el, config)`.
3. Добавить `myWidget-specific-settings` в `initSettingsPanel`.
4. Привязать `input/change` к `w.myOption = ...` и `debouncedSave()`.

### Добавление нового API:
1. Добавить в `WEATHER_SOURCES` или аналогичный объект.
2. Обновить `fetchWeatherFromSources` или соответствующую функцию.
3. Добавить настройки в UI (select для API, поле ключа).

---

## 🛠️ Ключевые особенности

| Особенность | Реализация |
|-------------|------------|
| Автосохранение | `debouncedSave()` с `chrome.storage.local.set()` |
| Drag-and-Drop | `getBoundingClientRect()`, `mousemove`, `z-index`, CSS `transform` |
| Масштабирование UI | `globalSettings.uiScale`, `transform: scale()` |
| Локализация | Жёстко заданные строки, легко заменить |
| Темы | CSS-переменные, цвета Catppuccin |
| API-интеграция | `fetch()`, `WEATHER_SOURCES`, `exchangeRatesCache` |

---

## 🐛 Известные проблемы и решения

| Проблема | Причина | Решение |
|----------|--------|---------|
| Город в погоде сбрасывается | `config.city` перезаписывается при создании | `input`-обработчик + `chrome.storage.local.set()` |
| Погода не обновляется при создании | `initWeatherWidget` вызывается до `appendChild` | `setTimeout(initWeatherWidget, 0)` |
| Кнопка удаления не работает | Опечатка: `config.i d` | Исправить на `config.id` |
| Перевод не работает | `MyMemory` возвращает оригинал | Добавить `LibreTranslate` с API-ключом |
| Загрузка погоды зависает | Ошибки API не обрабатываются | Обработка `try/catch`, fallback на `wttr.in` |

---

## 📦 Зависимости

- **Встроенные**: `fetch`, `localStorage`, `canvas`, `Web Audio API`.
- **Внешние API**:
  - 🌤️ [Open-Meteo](https://open-meteo.com/) (геокодинг, прогноз).
  - 🌐 [LibreTranslate](https://libretranslate.com/) (публичный/локальный).
  - 💱 [ExchangeRate-API](https://www.exchangerate-api.com/) (курсы).
  - 🖼️ [Unsplash](https://unsplash.com/) (случайные обои, опционально).

---

## 🧪 Тестирование

- Установите как расширение: `chrome://extensions` → «Загрузить распакованное».
- Откройте `DevTools` → `Console` → проверьте на ошибки.
- Проверьте работу виджетов, drag-and-drop, сохранение настроек.
- Убедитесь, что API-запросы (погода, перевод) отрабатывают корректно.

---

## 🤝 Вклад

- 🐞 Баги? — Issues.
- ✨ Функции? — Pull Requests.
- 📄 Документация — `README.md`, `FINAL_FIX_INSTRUCTIONS.md`.

> 💡 Цель: **максимальная функциональность без серверной части**. Всё работает в браузере.