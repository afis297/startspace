// === КОНФИГУРАЦИЯ И СХЕМЫ ===
const SETTINGS_SCHEMA = {
  autoScaleFont: { label: 'Автомасштабирование шрифта', type: 'checkbox', default: false, section: 'general' },
  defaultOpacity: { label: 'Прозрачность виджетов', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.8, suffix: '%', multiplier: 100, section: 'general' },
  defaultFontFamily: { label: 'Шрифт', type: 'select', options: { "'Segoe UI', system-ui, sans-serif": 'Segoe UI', "'Roboto', sans-serif": 'Roboto', "Arial": 'Arial' }, default: "'Segoe UI', system-ui, sans-serif", section: 'general' },
  smoothAnimations: { label: 'Плавные анимации', type: 'checkbox', default: true, section: 'general' },
  snapToEdges: { label: 'Прилипание к краям (Snap)', type: 'checkbox', default: true, section: 'general' },
  showDragGrid: { label: 'Сетка при перетаскивании', type: 'checkbox', default: false, section: 'general' },
  lockWidgets: { label: 'Зафиксировать виджеты', type: 'checkbox', default: false, section: 'general' },
  dockAutoHide: { label: 'Auto-hide Dock', type: 'checkbox', default: false, section: 'dock' },
  dockHoverPreview: { label: 'Превью при наведении', type: 'checkbox', default: true, section: 'dock' },
  dockScale: { label: 'Масштаб Dock', type: 'range', min: 0.5, max: 1.5, step: 0.05, default: 1, suffix: 'x', multiplier: 1, section: 'dock' },
  dockPosition: { label: 'Позиция Dock', type: 'select', options: { 'bottom': 'Снизу', 'top': 'Сверху', 'left': 'Слева', 'right': 'Справа' }, default: 'bottom', section: 'dock' },
  lockDock: { label: 'Зафиксировать Dock', type: 'checkbox', default: false, section: 'dock' },
  wallpaperMode: { label: 'Масштаб обоев', type: 'select', options: { 'cover': 'Авто (Вписать)', 'custom': 'Ручной' }, default: 'cover', section: 'wallpaper', requiresWallpaper: true },
  wallpaperScale: { label: 'Масштаб (ручной)', type: 'range', min: 0.1, max: 3, step: 0.1, default: 1, suffix: '%', multiplier: 100, section: 'wallpaper', requiresWallpaper: true },
  wallpaperPosX: { label: 'Позиция X', type: 'range', min: -100, max: 100, step: 1, default: 0, suffix: '%', section: 'wallpaper', requiresWallpaper: true },
  wallpaperPosY: { label: 'Позиция Y', type: 'range', min: -100, max: 100, step: 1, default: 0, suffix: '%', section: 'wallpaper', requiresWallpaper: true },
  settingsPanelScale: { label: 'Масштаб окна настроек', type: 'range', min: 0.5, max: 1.5, step: 0.05, default: 1, suffix: '%', multiplier: 100, section: 'interface' },
  settingsPanelFontSize: { label: 'Размер шрифта окна настроек', type: 'range', min: 10, max: 20, step: 1, default: 14, suffix: 'px', multiplier: 1, section: 'interface' }
};

const WIDGET_STYLE_SCHEMA = {
  opacity: { label: 'Прозрачность', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.8, suffix: '%', multiplier: 100 },
  scale: { label: 'Масштаб виджета', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1, suffix: 'x', multiplier: 1 },
  fontSize: { label: 'Размер шрифта', type: 'range', min: 8, max: 48, step: 1, default: 14, suffix: 'px', multiplier: 1 },
  bgColor: { label: 'Цвет фона', type: 'color', default: '#313244' },
  textColor: { label: 'Цвет текста', type: 'color', default: '#cdd6f4' },
  borderWidth: { label: 'Толщина обводки', type: 'range', min: 0, max: 5, step: 1, default: 1 },
  borderColor: { label: 'Цвет обводки', type: 'color', default: '#45475a' },
  blur: { label: 'Эффект блюра', type: 'checkbox', default: true },
  ghostMode: { label: 'Скрывать фон (призрак)', type: 'checkbox', default: false },
  autoFontSize: { label: 'Авто-размер текста', type: 'checkbox', default: false }
};
const weatherIntervals = new Map();
const WIDGET_TYPES = {
  search: { label: 'Поиск', icon: '🔍', category: 'productivity', defaultSize: { w: 500, h: 60 }, render: () => `<div class="search-drag-handle"></div><form class="search-input-wrapper" action="https://www.google.com/search" method="GET" target="_blank"><input type="text" name="q" placeholder="Поиск..." autocomplete="off"></form>` },
  clock: {
      label: 'Часы', icon: '🕒', category: 'info', defaultSize: { w: 200, h: 100 },
      render: (c) => {
          const cfg = c.clockSettings || { mode: 'digital', format: '24', showSeconds: true };
          return cfg.mode === 'analog'
              ? `<div class="clock-analog"><div class="analog-face"><div class="hand hour-hand"></div><div class="hand minute-hand"></div><div class="hand second-hand"></div><div class="center-dot"></div></div></div>`
              : `<div class="clock-digital">00:00</div>`;
      }
  },
  link: { 
    label: 'Ссылка', 
    icon: '🔗', 
    category: 'productivity', 
    defaultSize: { w: 160, h: 60 }, 
    render: (c) => `
        <div class="widget-link-content">
            ${c.icon ? `<span style="font-size:1.5em;">${c.icon}</span>` : ''}
            <a href="${c.url || '#'}" target="_blank">${c.text || 'Link'}</a>
        </div>  `
  },
  note: { label: 'Заметка', icon: '📝', category: 'productivity', defaultSize: { w: 200, h: 120 }, render: (c) => `<div contenteditable="true">${c.content || 'Текст...'}</div>` },
  weather: { label: 'Погода', icon: '🌤️', category: 'info', defaultSize: { w: 180, h: 120 }, render: (c) => `<div class="weather-container"><div class="weather-city">${c.city || '...'}</div><div class="weather-temp">--°C</div><div class="weather-desc">Загрузка...</div></div>` },
  currency: { label: 'Валюты', icon: '💱', category: 'info', defaultSize: { w: 240, h: 160 }, render: () => `
    <div class="currency-widget">
      <div class="currency-row">
        <span class="currency-flag flag-from">🇺🇸</span>
        <input type="number" class="currency-input curr-amount" value="1" min="0" step="0.01">
        <select class="currency-select curr-from">
          <option value="USD">USD</option>
          <option value="RUB">RUB</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="JPY">JPY</option>
          <option value="CNY">CNY</option>
          <option value="KZT">KZT</option>
          <option value="BYN">BYN</option>
        </select>
      </div>
      <div class="currency-divider">⇅</div>
      <div class="currency-row">
        <span class="currency-flag flag-to">🇷🇺</span>
        <input type="number" class="currency-input curr-res" readonly placeholder="0.00">
        <select class="currency-select curr-to">
          <option value="RUB">RUB</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="JPY">JPY</option>
          <option value="CNY">CNY</option>
          <option value="KZT">KZT</option>
          <option value="BYN">BYN</option>
        </select>
      </div>
      <div class="currency-rate"></div>
    </div>`
  },
  todo: { label: 'Задачи', icon: '✅', category: 'productivity', defaultSize: { w: 280, h: 320 }, render: () => `
    <div class="todo-widget">
      <div class="todo-header">
        <div class="todo-title">📋 Мои задачи</div>
        <div class="todo-counter"><span class="todo-done-count">0</span>/<span class="todo-total-count">0</span></div>
      </div>
      <div class="todo-progress"><div class="todo-progress-bar"></div></div>
      <div class="todo-filters">
        <div class="todo-filter active" data-filter="all">Все</div>
        <div class="todo-filter" data-filter="active">Активные</div>
        <div class="todo-filter" data-filter="done">Готовые</div>
      </div>
      <div class="todo-input-row">
        <input class="todo-input" placeholder="Добавить задачу...">
        <button class="todo-add-btn">+</button>
      </div>
      <ul class="todo-list"></ul>
    </div>`
  },
  timer: { label: 'Таймер', icon: '⏱️', category: 'productivity', defaultSize: { w: 300, h: 320 }, render: (cfg) => {
      const mode = cfg?.timerMode || 'timer';
      const timerSound = cfg?.timerData?.sound || 'classic';
      return `
    <div class="timer-widget-v2">
      <div class="timer-tabs">
        <div class="timer-tab ${mode === 'timer' ? 'active' : ''}" data-tab="timer">⏱️ Таймер</div>
        <div class="timer-tab ${mode === 'stopwatch' ? 'active' : ''}" data-tab="stopwatch">⏲️ Секундомер</div>
        <div class="timer-tab ${mode === 'alarm' ? 'active' : ''}" data-tab="alarm">⏰ Будильник</div>
      </div>
      <div class="timer-tab-content" id="tab-timer">
        <div class="timer-display-v2" id="timer-display">00:00</div>
        <div class="timer-progress-container">
          <div class="timer-progress-bar" id="timer-progress"></div>
        </div>
        <div class="timer-presets">
          <button class="timer-preset-btn" data-min="1">1м</button>
          <button class="timer-preset-btn" data-min="5">5м</button>
          <button class="timer-preset-btn" data-min="10">10м</button>
          <button class="timer-preset-btn" data-min="15">15м</button>
          <button class="timer-preset-btn" data-min="25">25м</button>
          <button class="timer-preset-btn" data-min="30">30м</button>
        </div>
        <div class="timer-custom-input" style="display:none;">
          <input type="number" class="timer-min-input" placeholder="Мин" min="0" max="999">
          <span>:</span>
          <input type="number" class="timer-sec-input" placeholder="Сек" min="0" max="59">
        </div>
        <div class="timer-sound-select">
          <label>Звук:</label>
          <select class="timer-sound-choice">
            <option value="classic" ${timerSound === 'classic' ? 'selected' : ''}>Классика</option>
            <option value="gentle" ${timerSound === 'gentle' ? 'selected' : ''}>Мягкий</option>
            <option value="urgent" ${timerSound === 'urgent' ? 'selected' : ''}>Срочный</option>
          </select>
          <button class="timer-test-sound-btn">🔊</button>
        </div>
        <div class="timer-controls-v2">
          <button class="timer-btn-v2 start-btn">▶</button>
          <button class="timer-btn-v2 reset-btn">⏹</button>
        </div>
      </div>
      <div class="timer-tab-content hidden" id="tab-stopwatch">
        <div class="timer-display-v2" id="stopwatch-display">00:00.000</div>
        <div class="sw-stats" id="sw-stats"></div>
        <div class="laps-container" id="laps-container"></div>
        <div class="timer-controls-v2">
          <button class="timer-btn-v2 sw-start-btn">▶</button>
          <button class="timer-btn-v2 sw-lap-btn" style="display:none;">🏁</button>
          <button class="timer-btn-v2 sw-reset-btn">⏹</button>
        </div>
      </div>
      <div class="timer-tab-content hidden" id="tab-alarm">
        <div class="alarm-setup">
          <div class="alarm-time-picker">
            <input type="number" class="alarm-hour-input" placeholder="ЧЧ" min="0" max="23" value="07">
            <span>:</span>
            <input type="number" class="alarm-minute-input" placeholder="ММ" min="0" max="59" value="00">
          </div>
          <input type="text" class="alarm-label-input" placeholder="Название будильника..." maxlength="20">
          <div class="alarm-days">
            <button class="alarm-day-btn" data-day="1">Пн</button>
            <button class="alarm-day-btn" data-day="2">Вт</button>
            <button class="alarm-day-btn" data-day="3">Ср</button>
            <button class="alarm-day-btn" data-day="4">Чт</button>
            <button class="alarm-day-btn" data-day="5">Пт</button>
            <button class="alarm-day-btn" data-day="6">Сб</button>
            <button class="alarm-day-btn" data-day="0">Вс</button>
          </div>
          <div class="alarm-sound-row">
            <div class="alarm-sound-select">
              <select class="alarm-sound">
                <option value="classic">Классика</option>
                <option value="gentle">Мягкий</option>
                <option value="urgent">Срочный</option>
              </select>
            </div>
            <button class="alarm-test-btn" title="Проверить звук">🔊</button>
          </div>
        </div>
        <div class="alarm-list" id="alarm-list"></div>
        <button class="timer-btn-v2 add-alarm-btn" style="width:100%; margin-top:8px;">➕ Добавить будильник</button>
      </div>
    </div>`;
  }},
  calculator: { label: 'Калькулятор', icon: '🔢', category: 'productivity', defaultSize: { w: 240, h: 320 }, render: () => `
    <div class="calc-widget">
      <div class="calc-display">0</div>
      <div class="calc-buttons">
        <button class="calc-btn calc-clear">C</button>
        <button class="calc-btn calc-op" data-op="/">÷</button>
        <button class="calc-btn calc-op" data-op="*">×</button>
        <button class="calc-btn calc-op" data-op="-">−</button>
        <button class="calc-btn calc-num" data-num="7">7</button>
        <button class="calc-btn calc-num" data-num="8">8</button>
        <button class="calc-btn calc-num" data-num="9">9</button>
        <button class="calc-btn calc-op calc-op-plus" data-op="+">+</button>
        <button class="calc-btn calc-num" data-num="4">4</button>
        <button class="calc-btn calc-num" data-num="5">5</button>
        <button class="calc-btn calc-num" data-num="6">6</button>
        <button class="calc-btn calc-num" data-num="1">1</button>
        <button class="calc-btn calc-num" data-num="2">2</button>
        <button class="calc-btn calc-num" data-num="3">3</button>
        <button class="calc-btn calc-equals">=</button>
        <button class="calc-btn calc-num calc-zero" data-num="0">0</button>
        <button class="calc-btn calc-dot">.</button>
      </div>
    </div>`
  },
  calendar: { label: 'Календарь', icon: '📅', category: 'info', defaultSize: { w: 280, h: 300 }, render: (c) => {
    const now = new Date();
    const year = c.calendarYear || now.getFullYear();
    const month = c.calendarMonth != null ? c.calendarMonth : now.getMonth();
    return `<div class="calendar-widget">
      <div class="calendar-header">
        <button class="calendar-nav" data-dir="-1">‹</button>
        <span class="calendar-title"></span>
        <button class="calendar-nav" data-dir="1">›</button>
      </div>
      <div class="calendar-grid"></div>
    </div>`;
  }},
  quote: { label: 'Цитата дня', icon: '💭', category: 'info', defaultSize: { w: 300, h: 150 }, render: (c) => `
    <div class="quote-widget">
      <div class="quote-text">${c.quoteText || 'Загрузка...'}</div>
      <div class="quote-author">${c.quoteAuthor || ''}</div>
      <button class="quote-refresh">🔄</button>
    </div>`
  },
  game: { label: 'Мини-игра', icon: '🎮', category: 'fun', defaultSize: { w: 320, h: 360 }, render: (c) => {
    const gameType = c.gameType || 'snake';
    return `<div class="game-widget">
      <div class="game-tabs">
        <div class="game-tab ${gameType === 'snake' ? 'active' : ''}" data-game="snake">🐍 Змейка</div>
        <div class="game-tab ${gameType === '2048' ? 'active' : ''}" data-game="2048">🎯 2048</div>
      </div>
      <div class="game-container" id="game-container"></div>
    </div>`;
  }},
  random: { label: 'Генератор чисел', icon: '🎲', category: 'fun', defaultSize: { w: 240, h: 200 }, render: (c) => `
    <div class="random-widget">
      <div class="random-result">${c.randomResult || '?'}</div>
      <div class="random-controls">
        <input type="number" class="random-min" placeholder="Мин" value="${c.randomMin || 1}">
        <span>—</span>
        <input type="number" class="random-max" placeholder="Макс" value="${c.randomMax || 100}">
      </div>
      <button class="random-generate">🎲 Генерировать</button>
    </div>`
  },
  countdown: { 
    label: 'Счетчик дней', icon: '📆', category: 'info', defaultSize: { w: 280, h: 180 }, 
    render: (c) => `
    <div class="countdown-widget">
        <div style="font-size:1.1em; font-weight:600; color:#cdd6f4; margin-bottom:8px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.countdownTitle || 'Событие'}</div>
        <div class="countdown-display">
            <div class="countdown-value">${c.countdownDays != null ? c.countdownDays : '—'}</div>
            <div class="countdown-label">дней</div>
        </div>
    </div>`
    },
  translator: { label: 'Переводчик', icon: '🌐', category: 'productivity', defaultSize: { w: 380, h: 420 }, render: (c) => {
    const fromLang = c.translatorFrom || 'en';
    const toLang = c.translatorTo || 'ru';
    const layout = c.translatorLayout || 'vertical';
    return `
    <div class="translator-widget ${layout === 'horizontal' ? 'translator-horizontal' : ''}">
      <div class="translator-header">
        <div class="translator-lang-selector">
          <select class="translator-from">
            <option value="en" ${fromLang === 'en' ? 'selected' : ''}>🇬🇧 EN</option>
            <option value="ru" ${fromLang === 'ru' ? 'selected' : ''}>🇷🇺 RU</option>
            <option value="es" ${fromLang === 'es' ? 'selected' : ''}>🇪🇸 ES</option>
            <option value="fr" ${fromLang === 'fr' ? 'selected' : ''}>🇫🇷 FR</option>
            <option value="de" ${fromLang === 'de' ? 'selected' : ''}>🇩🇪 DE</option>
            <option value="it" ${fromLang === 'it' ? 'selected' : ''}>🇮🇹 IT</option>
            <option value="pt" ${fromLang === 'pt' ? 'selected' : ''}>🇵🇹 PT</option>
            <option value="zh" ${fromLang === 'zh' ? 'selected' : ''}>🇨🇳 ZH</option>
            <option value="ja" ${fromLang === 'ja' ? 'selected' : ''}>🇯🇵 JA</option>
            <option value="ko" ${fromLang === 'ko' ? 'selected' : ''}>🇰🇷 KO</option>
          </select>
          <button class="translator-swap" title="Поменять языки">⇄</button>
          <select class="translator-to">
            <option value="ru" ${toLang === 'ru' ? 'selected' : ''}>🇷🇺 RU</option>
            <option value="en" ${toLang === 'en' ? 'selected' : ''}>🇬🇧 EN</option>
            <option value="es" ${toLang === 'es' ? 'selected' : ''}>🇪🇸 ES</option>
            <option value="fr" ${toLang === 'fr' ? 'selected' : ''}>🇫🇷 FR</option>
            <option value="de" ${toLang === 'de' ? 'selected' : ''}>🇩🇪 DE</option>
            <option value="it" ${toLang === 'it' ? 'selected' : ''}>🇮🇹 IT</option>
            <option value="pt" ${toLang === 'pt' ? 'selected' : ''}>🇵🇹 PT</option>
            <option value="zh" ${toLang === 'zh' ? 'selected' : ''}>🇨🇳 ZH</option>
            <option value="ja" ${toLang === 'ja' ? 'selected' : ''}>🇯🇵 JA</option>
            <option value="ko" ${toLang === 'ko' ? 'selected' : ''}>🇰🇷 KO</option>
          </select>
        </div>
      </div>
      <div class="translator-body">
        <div class="translator-input-section">
          <textarea class="translator-input" placeholder="Введите текст для перевода..."></textarea>
          <div class="translator-input-footer">
            <span class="translator-char-count">0 / 500</span>
            <button class="translator-clear" title="Очистить">🗑️</button>
          </div>
        </div>
        <div class="translator-divider"></div>
        <div class="translator-output-section">
          <div class="translator-output">${c.translatorResult || 'Перевод появится здесь...'}</div>
          <div class="translator-output-footer">
            <button class="translator-copy" title="Копировать" style="opacity:0.5;">📋</button>
            <button class="translator-speak" title="Озвучить" style="opacity:0.5;">🔊</button>
          </div>
        </div>
      </div>
      <button class="translator-translate-btn">Перевести</button>
    </div>`;
  }}
};

// === КАСТОМНЫЙ CONFIRM ===
function showConfirm(title, text) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('confirm-dialog');
        dialog.querySelector('.confirm-title').textContent = title;
        dialog.querySelector('.confirm-text').textContent = text;
        dialog.classList.remove('hidden');
        const ok = document.getElementById('confirm-ok');
        const cancel = document.getElementById('confirm-cancel');
        const cleanup = (result) => {
            dialog.classList.add('hidden');
            ok.replaceWith(ok.cloneNode(true));
            cancel.replaceWith(cancel.cloneNode(true));
            resolve(result);
        };
        document.getElementById('confirm-ok').onclick = () => cleanup(true);
        document.getElementById('confirm-cancel').onclick = () => cleanup(false);
    });
}

// === ГЛОБАЛЬНОЕ СОСТОЯНИЕ ===
const GRID_SIZE = 10;
let widgets = [];
let globalSettings = { uiScale: 1, defaultOpacity: 0.8, wallpaper: null, wallpaperMode: 'cover', wallpaperScale: 1, wallpaperPosX: 0, wallpaperPosY: 0, defaultFontFamily: "'Segoe UI', system-ui, sans-serif", settingsPos: null, smoothAnimations: true, snapToEdges: true, showDragGrid: false, dockAutoHide: false, dockHoverPreview: true, dockScale: 1, dockPosition: 'bottom', lockDock: false, lockWidgets: false };
let wallpaperBlobUrl = null;
let activeWidgetId = null;
let currencyRates = { USD: 1, RUB: 90, EUR: 0.92 };
let topZIndex = 100;

// === ОПТИМИЗАЦИЯ: Debounce для сохранений ===
let saveTimeout = null;
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveWidgets(), 1000);
}

async function saveWidgets() {
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    await chrome.storage.local.set({ widgets, settings: globalSettings });
}

async function saveSettings() {
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    await chrome.storage.local.set({ settings: globalSettings });
}

// Конвертирует base64 → Blob URL и освобождает base64 из памяти
function applyWallpaperFromBase64(base64) {
    if (wallpaperBlobUrl) { URL.revokeObjectURL(wallpaperBlobUrl); wallpaperBlobUrl = null; }
    if (!base64) { document.body.style.backgroundImage = 'none'; return; }
    const [header, data] = base64.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    wallpaperBlobUrl = URL.createObjectURL(new Blob([arr], { type: mime }));
    document.body.style.backgroundImage = `url(${wallpaperBlobUrl})`;
    // Освобождаем base64 из памяти — он больше не нужен до следующей перезагрузки
    globalSettings.wallpaper = true; // маркер «обои есть», без хранения строки
}

// === УТИЛИТЫ ===
function ensureStyle(w) {
    if (!w.style) w.style = { opacity: 0.8, scale: 1, fontSize: 14, bgColor: '#313244', textColor: '#cdd6f4', borderWidth: 1, borderColor: '#45475a', blur: true, ghostMode: false, autoFontSize: false };
    if (w.style.opacity == null) w.style.opacity = globalSettings.defaultOpacity;
    if (w.style.scale == null) w.style.scale = 1;
    if (w.style.fontSize == null) w.style.fontSize = 14;
    if (!w.style.bgColor) w.style.bgColor = '#313244';
    if (!w.style.textColor) w.style.textColor = '#cdd6f4';
    if (w.style.borderWidth == null) w.style.borderWidth = 1;
    if (!w.style.borderColor) w.style.borderColor = '#45475a';
    if (w.style.blur == null) w.style.blur = true;
    if (w.style.ghostMode == null) w.style.ghostMode = false;
    if (w.style.autoFontSize == null) w.style.autoFontSize = false;
    if (w.type === 'clock' && !w.clockSettings) w.clockSettings = { mode: 'digital', format: '24', showSeconds: true };
}

function snapToGrid(val) { return Math.round(val / GRID_SIZE) * GRID_SIZE; }

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// === ОБОИ ===
function applyWallpaperTransform() {
    if (globalSettings.wallpaperMode === 'cover') {
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    } else {
        document.body.style.backgroundSize = `${(globalSettings.wallpaperScale || 1) * 100}%`;
        document.body.style.backgroundPosition = `${50 + (globalSettings.wallpaperPosX || 0)}% ${50 + (globalSettings.wallpaperPosY || 0)}%`;
    }
}

// === СТИЛИ ВИДЖЕТОВ ===
function applyWidgetStyle(config) {
    const el = document.getElementById(config.id);
    if (!el) return;
    ensureStyle(config);
    
    if (config.style.ghostMode) {
        el.classList.add('ghost-mode');
    } else {
        el.classList.remove('ghost-mode');
        const op = config.style.opacity;
        const bg = config.style.bgColor;
        const r = parseInt(bg.slice(1, 3), 16), g = parseInt(bg.slice(3, 5), 16), b = parseInt(bg.slice(5, 7), 16);
        el.style.background = config.type === 'search' && bg === '#313244'
            ? `rgba(${r},${g},${b},${Math.min(1, op + 0.2)})`
            : `rgba(${r},${g},${b},${op})`;
        el.style.border = config.style.borderWidth > 0 ? `${config.style.borderWidth}px solid ${config.style.borderColor}` : 'none';
    }
    
    // Блюр через CSS класс
    if (config.style.blur) {
        el.classList.add('widget-blur');
    } else {
        el.classList.remove('widget-blur');
    }
    
    // Масштаб (виджет + глобальный)
    const widgetScale = config.style.scale ?? 1;
    const uiScale = globalSettings.uiScale ?? 1;
    const totalScale = widgetScale * uiScale;
    el.style.transform = `scale(${totalScale})`;
    el.style.transformOrigin = 'top left';
    
    // Размер шрифта - применяем ВСЕГДА если он установлен
    if (config.style.fontSize && !config.style.autoFontSize) {
        el.style.fontSize = config.style.fontSize + 'px';
    } else if (!config.style.autoFontSize) {
        el.style.fontSize = '';
    }
    
    // Цвет текста
    if (config.style.textColor) {
        el.style.color = config.style.textColor;
    }

    // 🔥 ПРИМЕНЕНИЕ ШРИФТА ДЛЯ ВАЛЮТ
    if (config.type === 'currency') {
        const inputs = el.querySelectorAll('.currency-input, .currency-select, .currency-rate');
        inputs.forEach(i => {
            if (config.style.fontSize && !config.style.autoFontSize) {
                i.style.fontSize = config.style.fontSize + 'px';
            }
        });
    }

    // Авто-размер текста
    if (config.style.autoFontSize) {
        updateAutoFontSize(config, el);
    }
    
    // Авто-размер текста
    if (config.style.autoFontSize) {
        updateAutoFontSize(config, el);
    }
    
    // Применяем размеры и позицию из конфига
    el.style.width = config.size.w + 'px';
    el.style.height = config.size.h + 'px';
    el.style.left = config.pos.x + 'px';
    el.style.top = config.pos.y + 'px';
}

// === АВТО-РАЗМЕР ТЕКСТА ===
function updateAutoFontSize(config, el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const baseSize = Math.max(10, Math.min(48, Math.min(w / 6, h / 3)));
    
    if (config.type === 'clock') {
        const textEl = el.querySelector('.clock-digital') || el.querySelector('.clock-analog');
        if (textEl) textEl.style.fontSize = baseSize + 'px';
    }
    else if (config.type === 'timer') {
        const disp = el.querySelector('.timer-display-v2');
        if (disp) disp.style.fontSize = Math.max(14, baseSize * 1.5) + 'px';
    }
    else if (config.type === 'weather') {
        const temp = el.querySelector('.weather-temp');
        const city = el.querySelector('.weather-city');
        const desc = el.querySelector('.weather-desc');
        if (temp) temp.style.fontSize = Math.max(14, baseSize * 1.5) + 'px';
        if (city) city.style.fontSize = Math.max(8, baseSize * 0.5) + 'px';
        if (desc) desc.style.fontSize = Math.max(8, baseSize * 0.45) + 'px';
    }
    else if (config.type === 'currency') {
        const inputs = el.querySelectorAll('.currency-input, .currency-select');
        inputs.forEach(i => i.style.fontSize = Math.max(9, baseSize * 0.6) + 'px');
    }
    else if (config.type === 'note') {
        const content = el.querySelector('[contenteditable]');
        if (content) content.style.fontSize = baseSize + 'px';
    }
    else if (config.type === 'link') {
        const a = el.querySelector('a');
        if (a) a.style.fontSize = Math.max(9, baseSize * 0.7) + 'px';
    }
    else if (config.type === 'todo') {
        const items = el.querySelectorAll('.todo-text, .todo-input');
        items.forEach(i => i.style.fontSize = Math.max(9, baseSize * 0.55) + 'px');
    }
    else if (config.type === 'search') {
        const input = el.querySelector('input');
        if (input) input.style.fontSize = Math.max(10, baseSize * 0.8) + 'px';
    }
    // 🔥 ДОБАВЬТЕ ЭТОТ БЛОК:
    else if (config.type === 'translator') {
        const inputArea = el.querySelector('.translator-input');
        const output = el.querySelector('.translator-output');
        const fromSelect = el.querySelector('.translator-from');
        const toSelect = el.querySelector('.translator-to');
        const translateBtn = el.querySelector('.translator-translate-btn');
        
        if (inputArea) inputArea.style.fontSize = Math.max(12, baseSize * 0.7) + 'px';
        if (output) output.style.fontSize = Math.max(12, baseSize * 0.7) + 'px';
        if (fromSelect) fromSelect.style.fontSize = Math.max(11, baseSize * 0.65) + 'px';
        if (toSelect) toSelect.style.fontSize = Math.max(11, baseSize * 0.65) + 'px';
        if (translateBtn) translateBtn.style.fontSize = Math.max(12, baseSize * 0.7) + 'px';
    }
}

// === ПОГОДА: МУЛЬТИ-ИСТОЧНИКИ ===
const WEATHER_SOURCES = {
  openMeteo: {
    name: 'Open-Meteo',
    requiresKey: false,
    async geocode(city) {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) throw new Error('City not found');
      return { latitude: data.results[0].latitude, longitude: data.results[0].longitude, name: data.results[0].name };
    },
    async fetchWeather({ latitude, longitude }) {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=celsius`);
      const data = await res.json();
      if (!data.current_weather) throw new Error('No weather data');
      return {
        temp: Math.round(data.current_weather.temperature),
        code: data.current_weather.weathercode,
        desc: getOpenMeteoDesc(data.current_weather.weathercode)
      };
    }
  },
  wttrIn: {
    name: 'wttr.in',
    requiresKey: false,
    async fetchWeather({ city }) {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      if (!res.ok) throw new Error('wttr.in error');
      const data = await res.json();
      if (!data.current_condition || !data.current_condition.length) throw new Error('No data');
      const cur = data.current_condition[0];
      return {
        temp: Math.round(parseInt(cur.temp_C)),
        code: wttrCodeToWMO(parseInt(cur.weatherCode)),
        desc: cur.lang_ru && cur.lang_ru[0] ? cur.lang_ru[0].value : cur.weatherDesc[0].value
      };
    }
  },
  openWeatherMap: {
    name: 'OpenWeatherMap',
    requiresKey: true,
    async fetchWeather({ city, apiKey }) {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ru`);
      if (!res.ok) throw new Error(`OWM error: ${res.status}`);
      const data = await res.json();
      return {
        temp: Math.round(data.main.temp),
        code: owmCodeToWMO(data.weather[0].id),
        desc: data.weather[0].description,
        name: data.name
      };
    }
  },
  weatherAPI: {
    name: 'WeatherAPI',
    requiresKey: true,
    async fetchWeather({ city, apiKey }) {
      const res = await fetch(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&lang=ru`);
      if (!res.ok) throw new Error(`WeatherAPI error: ${res.status}`);
      const data = await res.json();
      return {
        temp: Math.round(data.current.temp_c),
        code: wapiCodeToWMO(data.current.condition.code),
        desc: data.current.condition.text,
        name: data.location.name
      };
    }
  }
};

// Коды погоды WMO: 0-ясно, 1-преим.ясно, 2-облачно, 3-пасмурно, 45-туман, 51-морось, 61-дождь, 71-снег, 95-гроза
function getOpenMeteoDesc(code) {
  const descs = { 0: 'Ясно', 1: 'Преим. ясно', 2: 'Облачно', 3: 'Пасмурно', 45: 'Туман', 48: 'Иней', 51: 'Морось', 53: 'Умер. морось', 55: 'Сильн. морось',
    61: 'Дождь', 63: 'Сильн. дождь', 65: 'Очень сильн. дождь', 66: 'Лед. дождь', 67: 'Сильн. лед. дождь',
    71: 'Снег', 73: 'Сильн. снег', 75: 'Очень сильн. снег', 77: 'Снеж. зерна',
    80: 'Ливень', 81: 'Сильн. ливень', 82: 'Оч. сильн. ливень',
    85: 'Снеж. ливень', 86: 'Сильн. снеж. ливень', 95: 'Гроза', 96: 'Гроза с градом', 99: 'Сильн. гроза с градом' };
  return descs[code] || '...';
}

function wttrCodeToWMO(code) {
  // wttr.in использует коды, похожие на WMO
  if (code === 113) return 0;
  if (code === 116) return 2;
  if (code === 119 || code === 122) return 3;
  if (code === 143 || code === 248 || code === 260) return 45;
  if (code >= 176 && code <= 299) return 61; // дождь
  if (code >= 300 && code <= 399) return 51; // морось
  if (code >= 500 && code <= 599) return 71; // снег
  if (code >= 600 && code <= 699) return 71; // снег
  if (code >= 950 && code <= 999) return 95; // гроза
  return 3;
}

function owmCodeToWMO(id) {
  if (id >= 200 && id < 300) return 95;
  if (id >= 300 && id < 400) return 51;
  if (id >= 500 && id < 510) return 61;
  if (id >= 510 && id < 520) return 66;
  if (id >= 520 && id < 600) return 61;
  if (id >= 600 && id < 700) return 71;
  if (id >= 700 && id < 800) return 45;
  if (id === 800) return 0;
  if (id === 801) return 1;
  if (id === 802) return 2;
  if (id > 802) return 3;
  return 3;
}

function wapiCodeToWMO(code) {
  if (code === 1000) return 0;
  if (code === 1003) return 2;
  if (code === 1006) return 3;
  if (code === 1009) return 3;
  if (code === 1030 || code === 1135 || code === 1147) return 45;
  if (code >= 1063 && code <= 1150) return 61;
  if (code >= 1168 && code <= 1204) return 66;
  if (code >= 1210 && code <= 1225) return 71;
  if (code >= 1240 && code <= 1255) return 80;
  if (code >= 1273 && code <= 1282) return 95;
  return 3;
}

async function fetchWeatherFromSources(city, preferredSource = null) {
    // 🔥 Если указан конкретный источник, используем только его
    if (preferredSource && WEATHER_SOURCES[preferredSource]) {
        const source = WEATHER_SOURCES[preferredSource];
        let args = { city };
        
        // Для Open-Meteo нужна геокодировка
        if (preferredSource === 'openMeteo') {
            const geoData = await source.geocode(city);
            args = { latitude: geoData.latitude, longitude: geoData.longitude };
        }
        
        // Для источников с ключом
        if (source.requiresKey) {
            const settings = await chrome.storage.local.get('weatherApiKeys');
            const apiKey = preferredSource === 'openWeatherMap' 
                ? settings.weatherApiKeys?.openWeatherMap 
                : settings.weatherApiKeys?.weatherAPI;
            
            if (!apiKey) throw new Error(`API ключ не настроен для ${source.name}`);
            args.apiKey = apiKey;
        }
        
        const data = await source.fetchWeather(args);
        return { ...data, source: source.name, name: data.name || city };
    }
    
    // 🔥 Если источник не указан - пробуем все по порядку (старая логика)
    const geoData = await WEATHER_SOURCES.openMeteo.geocode(city);
    const sourcesToTry = [
        { source: WEATHER_SOURCES.openMeteo, args: { latitude: geoData.latitude, longitude: geoData.longitude } },
        { source: WEATHER_SOURCES.wttrIn, args: { city } }
    ];
    
    const settings = await chrome.storage.local.get('weatherApiKeys');
    if (settings.weatherApiKeys?.openWeatherMap) {
        sourcesToTry.push({
            source: WEATHER_SOURCES.openWeatherMap,
            args: { city, apiKey: settings.weatherApiKeys.openWeatherMap }
        });
    }
    if (settings.weatherApiKeys?.weatherAPI) {
        sourcesToTry.push({
            source: WEATHER_SOURCES.weatherAPI,
            args: { city, apiKey: settings.weatherApiKeys.weatherAPI }
        });
    }
    
    for (const { source, args } of sourcesToTry) {
        try {
            const data = await source.fetchWeather(args);
            return { ...data, source: source.name, name: data.name || geoData.name };
        } catch (e) {
            console.log(`Weather source ${source.name} failed:`, e.message);
        }
    }
    
    throw new Error('Все источники погоды недоступны');
}


// === ЗАПУСК ===
document.addEventListener('DOMContentLoaded', async () => {
    const data = await chrome.storage.local.get({ widgets: [], settings: globalSettings });
    widgets = data.widgets;
    globalSettings = { ...globalSettings, ...data.settings };
    
    let needsSave = false; // Уже объявлена ниже, но можно оставить для ясности
    widgets.forEach(w => {
        if (w.type === 'weather' && !w.city && w.content) {
            w.city = w.content;
            delete w.content;
            console.log(`[MIGRATION] Widget ${w.id}: migrated 'content' → 'city' = "${w.city}"`);
            needsSave = true;
        }
    });
    if (needsSave) await saveWidgets();


    if (globalSettings.wallpaper) {
        // Миграция: если старые данные хранят base64 прямо в globalSettings
        if (typeof globalSettings.wallpaper === 'string' && globalSettings.wallpaper.startsWith('data:')) {
            await chrome.storage.local.set({ wallpaperData: globalSettings.wallpaper });
            globalSettings.wallpaper = true;
            await saveSettings();
        }
        const wpData = await chrome.storage.local.get('wallpaperData');
        if (wpData.wallpaperData) {
            applyWallpaperFromBase64(wpData.wallpaperData);
            // btn-reset-wallpaper рендерится динамически на вкладке обоев
        }
    }
    applyWallpaperTransform();

    //let needsSave = false;
    widgets.forEach(w => {
        ensureStyle(w);
        if (w.minimized == null) { w.minimized = false; needsSave = true; }
        // Миграция: добавляем blur для старых виджетов
        if (w.style && w.style.blur == null) { w.style.blur = true; needsSave = true; }
        // Миграция старых таймеров
        if (w.type === 'timer') {
            if (!w.timerData) { w.timerData = { remaining: 0, isRunning: false, sound: 'classic', totalDuration: 0 }; needsSave = true; }
            if (w.timerData.sound == null) w.timerData.sound = 'classic';
            if (w.timerData.totalDuration == null) w.timerData.totalDuration = 0;
            if (!w.stopwatchData) { w.stopwatchData = { elapsed: 0, isRunning: false, laps: [] }; needsSave = true; }
            if (!w.timerMode) { w.timerMode = 'timer'; needsSave = true; }
        }
    });
    if (needsSave) await saveWidgets();

    document.body.style.fontFamily = globalSettings.defaultFontFamily;

    // Применение глобального масштаба интерфейса
    const uiScale = globalSettings.uiScale ?? 1;
    document.documentElement.style.fontSize = `${uiScale * 100}%`;
    // Применяем масштаб к панелям и меню
    setTimeout(() => {
        const dockScale = (globalSettings.dockScale ?? 1) * uiScale;
        document.getElementById('bottom-panel').style.transform = document.getElementById('bottom-panel').style.transform.replace(/scale\([^)]*\)/, '') + ` scale(${dockScale})`;
        document.getElementById('settings-panel').style.transform = `scale(${uiScale})`;
        document.getElementById('settings-panel').style.transformOrigin = 'center center';
        document.getElementById('widget-context-menu').style.transform = `scale(${uiScale})`;
        document.getElementById('widget-context-menu').style.transformOrigin = 'center center';
        const widgetMenu = document.getElementById('widget-menu');
        widgetMenu.style.transform = `translateX(-50%) scale(${uiScale})`;
        widgetMenu.style.transformOrigin = 'center bottom';
        document.getElementById('confirm-dialog').style.transform = `scale(${uiScale})`;
    }, 0);

    // Применение классов для новых настроек
    if (globalSettings.smoothAnimations !== false) document.body.classList.add('smooth-animations');

    // Создание оверлея сетки
    if (!document.getElementById('drag-grid-overlay')) {
        const gridOverlay = document.createElement('div');
        gridOverlay.id = 'drag-grid-overlay';
        document.body.appendChild(gridOverlay);
    }

    widgets.forEach(w => createWidgetDOM(w));

    initSettingsPanel();
    applyDockAutoHide();
    applyDockPosition();
    initWidgetStyleMenu();
    initDragResize();
    initMenu();
    initGlobalSettings();
    initContextMenu();
    initDraggableWindows();
    initDockDrag();
    renderDock();

    // Применяем автомасштабирование шрифта при загрузке
    if (globalSettings.autoScaleFont) {
        applyAutoScaleFont();
    }

    setTimeout(() => {
        const searchInput = document.querySelector('.search-input-wrapper input');
        if (searchInput) searchInput.focus();
    }, 100);

    startGlobalAnimationLoop();
    setInterval(fetchAllCurrencies, 300000);
    fetchAllCurrencies();
});

// === АНИМАЦИЯ: ЧАСЫ и ТАЙМЕРЫ ===
let lastTimerTick = 0;
let rafId = null;
function startGlobalAnimationLoop(timestamp = 0) {
    if (!document.hidden) {
        updateClocks(timestamp);
        updateTimers(timestamp);
    }
    rafId = requestAnimationFrame(startGlobalAnimationLoop);
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else {
        if (!rafId) startGlobalAnimationLoop();
    }
});

function updateClocks(timestamp) {
    if (!timestamp) return;
    const now = new Date();
    widgets.filter(w => w.type === 'clock').forEach(w => {
        const el = document.getElementById(w.id);
        if (!el) return;
        const cfg = w.clockSettings || { mode: 'digital', format: '24', showSeconds: true };
        if (cfg.mode === 'digital') {
            let elText = el.querySelector('.clock-digital');
            if (!elText) {
                el.innerHTML = WIDGET_TYPES.clock.render(w) + `<button class="widget-menu-btn">⋮</button><div class="resize-handle"></div>`;
                elText = el.querySelector('.clock-digital');
            }
            const opts = { hour: '2-digit', minute: '2-digit', second: cfg.showSeconds ? '2-digit' : undefined, hour12: cfg.format === '12' };
            elText.textContent = now.toLocaleTimeString([], opts);
        } else {
            let face = el.querySelector('.analog-face');
            if (!face) {
                el.innerHTML = WIDGET_TYPES.clock.render(w) + `<button class="widget-menu-btn">⋮</button><div class="resize-handle"></div>`;
                face = el.querySelector('.analog-face');
            }
            const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours();
            const secHand = el.querySelector('.second-hand');
            const minHand = el.querySelector('.minute-hand');
            const hrHand = el.querySelector('.hour-hand');
            if (secHand) secHand.style.transform = `rotate(${sec * 6}deg)`;
            if (minHand) minHand.style.transform = `rotate(${min * 6 + sec * 0.1}deg)`;
            if (hrHand) hrHand.style.transform = `rotate(${(hr % 12) * 30 + min * 0.5}deg)`;
        }
    });
}

// === ВАЛЮТЫ ===
let currencyCache = null;
let currencyCacheTime = 0;
const CURRENCY_CACHE_TTL = 300000;

async function fetchAllCurrencies() {
    const now = Date.now();
    if (currencyCache && (now - currencyCacheTime) < CURRENCY_CACHE_TTL) {
        currencyRates = currencyCache;
        updateCurrencyDisplays();
        return;
    }
    try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        currencyRates = data.rates;
        currencyCache = data.rates;
        currencyCacheTime = now;
        updateCurrencyDisplays();
    } catch (e) { console.log('Currency API fallback'); }
}

function updateCurrencyDisplays() {
    widgets.filter(w => w.type === 'currency').forEach(w => {
        const el = document.getElementById(w.id);
        if (!el) return;
        const amount = parseFloat(el.querySelector('.curr-amount')?.value || 1);
        const from = el.querySelector('.curr-from')?.value || 'USD';
        const to = el.querySelector('.curr-to')?.value || 'RUB';
        const resInput = el.querySelector('.curr-res');
        const rateDiv = el.querySelector('.currency-rate');

        if (resInput && currencyRates[from] && currencyRates[to]) {
            const result = (amount / currencyRates[from]) * currencyRates[to];
            resInput.value = result.toFixed(2);
            const rate = (1 / currencyRates[from]) * currencyRates[to];
            if (rateDiv) rateDiv.textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
        }

        const flagFrom = el.querySelector('.flag-from');
        const flagTo = el.querySelector('.flag-to');
        if (flagFrom) flagFrom.textContent = getCurrencyFlag(from);
        if (flagTo) flagTo.textContent = getCurrencyFlag(to);
    });
}

function getCurrencyFlag(code) {
    const flags = {'USD': '🇺🇸', 'EUR': '🇪🇺', 'RUB': '🇷🇺', 'GBP': '🇬🇧', 'JPY': '🇯🇵', 'CNY': '🇨🇳', 'KZT': '🇰🇿', 'BYN': '🇧🇾'};
    return flags[code] || '💱';
}

function initCurrencyWidget(el) {
    const fromSelect = el.querySelector('.curr-from');
    const toSelect = el.querySelector('.curr-to');
    const amountInput = el.querySelector('.curr-amount');
    const swapBtn = el.querySelector('.currency-divider');

    // Начальный расчёт
    updateCurrencyDisplays();

    // Обработчики изменений
    el.querySelectorAll('input, select').forEach(i => {
        i.addEventListener('input', () => updateCurrencyDisplays());
    });

    // Кнопка swap (меняем валюты местами)
    if (swapBtn) {
        swapBtn.style.cursor = 'pointer';
        swapBtn.title = 'Поменять валюты местами';
        swapBtn.onclick = (e) => {
            e.stopPropagation();
            const fromVal = fromSelect.value;
            const toVal = toSelect.value;
            fromSelect.value = toVal;
            toSelect.value = fromVal;
            updateCurrencyDisplays();
        };
    }
}

// === ТАЙМЕРЫ, СЕКУНДОМЕР, БУДИЛЬНИКИ ===
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playAlarmSound(type = 'classic') {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'classic') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
    } else if (type === 'gentle') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
    }

    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
}

function formatTime(ms, showMs = false) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const msPart = ms % 1000;
    if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}${showMs ? `.${msPart.toString().padStart(3, '0')}` : ''}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}${showMs ? `.${msPart.toString().padStart(3, '0')}` : ''}`;
}

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const msPart = Math.floor((ms % 1000) / 10);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (m > 0) return `${m}:${s.toString().padStart(2, '0')}.${msPart.toString().padStart(2, '0')}`;
    return `${s}.${msPart.toString().padStart(2, '0')}с`;
}

let activeTimerAnimations = new Map();

function updateTimers(timestamp) {
    if (!timestamp) return;
    if (timestamp - lastTimerTick < 100) return;
    lastTimerTick = timestamp;

    const now = new Date();

    widgets.filter(w => w.type === 'timer').forEach(w => {
        const el = document.getElementById(w.id);
        if (!el) return;
        const mode = w.timerMode || 'timer';

        // ТАЙМЕР
        if (mode === 'timer') {
            const display = el.querySelector('#timer-display');
            const progressBar = el.querySelector('#timer-progress');

            if (w.timerData?.isRunning) {
                const prevRemaining = w.timerData.remaining;
                w.timerData.remaining = Math.max(0, w.timerData.remaining - 100);

                if (display) display.textContent = formatTime(w.timerData.remaining);

                // Обновление прогресс-бара
                if (progressBar && w.timerData.totalDuration > 0) {
                    const progress = ((w.timerData.totalDuration - w.timerData.remaining) / w.timerData.totalDuration) * 100;
                    progressBar.style.width = `${progress}%`;
                }

                // Визуальное предупреждение при мало времени (< 10 сек)
                if (w.timerData.remaining <= 10000 && w.timerData.remaining > 0) {
                    display?.classList.add('timer-warning');
                } else {
                    display?.classList.remove('timer-warning');
                }

                if (w.timerData.remaining <= 0 && prevRemaining > 0) {
                    w.timerData.isRunning = false;
                    const btn = el.querySelector('.start-btn');
                    if (btn) btn.textContent = '▶';
                    display?.classList.remove('timer-warning');
                    display?.classList.add('timer-finished');
                    setTimeout(() => display?.classList.remove('timer-finished'), 3000);
                    playAlarmSound(w.timerData.sound || 'classic');
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
                    debouncedSave();
                }
            } else if (progressBar) {
                // При сбросе сбрасываем прогресс-бар
                if (w.timerData.remaining === 0) {
                    progressBar.style.width = '0%';
                }
            }
        }

        // СЕКУНДОМЕР
        if (mode === 'stopwatch' && w.stopwatchData?.isRunning) {
            w.stopwatchData.elapsed += 100;
            const display = el.querySelector('#stopwatch-display');
            if (display) display.textContent = formatTime(w.stopwatchData.elapsed, true);
        }

    });
}

// === ЗАДАЧИ (TODO) ===
// === ЗАДАЧИ (TODO) ===
function initTodoWidget(el, config) {
    if (!config.todos) config.todos = [];

    const input = el.querySelector('.todo-input');
    const addBtn = el.querySelector('.todo-add-btn');
    const list = el.querySelector('.todo-list');
    const filters = el.querySelectorAll('.todo-filter');
    const progressBar = el.querySelector('.todo-progress-bar');
    const doneCount = el.querySelector('.todo-done-count');
    const totalCount = el.querySelector('.todo-total-count');

    let currentFilter = 'all';

    const updateProgress = () => {
        const total = config.todos.length;
        const done = config.todos.filter(t => t.done).length;
        const progress = total > 0 ? (done / total) * 100 : 0;
        if (progressBar) progressBar.style.width = progress + '%';
        if (doneCount) doneCount.textContent = done;
        if (totalCount) totalCount.textContent = total;
    };

    const renderTodos = () => {
        list.innerHTML = '';
        let filteredTodos = config.todos;

        if (currentFilter === 'active') filteredTodos = config.todos.filter(t => !t.done);
        else if (currentFilter === 'done') filteredTodos = config.todos.filter(t => t.done);

        if (filteredTodos.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'todo-empty';
            empty.innerHTML = `
                <div class="todo-empty-icon">📝</div>
                <div>${currentFilter === 'done' ? 'Нет выполненных задач' : currentFilter === 'active' ? 'Все задачи выполнены!' : 'Список задач пуст'}</div>
            `;
            list.appendChild(empty);
            updateProgress();
            return;
        }

        filteredTodos.forEach((todo, i) => {
            const realIndex = config.todos.indexOf(todo);
            const li = document.createElement('li');
            const priorityClass = todo.priority ? `priority-${todo.priority}` : '';
            li.className = `todo-item ${todo.done ? 'done' : ''} ${priorityClass}`;

            // Определение эмодзи приоритета
            const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[todo.priority] || '⚪';

            // Формирование HTML элемента задачи с чекбоксом слева, текстом по центру и кнопками справа
            li.innerHTML = `
                <div class="todo-check-wrapper">
                    <div class="todo-check-custom ${todo.done ? 'checked' : ''}">
                        <div class="todo-check-mark">✓</div>
                    </div>
                    <input type="checkbox" class="todo-check" ${todo.done ? 'checked' : ''}>
                </div>
                <span class="todo-text">${todo.text}</span>
                <div class="todo-actions">
                    ${todo.repeatIntervalDays && todo.repeatIntervalDays > 0 
                        ? `<span class="todo-repeat-indicator">↻ ${todo.repeatIntervalDays}д</span>` 
                        : ''}
                    <span class="todo-priority-btn">${priorityEmoji}</span>
                    <span class="todo-del">×</span>
                </div>
            `;

            const checkbox = li.querySelector('.todo-check');
            const customCheck = li.querySelector('.todo-check-custom');

            // Логика отметки выполнения с учетом повтора
            const toggleDone = () => {
                const todoObj = config.todos[realIndex];
                
                if (checkbox.checked) {
                    // Задача отмечается как выполнена
                    todoObj.done = true;
                    
                    // Проверяем наличие интервала повтора
                    if (todoObj.repeatIntervalDays && todoObj.repeatIntervalDays > 0) {
                        // Создаем новую задачу с тем же текстом и интервалом
                        const newTodo = {
                            text: todoObj.text,
                            done: false, // Новая задача начинается как невыполненная
                            priority: todoObj.priority, // Наследуем приоритет
                            repeatIntervalDays: todoObj.repeatIntervalDays // Наследуем интервал
                        };
                        
                        // Добавляем новую задачу в начало общего списка
                        config.todos.unshift(newTodo);
                    }
                } else {
                    // Задача снимается с выполнения
                    todoObj.done = false;
                }

                // Перерисовываем список
                renderTodos();
                // Сохраняем изменения
                debouncedSave();
            };

            checkbox.onchange = toggleDone;
            customCheck.onclick = (e) => {
                e.stopPropagation();
                // Переключаем чекбокс программно, чтобы сработал toggleDone
                checkbox.checked = !checkbox.checked;
                // Обновляем внешний вид кастомного чекбокса
                customCheck.classList.toggle('checked', checkbox.checked);
                toggleDone(); // Вызываем логику
            };

            // Изменение приоритета
            li.querySelector('.todo-priority-btn').onclick = (e) => {
                e.stopPropagation();
                const priorities = [null, 'low', 'medium', 'high'];
                const current = priorities.indexOf(todo.priority);
                const next = (current + 1) % priorities.length;
                config.todos[realIndex].priority = priorities[next];
                renderTodos(); // Перерисовываем, чтобы обновить эмодзи и стиль
                debouncedSave();
            };

            // Удаление задачи
            li.querySelector('.todo-del').onclick = (e) => {
                e.stopPropagation();
                li.style.animation = 'todoSlideOut 0.3s ease-out';
                setTimeout(() => {
                    config.todos.splice(realIndex, 1); // Удаляем из основного массива
                    renderTodos(); // Перерисовываем список
                    debouncedSave();
                }, 250);
            };

            list.appendChild(li);
        });
        updateProgress();
    };

    const addTodo = () => {
        const text = input.value.trim();
        if (text) {
            // Новый объект задачи включает поле repeatIntervalDays
            config.todos.unshift({ text, done: false, priority: null, repeatIntervalDays: null });
            input.value = '';
            renderTodos();
            debouncedSave();
        }
    };

    addBtn.onclick = (e) => { e.stopPropagation(); addTodo(); };
    input.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo(); } };

    // Фильтры
    filters.forEach(filter => {
        filter.onclick = (e) => {
            e.stopPropagation();
            currentFilter = filter.dataset.filter;
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            renderTodos();
        };
    });

    renderTodos();
}

function initTimerWidget(el, config) {
    // Инициализация данных
    if (!config.timerData) config.timerData = { remaining: 0, isRunning: false, sound: 'classic', totalDuration: 0 };
    if (!config.stopwatchData) config.stopwatchData = { elapsed: 0, isRunning: false, laps: [] };
    if (!config.timerMode) config.timerMode = 'timer';

    // === ТАБЫ ===
    el.querySelectorAll('.timer-tab').forEach(tab => {
        tab.onclick = (e) => {
            e.stopPropagation();
            config.timerMode = tab.dataset.tab;
            el.querySelectorAll('.timer-tab').forEach(t => t.classList.remove('active'));
            el.querySelectorAll('.timer-tab-content').forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            el.querySelector(`#tab-${tab.dataset.tab}`)?.classList.remove('hidden');
            debouncedSave();
        };
    });

    // Активировать нужный таб
    el.querySelectorAll('.timer-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === config.timerMode);
    });
    el.querySelectorAll('.timer-tab-content').forEach(c => c.classList.add('hidden'));
    el.querySelector(`#tab-${config.timerMode}`)?.classList.remove('hidden');

    // === ТАЙМЕР ===
    const timerDisplay = el.querySelector('#timer-display');
    const startBtn = el.querySelector('.start-btn');
    const resetBtn = el.querySelector('.reset-btn');
    const progressBar = el.querySelector('#timer-progress');
    const soundSelect = el.querySelector('.timer-sound-choice');
    const testSoundBtn = el.querySelector('.timer-test-sound-btn');

    // Выбор звука
    if (soundSelect) {
        soundSelect.value = config.timerData.sound || 'classic';
        soundSelect.onchange = (e) => {
            e.stopPropagation();
            config.timerData.sound = e.target.value;
            debouncedSave();
        };
    }

    // Тест звука
    if (testSoundBtn) {
        testSoundBtn.onclick = (e) => {
            e.stopPropagation();
            playAlarmSound(config.timerData.sound || 'classic');
        };
    }

    // Пресеты
    const setTimerDuration = (ms) => {
        config.timerData.remaining = ms;
        config.timerData.totalDuration = ms;
        config.timerData.isRunning = false;
        timerDisplay.textContent = formatTime(config.timerData.remaining);
        if (progressBar) progressBar.style.width = '0%';
        startBtn.textContent = '▶';
        timerDisplay.classList.remove('timer-warning', 'timer-finished');
        debouncedSave();
    };

    el.querySelectorAll('.timer-preset-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const min = parseInt(btn.dataset.min);
            setTimerDuration(min * 60000);
        };
    });

    // Показать/скрыть кастомный ввод при правом клике на пресет
    const customInput = el.querySelector('.timer-custom-input');
    const presetsContainer = el.querySelector('.timer-presets');
    if (presetsContainer) {
        presetsContainer.oncontextmenu = (e) => {
            e.preventDefault();
            customInput.style.display = customInput.style.display === 'none' ? 'flex' : 'none';
        };
    }

    // Кастомный ввод
    const minInput = el.querySelector('.timer-min-input');
    const secInput = el.querySelector('.timer-sec-input');
    const updateCustomTime = () => {
        const m = parseInt(minInput?.value) || 0;
        const s = parseInt(secInput?.value) || 0;
        const ms = (m * 60 + s) * 1000;
        config.timerData.remaining = ms;
        config.timerData.totalDuration = ms;
        timerDisplay.textContent = formatTime(ms);
        if (progressBar) progressBar.style.width = '0%';
    };
    [minInput, secInput].forEach(inp => {
        if (inp) inp.oninput = updateCustomTime;
    });

    // Восстановление состояния
    if (config.timerData.remaining > 0) {
        timerDisplay.textContent = formatTime(config.timerData.remaining);
        if (progressBar && config.timerData.totalDuration > 0 && config.timerData.remaining < config.timerData.totalDuration) {
            const progress = ((config.timerData.totalDuration - config.timerData.remaining) / config.timerData.totalDuration) * 100;
            progressBar.style.width = `${progress}%`;
        }
    }
    if (config.timerData.isRunning) {
        startBtn.textContent = '⏸';
    }

    startBtn.onclick = (e) => {
        e.stopPropagation();
        if (config.timerData.isRunning) {
            config.timerData.isRunning = false;
            startBtn.textContent = '▶';
        } else {
            if (config.timerData.remaining <= 0) {
                config.timerData.remaining = 60000;
                config.timerData.totalDuration = 60000;
            }
            // Если таймер был сброшен в 0, но totalDuration сохранился - восстанавливаем
            if (config.timerData.remaining === 0 && config.timerData.totalDuration > 0) {
                config.timerData.remaining = config.timerData.totalDuration;
            }
            config.timerData.isRunning = true;
            startBtn.textContent = '⏸';
        }
        debouncedSave();
    };

    resetBtn.onclick = (e) => {
        e.stopPropagation();
        config.timerData.isRunning = false;
        config.timerData.remaining = 0;
        config.timerData.totalDuration = 0;
        startBtn.textContent = '▶';
        timerDisplay.textContent = '00:00';
        timerDisplay.classList.remove('timer-warning', 'timer-finished');
        if (progressBar) progressBar.style.width = '0%';
        debouncedSave();
    };

    // === СЕКУНДОМЕР ===
    const swDisplay = el.querySelector('#stopwatch-display');
    const swStartBtn = el.querySelector('.sw-start-btn');
    const swLapBtn = el.querySelector('.sw-lap-btn');
    const swResetBtn = el.querySelector('.sw-reset-btn');
    const lapsContainer = el.querySelector('#laps-container');
    const swStats = el.querySelector('#sw-stats');

    const calculateLapStats = () => {
        const laps = config.stopwatchData.laps || [];
        if (laps.length < 2) return null;

        const lapTimes = [];
        for (let i = 0; i < laps.length; i++) {
            lapTimes.push(i === 0 ? laps[i] : laps[i] - laps[i - 1]);
        }

        const best = Math.min(...lapTimes);
        const worst = Math.max(...lapTimes);
        const avg = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;

        return { best, worst, avg, lapTimes };
    };

    const renderLaps = () => {
        lapsContainer.innerHTML = '';
        const laps = config.stopwatchData.laps || [];
        const stats = calculateLapStats();

        // Обновление статистики
        if (swStats) {
            if (stats) {
                swStats.innerHTML = `
                    <span class="sw-stat best">🏆 ${formatDuration(stats.best)}</span>
                    <span class="sw-stat avg">⌀ ${formatDuration(stats.avg)}</span>
                    <span class="sw-stat worst">🐌 ${formatDuration(stats.worst)}</span>
                `;
                swStats.style.display = 'flex';
            } else {
                swStats.innerHTML = '';
                swStats.style.display = 'none';
            }
        }

        // Отображение кругов
        laps.slice().reverse().forEach((lap, i) => {
            const div = document.createElement('div');
            const realIndex = laps.length - i;
            const prevLap = realIndex > 1 ? laps[realIndex - 2] : 0;
            const lapTime = lap - prevLap;

            let lapClass = 'lap-item';
            let icon = '🏁';

            if (stats) {
                const lapIndex = realIndex - 1;
                if (stats.lapTimes[lapIndex] === stats.best) {
                    lapClass += ' lap-best';
                    icon = '🏆';
                } else if (stats.lapTimes[lapIndex] === stats.worst) {
                    lapClass += ' lap-worst';
                    icon = '🐌';
                }
            }

            div.className = lapClass;
            div.innerHTML = `<span class="lap-num">${icon} #${realIndex}</span><span class="lap-total">${formatTime(lap, true)}</span><span class="lap-split">+${formatDuration(lapTime)}</span>`;
            lapsContainer.appendChild(div);
        });
    };

    if (config.stopwatchData.elapsed > 0) {
        swDisplay.textContent = formatTime(config.stopwatchData.elapsed, true);
    }
    renderLaps();

    swStartBtn.onclick = (e) => {
        e.stopPropagation();
        if (config.stopwatchData.isRunning) {
            config.stopwatchData.isRunning = false;
            swStartBtn.textContent = '▶';
            swLapBtn.style.display = 'none';
        } else {
            config.stopwatchData.isRunning = true;
            swStartBtn.textContent = '⏸';
            swLapBtn.style.display = 'inline-block';
        }
        debouncedSave();
    };

    swLapBtn.onclick = (e) => {
        e.stopPropagation();
        if (config.stopwatchData.isRunning) {
            config.stopwatchData.laps.push(config.stopwatchData.elapsed);
            renderLaps();
            // Автопрокрутка к новому кругу
            lapsContainer.scrollTop = 0;
            debouncedSave();
        }
    };

    swResetBtn.onclick = (e) => {
        e.stopPropagation();
        config.stopwatchData.isRunning = false;
        config.stopwatchData.elapsed = 0;
        config.stopwatchData.laps = [];
        swStartBtn.textContent = '▶';
        swLapBtn.style.display = 'none';
        swDisplay.textContent = '00:00.000';
        renderLaps();
        debouncedSave();
    };

}

// === КАЛЬКУЛЯТОР ===
function initCalculatorWidget(el, config) {
    let currentValue = '0';
    let previousValue = null;
    let operation = null;
    let shouldResetDisplay = false;
    
    const display = el.querySelector('.calc-display');
    
    const updateDisplay = () => {
        let displayText = currentValue;
        if (previousValue !== null && operation) {
            const opSymbol = {'+': '+', '-': '−', '*': '×', '/': '÷'}[operation];
            displayText = `${previousValue} ${opSymbol}`;
        }
        display.innerHTML = previousValue !== null && operation 
            ? `<div class="calc-display-history">${previousValue} ${({'+': '+', '-': '−', '*': '×', '/': '÷'})[operation]}</div><div>${currentValue}</div>`
            : currentValue;
    };
    
    el.querySelectorAll('.calc-num').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const num = btn.dataset.num;
            if (shouldResetDisplay || currentValue === '0') {
                currentValue = num;
                shouldResetDisplay = false;
            } else {
                if (currentValue.length < 12) currentValue += num;
            }
            updateDisplay();
        };
    });
    
    el.querySelector('.calc-dot').onclick = (e) => {
        e.stopPropagation();
        if (shouldResetDisplay) {
            currentValue = '0.';
            shouldResetDisplay = false;
        } else if (!currentValue.includes('.')) {
            currentValue += '.';
        }
        updateDisplay();
    };
    
    el.querySelectorAll('.calc-op').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            if (previousValue !== null && operation && !shouldResetDisplay) {
                calculate();
            }
            previousValue = currentValue;
            operation = btn.dataset.op;
            shouldResetDisplay = true;
            updateDisplay();
        };
    });
    
    const calculate = () => {
        const prev = parseFloat(previousValue);
        const curr = parseFloat(currentValue);
        let result = 0;
        
        switch(operation) {
            case '+': result = prev + curr; break;
            case '-': result = prev - curr; break;
            case '*': result = prev * curr; break;
            case '/': result = curr !== 0 ? prev / curr : 0; break;
        }
        
        currentValue = result.toString();
        if (currentValue.length > 12) {
            currentValue = parseFloat(currentValue).toExponential(6);
        }
        previousValue = null;
        operation = null;
        shouldResetDisplay = true;
        updateDisplay();
    };
    
    el.querySelector('.calc-equals').onclick = (e) => {
        e.stopPropagation();
        if (previousValue !== null && operation) calculate();
    };
    
    el.querySelector('.calc-clear').onclick = (e) => {
        e.stopPropagation();
        currentValue = '0';
        previousValue = null;
        operation = null;
        shouldResetDisplay = false;
        updateDisplay();
    };
    
    // Поддержка клавиатуры и нумпада (только когда виджет в фокусе)
    let isCalcFocused = false;
    
    el.addEventListener('mouseenter', () => { isCalcFocused = true; });
    el.addEventListener('mouseleave', () => { isCalcFocused = false; });
    el.addEventListener('click', () => { isCalcFocused = true; });
    
    const keyHandler = (e) => {
        // Проверяем, что калькулятор в фокусе и не вводим в другие поля
        if (!isCalcFocused) return;
        if (!el.closest('.widget')) return;
        if (e.target.matches('input, textarea, [contenteditable]')) return;
        
        const key = e.key;
        
        // Цифры (обычные и нумпад)
        if ((key >= '0' && key <= '9') || (e.code >= 'Numpad0' && e.code <= 'Numpad9')) {
            e.preventDefault();
            const num = key;
            if (shouldResetDisplay || currentValue === '0') {
                currentValue = num;
                shouldResetDisplay = false;
            } else {
                if (currentValue.length < 12) currentValue += num;
            }
            updateDisplay();
        }
        // Точка (обычная и нумпад)
        else if (key === '.' || key === ',' || e.code === 'NumpadDecimal') {
            e.preventDefault();
            if (shouldResetDisplay) {
                currentValue = '0.';
                shouldResetDisplay = false;
            } else if (!currentValue.includes('.')) {
                currentValue += '.';
            }
            updateDisplay();
        }
        // Операции
        else if (key === '+' || e.code === 'NumpadAdd') {
            e.preventDefault();
            if (previousValue !== null && operation && !shouldResetDisplay) calculate();
            previousValue = currentValue;
            operation = '+';
            shouldResetDisplay = true;
            updateDisplay();
        }
        else if (key === '-' || e.code === 'NumpadSubtract') {
            e.preventDefault();
            if (previousValue !== null && operation && !shouldResetDisplay) calculate();
            previousValue = currentValue;
            operation = '-';
            shouldResetDisplay = true;
            updateDisplay();
        }
        else if (key === '*' || e.code === 'NumpadMultiply') {
            e.preventDefault();
            if (previousValue !== null && operation && !shouldResetDisplay) calculate();
            previousValue = currentValue;
            operation = '*';
            shouldResetDisplay = true;
            updateDisplay();
        }
        else if (key === '/' || e.code === 'NumpadDivide') {
            e.preventDefault();
            if (previousValue !== null && operation && !shouldResetDisplay) calculate();
            previousValue = currentValue;
            operation = '/';
            shouldResetDisplay = true;
            updateDisplay();
        }
        // Равно (Enter и нумпад Enter)
        else if (key === 'Enter' || key === '=' || e.code === 'NumpadEnter') {
            e.preventDefault();
            if (previousValue !== null && operation) calculate();
        }
        // Очистка (Escape, Delete, C)
        else if (key === 'Escape' || key === 'Delete' || key === 'c' || key === 'C') {
            e.preventDefault();
            currentValue = '0';
            previousValue = null;
            operation = null;
            shouldResetDisplay = false;
            updateDisplay();
        }
        // Backspace - удаление последнего символа
        else if (key === 'Backspace') {
            e.preventDefault();
            if (currentValue.length > 1) {
                currentValue = currentValue.slice(0, -1);
            } else {
                currentValue = '0';
            }
            updateDisplay();
        }
    };
    
    document.addEventListener('keydown', keyHandler);
    
    // Очистка обработчика при удалении виджета
    const observer = new MutationObserver(() => {
        if (!document.body.contains(el)) {
            document.removeEventListener('keydown', keyHandler);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// === КАЛЕНДАРЬ ===
function initCalendarWidget(el, config) {
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    
    const now = new Date();
    if (!config.calendarYear) config.calendarYear = now.getFullYear();
    if (config.calendarMonth == null) config.calendarMonth = now.getMonth();
    
    const render = () => {
        const title = el.querySelector('.calendar-title');
        const grid = el.querySelector('.calendar-grid');
        
        title.textContent = `${monthNames[config.calendarMonth]} ${config.calendarYear}`;
        
        const firstDay = new Date(config.calendarYear, config.calendarMonth, 1);
        const lastDay = new Date(config.calendarYear, config.calendarMonth + 1, 0);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        
        let html = dayNames.map(d => `<div class="calendar-day-name">${d}</div>`).join('');
        
        for (let i = 0; i < startDay; i++) {
            html += '<div class="calendar-day calendar-day-empty"></div>';
        }
        
        const today = new Date();
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const isToday = day === today.getDate() && config.calendarMonth === today.getMonth() && config.calendarYear === today.getFullYear();
            html += `<div class="calendar-day ${isToday ? 'calendar-day-today' : ''}">${day}</div>`;
        }
        
        grid.innerHTML = html;
    };
    
    el.querySelectorAll('.calendar-nav').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const dir = parseInt(btn.dataset.dir);
            config.calendarMonth += dir;
            if (config.calendarMonth > 11) {
                config.calendarMonth = 0;
                config.calendarYear++;
            } else if (config.calendarMonth < 0) {
                config.calendarMonth = 11;
                config.calendarYear--;
            }
            render();
            debouncedSave();
        };
    });
    
    render();
}

// === ЦИТАТЫ ===
const QUOTES = [
    { text: 'Единственный способ сделать что-то очень хорошо — любить то, что делаешь.', author: 'Стив Джобс' },
    { text: 'Не считайте дни, сделайте так, чтобы дни считались.', author: 'Мухаммед Али' },
    { text: 'Ваше время ограничено, не тратьте его, живя чужой жизнью.', author: 'Стив Джобс' },
    { text: 'Единственный способ сделать великую работу — любить то, что вы делаете.', author: 'Стив Джобс' },
    { text: 'Начните с того, что необходимо; затем сделайте то, что возможно.', author: 'Фрэнсис Ассизский' },
    { text: 'Успех — это способность идти от неудачи к неудаче, не теряя энтузиазма.', author: 'Уинстон Черчилль' }
];

function initQuoteWidget(el, config) {
    const loadQuote = () => {
        const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        config.quoteText = quote.text;
        config.quoteAuthor = `— ${quote.author}`;
        el.querySelector('.quote-text').textContent = config.quoteText;
        el.querySelector('.quote-author').textContent = config.quoteAuthor;
        debouncedSave();
    };
    
    if (!config.quoteText) loadQuote();
    
    el.querySelector('.quote-refresh').onclick = (e) => {
        e.stopPropagation();
        loadQuote();
    };
}

// === ИГРЫ ===
function initGameWidget(el, config) {
    if (!config.gameType) config.gameType = 'snake';
    
    el.querySelectorAll('.game-tab').forEach(tab => {
        tab.onclick = (e) => {
            e.stopPropagation();
            config.gameType = tab.dataset.game;
            el.querySelectorAll('.game-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadGame();
            debouncedSave();
        };
    });
    
    const loadGame = () => {
        const container = el.querySelector('#game-container');
        if (config.gameType === 'snake') {
            container.innerHTML = '<div class="snake-game"><canvas id="snake-canvas" width="280" height="280"></canvas><div class="snake-score">Счет: <span>0</span></div></div>';
            initSnakeGame(container);
        } else if (config.gameType === '2048') {
            container.innerHTML = '<div class="game-2048"><div class="game-2048-grid"></div><div class="game-2048-score">Счет: <span>0</span></div><button class="game-2048-restart">Новая игра</button></div>';
            init2048Game(container);
        }
    };
    
    loadGame();
}

let activeSnakeGames = new Map();

function initSnakeGame(container) {
    const canvas = container.querySelector('#snake-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = container.querySelector('.snake-score span');
    const gridSize = 20;
    const tileCount = 14;
    let snake = [{x: 7, y: 7}];
    let food = {x: 10, y: 10};
    let dx = 0, dy = 0;
    let score = 0;
    let gameLoop;
    let gameOver = false;
    const gameId = 'snake-' + Date.now();

    const draw = () => {
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f38ba8';
        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
        snake.forEach((segment, i) => {
            ctx.fillStyle = i === 0 ? '#94e2d5' : '#a6e3a1';
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
        });
    };

    // 🔥 Единая функция рестарта
    const restart = () => {
        const overlay = container.querySelector('.snake-game-over-overlay');
        if (overlay) overlay.remove();
        
        snake = [{x: 7, y: 7}];
        food = {x: 10, y: 10};
        dx = 0; dy = 0;
        score = 0;
        gameOver = false;
        scoreEl.textContent = score;
        draw();
        gameLoop = setInterval(update, 150);
    };

    const showGameOver = () => {
        const overlay = document.createElement('div');
        overlay.className = 'snake-game-over-overlay';
        overlay.setAttribute('tabindex', '-1'); // 🔥 Фокус для клавиатуры
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100;outline:none;';
        overlay.innerHTML = `
            <div style="color:#f38ba8;font-size:24px;font-weight:700;margin-bottom:12px;">Игра окончена!</div>
            <div style="color:#cdd6f4;font-size:18px;margin-bottom:20px;">Счет: ${score}</div>
            <button style="background:#89b4fa;color:#1e1e2e;border:none;padding:10px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Новая игра</button>
            <div style="color:#6c7086;font-size:11px;margin-top:10px;">Нажмите Enter или стрелку ↕←→</div>
        `;

        overlay.querySelector('button').onclick = (e) => { e.stopPropagation(); restart(); };

        // 🔥 Обработчик клавиш на оверлее
        const overlayKeyHandler = (e) => {
            if (e.key === 'Enter' || e.key === ' ' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                restart();
            }
        };
        overlay.addEventListener('keydown', overlayKeyHandler);

        container.style.position = 'relative';
        container.appendChild(overlay);
        overlay.focus(); // 🔥 Мгновенный перехват ввода
    };

    const update = () => {
        if (gameOver || (dx === 0 && dy === 0)) return;
        const head = {x: snake[0].x + dx, y: snake[0].y + dy};

        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount || 
            snake.some(s => s.x === head.x && s.y === head.y)) {
            gameOver = true;
            clearInterval(gameLoop);
            showGameOver();
            return;
        }

        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score++;
            scoreEl.textContent = score;
            do { food = {x: Math.floor(Math.random() * tileCount), y: Math.floor(Math.random() * tileCount)}; } 
            while (snake.some(s => s.x === food.x && s.y === food.y));
        } else {
            snake.pop();
        }
        draw();
    };

    const keyHandler = (e) => {
        if (!canvas.closest('.widget') || gameOver) return;
        if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -1; e.preventDefault(); }
        else if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = 1; e.preventDefault(); }
        else if (e.key === 'ArrowLeft' && dx === 0) { dx = -1; dy = 0; e.preventDefault(); }
        else if (e.key === 'ArrowRight' && dx === 0) { dx = 1; dy = 0; e.preventDefault(); }
    };

    document.addEventListener('keydown', keyHandler);
    draw();
    gameLoop = setInterval(update, 150);

    // Очистка при удалении виджета
    const observer = new MutationObserver(() => {
        if (!document.body.contains(canvas)) {
            clearInterval(gameLoop);
            document.removeEventListener('keydown', keyHandler);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init2048Game(container) {
    const grid = container.querySelector('.game-2048-grid');
    const scoreEl = container.querySelector('.game-2048-score');
    const restartBtn = container.querySelector('.game-2048-restart');
    
    if (!grid || !scoreEl || !restartBtn) return;

    let board = Array(4).fill().map(() => Array(4).fill(0));
    let score = 0;
    let gameOver = false;

    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
    const addTile = () => {
        const empty = [];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (board[i][j] === 0) empty.push({i, j});
        if (empty.length > 0) {
            const {i, j} = empty[Math.floor(Math.random() * empty.length)];
            board[i][j] = Math.random() < 0.9 ? 2 : 4;
        }
    };

    const render = () => {
        grid.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                const tile = document.createElement('div');
                tile.className = 'game-2048-tile';
                if (board[i][j] > 0) {
                    const val = board[i][j];
                    tile.textContent = val;
                    if (val <= 2048) tile.classList.add(`tile-${val}`);
                    else tile.classList.add('tile-super');
                }
                grid.appendChild(tile);
            }
        }
        scoreEl.textContent = `СЧЕТ: ${score}`;
    };

    const mergeLine = (line) => {
        let arr = line.filter(x => x !== 0);
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i+1]) {
                arr[i] *= 2;
                score += arr[i];
                arr.splice(i+1, 1);
            }
        }
        while (arr.length < 4) arr.push(0);
        return arr;
    };

    const move = (direction) => {
        if (gameOver) return;
        let moved = false;
        const newBoard = board.map(row => [...row]);

        for (let i = 0; i < 4; i++) {
            let line;
            if (direction === 'left') line = [...newBoard[i]];
            else if (direction === 'right') line = [...newBoard[i]].reverse();
            else if (direction === 'up') line = [newBoard[0][i], newBoard[1][i], newBoard[2][i], newBoard[3][i]];
            else if (direction === 'down') line = [newBoard[3][i], newBoard[2][i], newBoard[1][i], newBoard[0][i]];

            const merged = mergeLine(line);

            if (direction === 'right') {
                merged.reverse();
                newBoard[i] = merged;
            } else if (direction === 'down') {
                for (let k=0; k<4; k++) newBoard[3-k][i] = merged[k];
            } else if (direction === 'up') {
                for (let k=0; k<4; k++) newBoard[k][i] = merged[k];
            } else {
                newBoard[i] = merged;
            }
        }
        
        // Проверка изменений
        for(let r=0; r<4; r++) for(let c=0; c<4; c++) if(board[r][c] !== newBoard[r][c]) { moved = true; break; }
        
        if (moved) {
            board = newBoard;
            addTile();
            render();
            checkGameOver();
        }
    };

    const checkGameOver = () => {
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (board[i][j] === 0) return;
                if (j < 3 && board[i][j] === board[i][j + 1]) return;
                if (i < 3 && board[i][j] === board[i + 1][j]) return;
            }
        }
        gameOver = true;
        showGameOver2048(); // 🔥 ВЫЗОВ ФУНКЦИИ ПОКАЗА ЭКРАНА
    };

    // === ЭКРАН "ИГРА ОКОНЧЕНА" ===
    const showGameOver2048 = () => {
        // Создаём оверлей
        const overlay = document.createElement('div');
        overlay.setAttribute('tabindex', '0'); // 🔥 Делаем фокусируемым
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1000;outline:none;';
        
        overlay.innerHTML = `
            <div style="color:#f38ba8;font-size:24px;font-weight:700;margin-bottom:12px;">Игра окончена!</div>
            <div style="color:#cdd6f4;font-size:18px;margin-bottom:20px;">Счет: ${score}</div>
            <button style="background:#89b4fa;color:#1e1e2e;border:none;padding:10px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Новая игра</button>
            <div style="color:#6c7086;font-size:11px;margin-top:10px;">Нажмите Enter или стрелку ↕←→</div>
        `;
        
        // Функция рестарта
        const restart = () => {
            overlay.remove();
            // 🔥 Убираем временный обработчик
            document.removeEventListener('keydown', overlayKeyHandler, true);
            init();
        };
        
        // Клик по кнопке
        const btn = overlay.querySelector('button');
        btn.onclick = (e) => { e.stopPropagation(); restart(); };
        
        // 🔥 Обработчик клавиш С ЗАХВАТОМ (useCapture=true)
        const overlayKeyHandler = (e) => {
            // Игнорируем, если фокус в поле ввода
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            // Перехватываем Enter и все стрелки
            if (e.key === 'Enter' || ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                restart();
            }
        };
        
        // Добавляем в DOM
        container.style.position = 'relative';
        container.appendChild(overlay);
        
        // 🔥 Вешаем обработчик НА ДОКУМЕНТ с useCapture=true (срабатывает ДО глобального keyHandler)
        document.addEventListener('keydown', overlayKeyHandler, true);
        
        // 🔥 Фокусируем оверлей
        setTimeout(() => overlay.focus(), 10);
    };
    const init = () => {
        board = Array(4).fill().map(() => Array(4).fill(0));
        score = 0;
        gameOver = false;
        addTile(); addTile();
        render();
    };

    restartBtn.onclick = (e) => { e.stopPropagation(); init(); };

    // Глобальный обработчик клавиш для игры
    const keyHandler = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!grid.closest('.widget') || gameOver) return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
        if (e.key === 'ArrowUp') move('up');
        else if (e.key === 'ArrowDown') move('down');
        else if (e.key === 'ArrowLeft') move('left');
        else if (e.key === 'ArrowRight') move('right');
    };

    document.addEventListener('keydown', keyHandler);
    
    // Очистка при удалении виджета
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            document.removeEventListener('keydown', keyHandler);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    init();
}

// === ГЕНЕРАТОР ЧИСЕЛ ===
function initRandomWidget(el, config) {
    if (!config.randomMin) config.randomMin = 1;
    if (!config.randomMax) config.randomMax = 100;
    
    const minInput = el.querySelector('.random-min');
    const maxInput = el.querySelector('.random-max');
    const resultEl = el.querySelector('.random-result');
    const generateBtn = el.querySelector('.random-generate');
    
    minInput.oninput = (e) => {
        config.randomMin = parseInt(e.target.value) || 1;
        debouncedSave();
    };
    
    maxInput.oninput = (e) => {
        config.randomMax = parseInt(e.target.value) || 100;
        debouncedSave();
    };
    
    generateBtn.onclick = (e) => {
        e.stopPropagation();
        const min = parseInt(config.randomMin);
        const max = parseInt(config.randomMax);
        const result = Math.floor(Math.random() * (max - min + 1)) + min;
        config.randomResult = result;
        resultEl.textContent = result;
        debouncedSave();
    };
}

function initCountdownWidget(el, config) {
    const valueEl = el.querySelector('.countdown-value');
    const titleEl = el.querySelector('.countdown-widget > div:first-child');
    
    const updateCountdown = () => {
        if (!config.countdownDate) {
            if (valueEl) valueEl.textContent = '—';
            return;
        }
        const target = new Date(config.countdownDate);
        const now = new Date();
        const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
        config.countdownDays = diff;
        if (valueEl) valueEl.textContent = diff;
    };

    // Обновляем заголовок при инициализации
    if (titleEl && config.countdownTitle) {
        titleEl.textContent = config.countdownTitle;
    }

    updateCountdown();
    setInterval(updateCountdown, 60000);
}

// === ПЕРЕВОДЧИК ===
function initTranslatorWidget(el, config) {
    if (!config.translatorFrom) config.translatorFrom = 'en';
    if (!config.translatorTo) config.translatorTo = 'ru';
    if (!config.translatorLayout) config.translatorLayout = 'vertical';
    
    // Проверяем текущий размер и устанавливаем правильный layout
    const widget = el.querySelector('.translator-widget');
    if (widget) {
        const aspectRatio = config.size.w / config.size.h;
        const shouldBeHorizontal = aspectRatio > 1.4;
        
        if (shouldBeHorizontal && config.translatorLayout !== 'horizontal') {
            config.translatorLayout = 'horizontal';
            widget.classList.add('translator-horizontal');
        } else if (!shouldBeHorizontal && config.translatorLayout === 'horizontal') {
            config.translatorLayout = 'vertical';
            widget.classList.remove('translator-horizontal');
        }
    }
    
    const fromSelect = el.querySelector('.translator-from');
    const toSelect = el.querySelector('.translator-to');
    const swapBtn = el.querySelector('.translator-swap');
    const inputArea = el.querySelector('.translator-input');
    const outputDiv = el.querySelector('.translator-output');
    const charCount = el.querySelector('.translator-char-count');
    const clearBtn = el.querySelector('.translator-clear');
    const copyBtn = el.querySelector('.translator-copy');
    const speakBtn = el.querySelector('.translator-speak');
    const translateBtn = el.querySelector('.translator-translate-btn');
    
    let isTranslating = false;
    
    // Обновление счетчика символов
    inputArea.oninput = () => {
        const len = inputArea.value.length;
        charCount.textContent = `${len} / 500`;
        if (len > 500) {
            inputArea.value = inputArea.value.substring(0, 500);
            charCount.textContent = '500 / 500';
        }
    };
    
    // Очистка только поля ввода (перевод остаётся)
    clearBtn.onclick = (e) => {
        e.stopPropagation();
        inputArea.value = '';
        charCount.textContent = '0 / 500';
        outputDiv.textContent = 'Перевод появится здесь...';
        config.translatorResult = '';
        copyBtn.style.opacity = '0.5';
        speakBtn.style.opacity = '0.5';
        debouncedSave();
    };
    
    // Поменять языки местами
    swapBtn.onclick = (e) => {
        e.stopPropagation();
        const fromVal = fromSelect.value;
        const toVal = toSelect.value;
        fromSelect.value = toVal;
        toSelect.value = fromVal;
        config.translatorFrom = toVal;
        config.translatorTo = fromVal;
        debouncedSave();
    };
    
    // Сохранение выбора языков
    fromSelect.onchange = () => {
        config.translatorFrom = fromSelect.value;
        debouncedSave();
    };
    
    toSelect.onchange = () => {
        config.translatorTo = toSelect.value;
        debouncedSave();
    };
    
    // Копирование
    copyBtn.onclick = async (e) => {
        e.stopPropagation();
        if (config.translatorResult && config.translatorResult !== 'Перевод появится здесь...') {
            try {
                await navigator.clipboard.writeText(config.translatorResult);
                copyBtn.textContent = '✓';
                setTimeout(() => copyBtn.textContent = '📋', 1500);
            } catch (e) {
                console.log('Copy failed:', e);
            }
        }
    };
    
    // Озвучивание
    speakBtn.onclick = (e) => {
        e.stopPropagation();
        if (config.translatorResult && config.translatorResult !== 'Перевод появится здесь...') {
            const utterance = new SpeechSynthesisUtterance(config.translatorResult);
            utterance.lang = config.translatorTo;
            speechSynthesis.speak(utterance);
        }
    };
    
    // Перевод
        const translate = async () => {
        const text = inputArea.value.trim();
        if (!text || isTranslating) return;
        isTranslating = true;
        translateBtn.textContent = 'Перевод...';
        translateBtn.disabled = true;
        outputDiv.textContent = 'Перевод...';
        try {
            let url, method, body;
            const from = config.translatorFrom || 'en';
            const to = config.translatorTo || 'ru';

            // Выбор API
            const api = config.translatorApi || 'mymemory'; // по умолчанию — mymemory

            if (api === 'libre') {
                url = 'https://libretranslate.com/translate'; // ← публичный URL
                method = 'POST';
                body = {
                    q: text,
                    source: from,
                    target: to,
                    format: 'text'
                };
                // Если в настройках есть API-ключ — добавим его
                if (config.translatorApiKey) {
                    body.api_key = config.translatorApiKey;
                }
                body = JSON.stringify(body);
            } else { // mymemory
                url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
                method = 'GET';
                body = undefined;
            }

            const res = await fetch(url, {
                method,
                headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
                body
            });

            if (!res.ok) throw new Error(`HTTP ${res.status} from ${api}`);

            const data = await res.json();

            let translatedText;
            if (api === 'libre') {
                translatedText = data.translatedText;
            } else { // mymemory
                if (data.responseStatus !== 200 || !data.responseData) throw new Error('No translation from MyMemory');
                translatedText = data.responseData.translatedText;
            }

            if (!translatedText || translatedText === text) {
                throw new Error('Empty or unchanged translation');
            }

            config.translatorResult = translatedText;
            outputDiv.textContent = translatedText;
            copyBtn.style.opacity = '1';
            speakBtn.style.opacity = '1';

        } catch (e) {
            console.error('Translation error:', e);
            outputDiv.textContent = `Ошибка: ${e.message}`;
        } finally {
            isTranslating = false;
            translateBtn.textContent = 'Перевести';
            translateBtn.disabled = false;
            debouncedSave();
        }
    };
    const apiKeyInput = el.querySelector('.translator-api-key-input');
    if (apiKeyInput) {
        apiKeyInput.value = config.translatorApiKey || '';
        apiKeyInput.oninput = () => {
            config.translatorApiKey = apiKeyInput.value.trim();
            debouncedSave();
        };
    }
    translateBtn.onclick = (e) => {
        e.stopPropagation();
        translate();
    };
    
    // Enter для перевода (Ctrl+Enter)
    inputArea.onkeydown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            translate();
        }
    };
    
    // Восстановление результата
    if (config.translatorResult && config.translatorResult !== 'Перевод появится здесь...') {
        copyBtn.style.opacity = '1';
        speakBtn.style.opacity = '1';
    }
}

// === СОЗДАНИЕ DOM ===
function createWidgetDOM(config) {
    const el = document.createElement('div');
    el.className = `widget draggable ${config.minimized ? 'minimized' : ''}`;
    if (config.type === 'search') el.classList.add('search-widget');
    el.id = config.id;
    el.style.left = config.pos.x + 'px';
    el.style.top = config.pos.y + 'px';
    el.style.width = config.size.w + 'px';
    el.style.height = config.size.h + 'px';
    el.style.zIndex = ++topZIndex;

    el.style.opacity = '0';
    el.style.transform = 'scale(0.9) translateY(10px)';

    ensureStyle(config);
    
    // Применяем стили ДО добавления в DOM
    if (config.style.fontSize && !config.style.autoFontSize) {
        el.style.fontSize = config.style.fontSize + 'px';
    }
    if (config.style.textColor) {
        el.style.color = config.style.textColor;
    }

    const def = WIDGET_TYPES[config.type];
    if (def) {
        el.innerHTML = def.render(config) + `<button class="widget-hide-btn" title="Свернуть"></button><button class="widget-close-btn" title="Удалить">×</button><button class="widget-menu-btn" title="Настройки">⋮</button>`;
        el.innerHTML += config.type !== 'search' ? '<div class="resize-handle"></div>' : '<div class="resize-handle" style="z-index:20;"></div>';

        el.querySelector('.widget-menu-btn').onclick = (e) => { e.stopPropagation(); showContextMenu(config.id, e.clientX, e.clientY); };
        el.querySelector('.widget-hide-btn').onclick = (e) => {
            e.stopPropagation();
            config.minimized = true;
            
            // Получаем позицию Dock для анимации
            const dock = document.getElementById('bottom-panel');
            const dockRect = dock.getBoundingClientRect();
            const widgetRect = el.getBoundingClientRect();
            
            // Вычисляем направление анимации в зависимости от позиции Dock
            const pos = globalSettings.dockPosition ?? 'bottom';
            let targetX = dockRect.left + dockRect.width / 2 - widgetRect.left - widgetRect.width / 2;
            let targetY = dockRect.top + dockRect.height / 2 - widgetRect.top - widgetRect.height / 2;
            
            el.style.transition = 'opacity 0.2s ease';
            el.style.opacity = '0';
            
            setTimeout(() => {
                el.classList.add('minimized');
                el.style.transition = '';
            }, 200);
            
            debouncedSave();
            renderDock();
            applyDockAutoHide();
        };
        el.querySelector('.widget-close-btn').onclick = async (e) => {
            e.stopPropagation();
            const ok = await showConfirm('Удалить виджет?', 'Это действие нельзя отменить.');
            if (!ok) return;
            removeWidgetDOM(config.id);
            widgets = widgets.filter(w => w.id !== config.id);
            debouncedSave();
            renderDock();
            applyDockAutoHide();
        };

        if (config.type === 'currency') initCurrencyWidget(el);
        if (config.type === 'todo') initTodoWidget(el, config);
        if (config.type === 'timer') initTimerWidget(el, config);
                document.body.appendChild(el);
        if (config.type === 'weather') {
            requestAnimationFrame(() => initWeatherWidget(el, config));
        }
        if (config.type === 'calculator') initCalculatorWidget(el, config);
        if (config.type === 'calendar') initCalendarWidget(el, config);
        if (config.type === 'quote') initQuoteWidget(el, config);
        if (config.type === 'game') initGameWidget(el, config);
        if (config.type === 'random') initRandomWidget(el, config);
        if (config.type === 'countdown') initCountdownWidget(el, config);
        if (config.type === 'translator') initTranslatorWidget(el, config);
    }
    document.body.appendChild(el);
    
    if (config.type === 'note') {
        const noteEl = el.querySelector('[contenteditable]');
        if (noteEl) {
            // Сохраняем при каждом изменении текста
            noteEl.addEventListener('input', () => {
                config.content = noteEl.innerText;
                debouncedSave();
            });
            // Дополнительное сохранение при потере фокуса
            noteEl.addEventListener('blur', () => {
                config.content = noteEl.innerText;
                debouncedSave();
            });
            // Отключаем drag при выделении/клике внутри текста
            noteEl.addEventListener('mousedown', e => e.stopPropagation());
        }
    }

    // Применяем все стили ПОСЛЕ добавления в DOM
    applyWidgetStyle(config);

    requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    el.style.opacity = '';
    el.style.transform = '';
    applyWidgetStyle(config);
    
    if (config.style.autoFontSize) {
        if (config.type === 'currency') initCurrencyWidget(el);
        if (config.type === 'todo') initTodoWidget(el, config);
        if (config.type === 'timer') initTimerWidget(el, config);
        if (config.type === 'weather') initWeatherWidget(config); // <-- Переместить сюда
        if (config.type === 'calculator') initCalculatorWidget(el, config);
        updateAutoFontSize(config, el);
    }
    });

    return el;
}

function removeWidgetDOM(widgetId) {
    if (weatherIntervals.has(widgetId)) {
        clearInterval(weatherIntervals.get(widgetId));
        weatherIntervals.delete(widgetId);
    }
    const el = document.getElementById(widgetId);
    if (el) {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.9)';
        setTimeout(() => el.remove(), 200);
    }
}

// === SNAP TO EDGES ===
const SNAP_THRESHOLD = 15;
let snapIndicators = [];

function createSnapIndicator() {
    const el = document.createElement('div');
    el.className = 'snap-indicator';
    document.body.appendChild(el);
    return el;
}

function clearSnapIndicators() {
    snapIndicators.forEach(el => el.remove());
    snapIndicators = [];
}

function showSnapIndicator(type, pos) {
    const indicator = createSnapIndicator();
    indicator.classList.add(type);
    if (type === 'vertical') indicator.style.left = pos + 'px';
    else indicator.style.top = pos + 'px';
    snapIndicators.push(indicator);
}

function getSnapPosition(val, targets, threshold) {
    for (const target of targets) {
        if (Math.abs(val - target) < threshold) return target;
    }
    return null;
}

function calculateSnapEdges(x, y, w, h, excludeId) {
    const edges = { x: null, y: null };
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - 20;

    // Цели прилипания: края экрана, центр и края других виджетов
    const xTargets = [0, screenW - w, (screenW - w) / 2]; // левый край, правый край, центр по X
    const yTargets = [0, screenH - h, (screenH - h) / 2]; // верхний край, нижний край, центр по Y

    widgets.forEach(widget => {
        if (widget.id === excludeId || widget.minimized) return;
        const wx = widget.pos.x, wy = widget.pos.y;
        const ww = widget.size.w, wh = widget.size.h;
        // Прилипание к левому/правому краю других виджетов
        xTargets.push(wx, wx + ww, wx - w, wx + ww - w);
        // Прилипание к верхнему/нижнему краю других виджетов
        yTargets.push(wy, wy + wh, wy - h, wy + wh - h);
    });

    edges.x = getSnapPosition(x, xTargets, SNAP_THRESHOLD);
    edges.y = getSnapPosition(y, yTargets, SNAP_THRESHOLD);

    return edges;
}

// === DRAG & DROP: ПЛАВНЫЙ + Z-INDEX ===
function initDragResize() {
    let action = null, target = null, widgetCfg = null, sx, sy, sw, sh;
    const gridOverlay = document.getElementById('drag-grid-overlay');

    document.addEventListener('mousedown', e => {
        // Игнорируем клики по окнам настроек
        if (e.target.closest('#settings-panel, #widget-context-menu, #widget-menu')) return;

        const h = e.target.closest('.resize-handle');
        const w = e.target.closest('.draggable');
        const skip = e.target.closest('input,textarea,[contenteditable],a,button,select,.todo-input') && !e.target.closest('.search-drag-handle');

        if (h && w && !skip && !globalSettings.lockWidgets) {
            action = 'resize'; target = w;
            sx = e.clientX; sy = e.clientY;
            sw = target.offsetWidth; sh = target.offsetHeight;
            target.style.transition = 'none';
            e.preventDefault();
        } else if (w && !skip && !globalSettings.lockWidgets) {
            action = 'drag'; target = w;
            widgetCfg = widgets.find(x => x.id === target.id);
            // Поднимаем наверх
            target.style.zIndex = ++topZIndex;
            // Убираем transition для плавного перетаскивания
            target.style.transition = 'none';
            sx = e.clientX - target.offsetLeft;
            sy = e.clientY - target.offsetTop;
            // Показываем сетку
            if (globalSettings.showDragGrid && gridOverlay) {
                gridOverlay.classList.add('visible');
            }
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', e => {
        if (!target || !action) return;
        if (action === 'drag') {
            let nextX = e.clientX - sx, nextY = e.clientY - sy;
            const rect = target.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width, maxY = window.innerHeight - rect.height;
            nextX = Math.max(0, Math.min(nextX, maxX));
            nextY = Math.max(0, Math.min(nextY, maxY));

            // Snap-to-edges
            clearSnapIndicators();
            if (globalSettings.snapToEdges !== false) {
                const snapEdges = calculateSnapEdges(nextX, nextY, target.offsetWidth, target.offsetHeight, target.id);
                if (snapEdges.x !== null) {
                    showSnapIndicator('vertical', snapEdges.x);
                    nextX = snapEdges.x;
                }
                if (snapEdges.y !== null) {
                    showSnapIndicator('horizontal', snapEdges.y);
                    nextY = snapEdges.y;
                }
            }

            target.style.left = nextX + 'px';
            target.style.top = nextY + 'px';
        } else {
            const newWidth = Math.max(60, sw + (e.clientX - sx));
            const newHeight = Math.max(40, sh + (e.clientY - sy));
            target.style.width = newWidth + 'px';
            target.style.height = newHeight + 'px';
            
            // Авто-переключение layout для переводчика
            const cfg = widgets.find(w => w.id === target.id);
            if (cfg && cfg.type === 'translator') {
                const aspectRatio = newWidth / newHeight;
                const shouldBeHorizontal = aspectRatio > 1.4;
                const currentLayout = cfg.translatorLayout || 'vertical';
                
                if (shouldBeHorizontal && currentLayout !== 'horizontal') {
                    cfg.translatorLayout = 'horizontal';
                    const widget = target.querySelector('.translator-widget');
                    if (widget) {
                        widget.style.transition = 'all 0.3s ease';
                        widget.classList.add('translator-horizontal');
                        setTimeout(() => widget.style.transition = '', 300);
                    }
                } else if (!shouldBeHorizontal && currentLayout === 'horizontal') {
                    cfg.translatorLayout = 'vertical';
                    const widget = target.querySelector('.translator-widget');
                    if (widget) {
                        widget.style.transition = 'all 0.3s ease';
                        widget.classList.remove('translator-horizontal');
                        setTimeout(() => widget.style.transition = '', 300);
                    }
                }
            }
            
            // Авто-размер текста при resize
            if (cfg && cfg.style.autoFontSize) {
                updateAutoFontSize(cfg, target);
            }
        }
    });

    document.addEventListener('mouseup', async () => {
        clearSnapIndicators();
        if (gridOverlay) gridOverlay.classList.remove('visible');
        if (!target) return;
        const cfg = widgetCfg || widgets.find(w => w.id === target.id);
        if (cfg) {
            cfg.pos.x = snapToGrid(parseInt(target.style.left));
            cfg.pos.y = snapToGrid(parseInt(target.style.top));
            cfg.size.w = snapToGrid(parseInt(target.style.width));
            cfg.size.h = snapToGrid(parseInt(target.style.height));

            target.style.left = cfg.pos.x + 'px';
            target.style.top = cfg.pos.y + 'px';
            target.style.width = cfg.size.w + 'px';
            target.style.height = cfg.size.h + 'px';
            target.style.transition = '';

            // Применяем блюр после resize через CSS класс
            if (action === 'resize' && cfg.style && cfg.style.blur) {
                target.classList.add('widget-blur');
            }

            const edit = target.querySelector('[contenteditable]');
            if (edit) cfg.content = edit.innerText;
            debouncedSave();
        }
        target = null; action = null; widgetCfg = null;
    });
}

// === НАСТРОЙКИ ===
function generateSettingInput(key, config, value, prefix) {
    const id = `${prefix}${key}`;
    const valId = `${prefix}${key}-val`;
    let html = `<div class="setting-row" data-key="${key}"><label>${config.label}</label>`;
    if (config.type === 'range') html += `<div style="display:flex; align-items:center; gap:10px;"><input type="range" id="${id}" min="${config.min}" max="${config.max}" step="${config.step}" value="${value}"><span id="${valId}">${Math.round(value * (config.multiplier || 1))}${config.suffix || ''}</span></div>`;
    else if (config.type === 'color') html += `<input type="color" id="${id}" value="${value}">`;
    else if (config.type === 'select') html += `<select id="${id}">${Object.entries(config.options).map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    else if (config.type === 'checkbox') html += `<label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="${id}" ${value ? 'checked' : ''} style="width:auto; accent-color:#89b4fa;"><span style="font-size:0.9em; color:#cdd6f4;">Вкл</span></label>`;
    return html + '</div>';
}

function initSettingsPanel() {
    const container = document.getElementById('settings-content');
    let activeTab = 'general';

    const render = (tab) => {
        activeTab = tab;
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

        let html = '';
        for (const [key, config] of Object.entries(SETTINGS_SCHEMA)) {
            if (config.section !== tab) continue;
            if (config.requiresWallpaper && !globalSettings.wallpaper) continue;
            html += generateSettingInput(key, config, globalSettings[key] ?? config.default, 'setting-');
        }

        // Вкладка обоев
        if (tab === 'wallpaper') {
            html += `<div class="setting-row"><label>Фон страницы</label><div style="display:flex;gap:6px;"><button id="btn-upload-wallpaper" style="flex:1;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#cdd6f4;cursor:pointer;">🖼️ Загрузить</button><button id="btn-reset-wallpaper" style="display:${globalSettings.wallpaper ? 'inline-block' : 'none'};padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(243,139,168,0.15);color:#f38ba8;cursor:pointer;">❌</button></div></div>`;
        }

        // Вкладка погоды
        if (tab === 'weather') {
            html += `
            <div class="setting-row"><label>OpenWeatherMap API key</label>
            <input type="text" id="setting-owm-key" placeholder="Бесплатно на openweathermap.org" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(49,50,68,0.5);color:#cdd6f4;"></div>
            <div class="setting-row"><label>WeatherAPI.com key</label>
            <input type="text" id="setting-wapi-key" placeholder="Бесплатно на weatherapi.com" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(49,50,68,0.5);color:#cdd6f4;"></div>
            <div style="font-size:0.75em;color:#a6adc8;">Без ключей работают: Open-Meteo и wttr.in</div>`;
        }

        // === БЛОК ИМПОРТА/ЭКСПОРТА (БЕЗ INLINE ONCLICK) ===
        html += `
        <div class="setting-section io-section">
            <div class="io-title">💾 Резервное копирование</div>
            <div class="io-buttons">
                <button id="btn-export-data" class="btn-io">📤 Экспорт</button>
                <button id="btn-import-trigger" class="btn-io">📥 Импорт</button>
            </div>
            <div class="io-desc">Сохраняет виджеты, настройки, обои и ключи API в файл.</div>
            <input type="file" id="io-file-input" accept=".json" style="display:none">
        </div>
        `;
        // =============================

        container.innerHTML = html;

        // === ПРИВЯЗКА СОБЫТИЙ ДЛЯ ИМПОРТА/ЭКСПОРТА ===
        const btnExport = document.getElementById('btn-export-data');
        const btnImportTrigger = document.getElementById('btn-import-trigger');
        const fileInput = document.getElementById('io-file-input');

        if (btnExport) btnExport.addEventListener('click', window.exportData);
        
        if (btnImportTrigger) {
            btnImportTrigger.addEventListener('click', () => {
                fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                window.importData(e.target);
                e.target.value = ''; // Сброс, чтобы можно было выбрать тот же файл снова
            });
        }
        // ============================================

        // Навешиваем обработчики настроек
        for (const [key, config] of Object.entries(SETTINGS_SCHEMA)) {
            if (config.section !== tab) continue;
            const input = document.getElementById(`setting-${key}`);
            if (!input) continue;
            const evt = config.type === 'checkbox' || config.type === 'select' ? 'change' : 'input';
            
            // Удаляем старые слушатели, если есть (хотя innerHTML перезаписывает DOM, так что это не критично, но хорошая практика)
            input.replaceWith(input.cloneNode(true));
            const newInput = document.getElementById(`setting-${key}`);

            newInput.addEventListener(evt, (e) => {
                let val = config.type === 'checkbox' ? e.target.checked : (config.type === 'select' ? e.target.value : parseFloat(e.target.value));
                const span = document.getElementById(`setting-${key}-val`);
                if (span && config.type !== 'checkbox') span.textContent = `${Math.round(val * (config.multiplier || 1))}${config.suffix || ''}`;
                globalSettings[key] = val;
                if (['wallpaperMode', 'wallpaperScale', 'wallpaperPosX', 'wallpaperPosY'].includes(key)) applyWallpaperTransform();
                if (key === 'defaultOpacity') widgets.forEach(w => { w.style.opacity = globalSettings.defaultOpacity; applyWidgetStyle(w); });
                if (key === 'defaultFontFamily') document.body.style.fontFamily = globalSettings.defaultFontFamily;
                if (key === 'smoothAnimations') document.body.classList.toggle('smooth-animations', val);
                if (key === 'dockAutoHide') applyDockAutoHide();
                if (key === 'dockScale') applyDockPosition();
                if (key === 'dockPosition') { globalSettings.dockCustomPos = null; applyDockPosition(); }
                if (key === 'lockWidgets') document.querySelectorAll('.widget').forEach(el => { el.style.cursor = val ? 'default' : ''; });
                if (key === 'autoScaleFont') applyAutoScaleFont();
                if (key === 'settingsPanelScale') {
                    const panel = document.getElementById('settings-panel');
                    const uiScale = globalSettings.uiScale ?? 1;
                    const totalScale = val * uiScale;
                    if (panel) {
                        panel.style.transform = `scale(${totalScale})`;
                        panel.style.transformOrigin = 'top left';
                    }
                }
                if (key === 'settingsPanelFontSize') {
                    applyWindowFontSize('settings-panel', val);
                }
            });
            newInput.addEventListener('change', saveSettings);
        }

        if (tab === 'wallpaper') {
            initWallpaperUpload();
        }

        if (tab === 'weather') {
            chrome.storage.local.get('weatherApiKeys', (data) => {
                const keys = data.weatherApiKeys || {};
                const owm = document.getElementById('setting-owm-key');
                const wapi = document.getElementById('setting-wapi-key');
                if (owm) owm.value = keys.openWeatherMap || '';
                if (wapi) wapi.value = keys.weatherAPI || '';
            });
            const saveWeatherKeys = () => {
                chrome.storage.local.set({ weatherApiKeys: {
                    openWeatherMap: document.getElementById('setting-owm-key')?.value.trim() || '',
                    weatherAPI: document.getElementById('setting-wapi-key')?.value.trim() || ''
                }});
            };
            const owmKeyInput = document.getElementById('setting-owm-key');
            const wapiKeyInput = document.getElementById('setting-wapi-key');
            if (owmKeyInput) owmKeyInput.addEventListener('change', saveWeatherKeys);
            if (wapiKeyInput) wapiKeyInput.addEventListener('change', saveWeatherKeys);
        }
    };

    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.onclick = () => render(tab.dataset.tab);
    });

    render('general');
}

function initWidgetStyleMenu() {
    const container = document.getElementById('widget-style-content');
    let html = '';
    for (const [key, config] of Object.entries(WIDGET_STYLE_SCHEMA)) {
        html += `<div class="ctx-row" data-key="${key}"><label>${config.label}</label>`;
        if (config.type === 'range') html += `<div style="display:flex; align-items:center; gap:10px;"><input type="range" id="ctx-${key}" min="${config.min}" max="${config.max}" step="${config.step}"><span id="ctx-${key}-val"></span></div>`;
        else if (config.type === 'color') html += `<input type="color" id="ctx-${key}">`;
        else if (config.type === 'checkbox') html += `<label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="ctx-${key}" style="width:auto; accent-color:#89b4fa;"><span style="font-size:0.9em; color:#cdd6f4;">Вкл</span></label>`;
        html += '</div>';
    }
    container.innerHTML = html;
    for (const [key, config] of Object.entries(WIDGET_STYLE_SCHEMA)) {
        const input = document.getElementById(`ctx-${key}`);
        if (!input) continue;
        const evt = config.type === 'checkbox' || config.type === 'select' ? 'change' : 'input';
        input.addEventListener(evt, (e) => {
            if (!activeWidgetId) return;
            const val = config.type === 'checkbox' ? e.target.checked : (config.type === 'select' ? e.target.value : parseFloat(e.target.value));
            const span = document.getElementById(`ctx-${key}-val`);
            if (span && config.type === 'range') span.textContent = `${Math.round(val * (config.multiplier || 1))}${config.suffix || ''}`;
            const w = widgets.find(x => x.id === activeWidgetId);
            if (w) { ensureStyle(w); w.style[key] = val; applyWidgetStyle(w); debouncedSave(); }
        });
    }
    
    // Настройка масштаба окна
    const windowScaleInput = document.getElementById('ctx-window-scale');
    const windowScaleVal = document.getElementById('ctx-window-scale-val');
    
    if (windowScaleInput && windowScaleVal) {
        windowScaleInput.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            windowScaleVal.textContent = Math.round(scale * 100) + '%';
            globalSettings.contextMenuScale = scale;
            
            const menu = document.getElementById('widget-context-menu');
            const uiScale = globalSettings.uiScale ?? 1;
            const totalScale = scale * uiScale;
            
            // Применяем масштаб
            if (menu) {
                menu.style.transform = `scale(${totalScale})`;
                menu.style.transformOrigin = 'top left';
            }
            
            saveSettings();
        });
    }
    
    // Настройка размера шрифта окна
    const windowFontInput = document.getElementById('ctx-window-font-size');
    const windowFontVal = document.getElementById('ctx-window-font-size-val');
    
    if (windowFontInput && windowFontVal) {
        windowFontInput.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            windowFontVal.textContent = size + 'px';
            globalSettings.contextMenuFontSize = size;
            applyWindowFontSize('widget-context-menu', size);
            saveSettings();
        });
    }
}

// === ПЕРЕТАСКИВАЕМЫЕ ОКНА ===
function applyAutoScaleFont() {
    const settingsPanel = document.getElementById('settings-panel');
    const contextMenu = document.getElementById('widget-context-menu');
    
    if (globalSettings.autoScaleFont) {
        if (settingsPanel) {
            const width = settingsPanel.offsetWidth;
            const baseFontSize = Math.max(12, Math.min(18, width / 25));
            settingsPanel.style.fontSize = baseFontSize + 'px';
        }
        if (contextMenu) {
            const width = contextMenu.offsetWidth;
            const baseFontSize = Math.max(12, Math.min(18, width / 25));
            contextMenu.style.fontSize = baseFontSize + 'px';
        }
    } else {
        if (settingsPanel) settingsPanel.style.fontSize = '';
        if (contextMenu) contextMenu.style.fontSize = '';
    }
}

function applyWindowFontSize(windowId, fontSize) {
    const window = document.getElementById(windowId);
    if (!window) return;
    
    if (fontSize && fontSize !== 14) {
        window.style.fontSize = fontSize + 'px';
    } else {
        window.style.fontSize = '';
    }
}

function showContextMenu(widgetId, mouseX, mouseY) {
    activeWidgetId = widgetId;
    const w = widgets.find(widget => widget.id === widgetId);
    if (!w) return;
    ensureStyle(w);

    const clockSet = document.getElementById('clock-specific-settings');
    if (clockSet) {
        clockSet.classList.toggle('hidden', w.type !== 'clock');
        if (w.type === 'clock') {
            document.getElementById('ctx-clock-mode').value = w.clockSettings?.mode || 'digital';
            document.getElementById('ctx-clock-format').value = w.clockSettings?.format || '24';
            document.getElementById('ctx-show-seconds').checked = w.clockSettings?.showSeconds ?? true;
        }
    }

    const weatherSet = document.getElementById('weather-specific-settings');
    if (weatherSet) {
        weatherSet.classList.toggle('hidden', w.type !== 'weather');
        if (w.type === 'weather') {
            document.getElementById('ctx-weather-city').value = w.city || 'NIZHNY NOVGOROD';
            document.getElementById('ctx-weather-source').value = w.weatherSource || 'openMeteo';
        }
    }
    
    const countdownSet = document.getElementById('countdown-specific-settings');
    if (countdownSet) {
        countdownSet.classList.toggle('hidden', w.type !== 'countdown');
        if (w.type === 'countdown') {
            document.getElementById('ctx-countdown-title').value = w.countdownTitle || '';
            document.getElementById('ctx-countdown-date').value = w.countdownDate || '';
        }
    }

    const translatorSet = document.getElementById('translator-specific-settings');
    if (translatorSet) {
        translatorSet.classList.toggle('hidden', w.type !== 'translator');
        if (w.type === 'translator') document.getElementById('ctx-translator-layout').value = w.translatorLayout || 'vertical';
    }

    // 🔥 ДОБАВЬТЕ ЭТОТ БЛОК:
    // После блока translatorSet добавьте:
    const linkSet = document.getElementById('link-specific-settings');
    if (linkSet) {
        linkSet.classList.toggle('hidden', w.type !== 'link');
        if (w.type === 'link') {
            document.getElementById('ctx-link-text').value = w.text || '';
            document.getElementById('ctx-link-url').value = w.url || '';
            document.getElementById('ctx-link-icon').value = w.icon || '🔗';
        }
    }
    // Заполняем стили
    for (const [key, config] of Object.entries(WIDGET_STYLE_SCHEMA)) {
        const input = document.getElementById(`ctx-${key}`);
        if (input) {
            input.type === 'checkbox' ? input.checked = !!w.style[key] : input.value = w.style[key] ?? config.default;
            const span = document.getElementById(`ctx-${key}-val`);
            if (span && config.type === 'range') span.textContent = `${Math.round((w.style[key] ?? config.default) * (config.multiplier || 1))}${config.suffix || ''}`;
        }
    }

    // Настройки окна
    const wsIn = document.getElementById('ctx-window-scale'), wsVal = document.getElementById('ctx-window-scale-val');
    if (wsIn && wsVal) { const s = globalSettings.contextMenuScale || 1; wsIn.value = s; wsVal.textContent = Math.round(s * 100) + '%'; }
    const wfIn = document.getElementById('ctx-window-font-size'), wfVal = document.getElementById('ctx-window-font-size-val');
    if (wfIn && wfVal) { const s = globalSettings.contextMenuFontSize || 14; wfIn.value = s; wfVal.textContent = s + 'px'; }

    const menu = document.getElementById('widget-context-menu');
    if (!menu) { console.error('❌ #widget-context-menu не найден в index.html'); return; }

    if (globalSettings.contextMenuFontSize) applyWindowFontSize('widget-context-menu', globalSettings.contextMenuFontSize);
    menu.classList.remove('hidden');

    const uiScale = globalSettings.uiScale ?? 1;
    const menuScale = globalSettings.contextMenuScale ?? 1;
    const totalScale = uiScale * menuScale;

    if (globalSettings.contextMenuPos) {
        menu.style.left = globalSettings.contextMenuPos.x + 'px';
        menu.style.top = globalSettings.contextMenuPos.y + 'px';
        menu.style.transform = `scale(${totalScale})`;
        menu.style.transformOrigin = 'top left';
    } else {
        menu.style.left = '50%'; menu.style.top = '50%';
        menu.style.transform = `translate(-50%, -50%) scale(${totalScale})`;
        menu.style.transformOrigin = 'center center';
    }

    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        let left = parseFloat(menu.style.left), top = parseFloat(menu.style.top);
        if (menu.style.left.includes('%')) { left = rect.left; top = rect.top; menu.style.left = left + 'px'; menu.style.top = top + 'px'; menu.style.transform = `scale(${totalScale})`; menu.style.transformOrigin = 'top left'; }
        
        let changed = false;
        if (rect.left < 0) { left -= rect.left; changed = true; }
        if (rect.right > window.innerWidth) { left -= (rect.right - window.innerWidth); changed = true; }
        if (rect.top < 0) { top -= rect.top; changed = true; }
        if (rect.bottom > window.innerHeight) { top -= (rect.bottom - window.innerHeight); changed = true; }
        
        if (changed) {
            menu.style.left = Math.max(0, left) + 'px'; menu.style.top = Math.max(0, top) + 'px';
            globalSettings.contextMenuPos = { x: parseInt(menu.style.left), y: parseInt(menu.style.top) };
            saveSettings();
        }
    });
}

function initWeatherWidget(config) {
    const el = document.getElementById(config.id);
    if (!el) return;
    
    // 🔥 Очищаем старый интервал
    if (weatherIntervals.has(config.id)) {
        clearInterval(weatherIntervals.get(config.id));
        weatherIntervals.delete(config.id);
    }

    let city;
    if (config.city && typeof config.city === 'string') {
    city = config.city.trim();
    if (city === '') city = 'Moscow';
    } else {
    city = 'Moscow';
    }
        // Теперь city гарантированно строка, и не undefined
    const weatherSource = config.weatherSource || 'openMeteo';
    config.weatherSource = weatherSource; // Сохраняем в конфиг

    if (!config.weatherSource || config.weatherSource === 'undefined' || config.weatherSource === '') {
        config.weatherSource = 'openMeteo';
        debouncedSave(); // ← сохраняет в chrome.storage.local сразу
    }

    const updateWeather = async () => {
        const widgetEl = document.getElementById(config.id);
        if (!widgetEl) {
            clearInterval(weatherIntervals.get(config.id));
            weatherIntervals.delete(config.id);
            return;
        }
        try {
            const data = await fetchWeatherFromSources(city, weatherSource);
            const cityEl = widgetEl.querySelector('.weather-city');
            const tempEl = widgetEl.querySelector('.weather-temp');
            const descEl = widgetEl.querySelector('.weather-desc');
            if (cityEl) cityEl.textContent = data.name || city;
            if (tempEl) tempEl.textContent = `${data.temp}°C`;
            if (descEl) descEl.textContent = `${data.desc}`;
        } catch (e) {
            console.log('Weather error:', e);
            const cityEl = widgetEl.querySelector('.weather-city');
            const tempEl = widgetEl.querySelector('.weather-temp');
            const descEl = widgetEl.querySelector('.weather-desc');
            if (cityEl) cityEl.textContent = city;
            if (tempEl) tempEl.textContent = '--°C';
            if (descEl) descEl.textContent = 'Ошибка загрузки';
        }
    };
    setTimeout(async () => {
        await updateWeather();
    }, 500);
    // 🔥 Первый запуск С ЗАДЕРЖКОЙ (DOM готов)
    setTimeout(() => updateWeather(), 300);
    weatherIntervals.set(config.id, setInterval(updateWeather, 1800000));
}

function initDraggableWindows() {
    let action = null, target = null, offsetX = 0, offsetY = 0, startWidth = 0, startHeight = 0;

    const constrainToScreen = (el) => {
        if (!el) return;
        const scale = parseFloat(el.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1);
        const w = el.offsetWidth * scale, h = el.offsetHeight * scale;
        let l = parseFloat(el.style.left) || 0, t = parseFloat(el.style.top) || 0;
        if (l < 0) l = 0; if (l > window.innerWidth - w) l = window.innerWidth - w;
        if (t < 0) t = 0; if (t > window.innerHeight - h) t = window.innerHeight - h;
        el.style.left = l + 'px'; el.style.top = t + 'px';
    };

    // === Инициализация позиций (оставлена без изменений) ===
    const settingsPanel = document.getElementById('settings-panel');
    const contextMenu = document.getElementById('widget-context-menu');
    const widgetMenu = document.getElementById('widget-menu');
    const uiScale = globalSettings.uiScale ?? 1;
    const totalContextScale = uiScale * (globalSettings.contextMenuScale ?? 1);
    const totalSettingsScale = uiScale * (globalSettings.settingsPanelScale ?? 1);

    if (globalSettings.settingsPos && settingsPanel) {
        settingsPanel.style.left = globalSettings.settingsPos.x + 'px';
        settingsPanel.style.top = globalSettings.settingsPos.y + 'px';
        settingsPanel.style.transform = `scale(${totalSettingsScale})`;
        settingsPanel.style.transformOrigin = 'top left';
    } else if (settingsPanel) {
        settingsPanel.style.left = '50%'; settingsPanel.style.top = '50%';
        settingsPanel.style.transform = `translate(-50%, -50%) scale(${totalSettingsScale})`;
        settingsPanel.style.transformOrigin = 'center center';
    }
    if (globalSettings.settingsSize && settingsPanel) {
        settingsPanel.style.width = globalSettings.settingsSize.w + 'px';
        settingsPanel.style.height = globalSettings.settingsSize.h + 'px';
    }

    if (globalSettings.contextMenuPos && contextMenu) {
        contextMenu.style.left = globalSettings.contextMenuPos.x + 'px';
        contextMenu.style.top = globalSettings.contextMenuPos.y + 'px';
        contextMenu.style.transform = `scale(${totalContextScale})`;
        contextMenu.style.transformOrigin = 'top left';
    } else if (contextMenu) {
        contextMenu.style.left = '50%'; contextMenu.style.top = '50%';
        contextMenu.style.transform = `translate(-50%, -50%) scale(${totalContextScale})`;
        contextMenu.style.transformOrigin = 'center center';
    }
    if (globalSettings.contextMenuSize && contextMenu) {
        contextMenu.style.width = globalSettings.contextMenuSize.w + 'px';
        contextMenu.style.height = globalSettings.contextMenuSize.h + 'px';
    }

    if (globalSettings.widgetMenuPos && widgetMenu) {
        widgetMenu.style.left = globalSettings.widgetMenuPos.x + 'px';
        widgetMenu.style.top = globalSettings.widgetMenuPos.y + 'px';
        widgetMenu.style.transform = `scale(${uiScale})`;
        widgetMenu.style.transformOrigin = 'top left';
        if (globalSettings.widgetMenuSize) {
            widgetMenu.style.width = globalSettings.widgetMenuSize.w + 'px';
            widgetMenu.style.height = globalSettings.widgetMenuSize.h + 'px';
        }
    } else if (widgetMenu) {
        widgetMenu.style.left = '50%'; widgetMenu.style.bottom = '100px';
        widgetMenu.style.transform = `translateX(-50%) scale(${uiScale})`;
        widgetMenu.style.transformOrigin = 'center bottom';
    }

    // === Drag & Drop ===
    document.addEventListener('mousedown', e => {
        const resizeHandle = e.target.closest('.window-resize-handle');
        const panel = e.target.closest('#settings-panel, #widget-context-menu, #widget-menu');
        if (!panel) return;

        // Игнорируем интерактивные элементы внутри контента
        if (e.target.closest('button, input, select, textarea, a, .menu-item, .ctx-row, .settings-tab, .window-content, .menu-tabs, .menu-tab')) return;

        let isHeader = false;
        if (panel.id === 'settings-panel' && e.target.closest('.settings-header')) isHeader = true;
        if (panel.id === 'widget-context-menu' && e.target.closest('.window-header')) isHeader = true;
        if (panel.id === 'widget-menu' && e.target.closest('.menu-header')) isHeader = true;

        if (!resizeHandle && !isHeader) return;

        action = resizeHandle ? 'resize' : 'drag';
        target = panel;
        target.style.transition = 'none';

        if (action === 'resize') {
            offsetX = e.clientX; offsetY = e.clientY;
            startWidth = target.offsetWidth; startHeight = target.offsetHeight;
            document.body.style.cursor = 'nwse-resize';
        } else {
            const rect = target.getBoundingClientRect();
            // Корректный переход в абсолютное позиционирование
            if (!target.style.left || target.style.left.includes('%') || target.style.transform.includes('translate')) {
                target.style.left = rect.left + 'px';
                target.style.top = rect.top + 'px';
            }
            const scaleMatch = target.style.transform.match(/scale\([^)]+\)/);
            target.style.transform = scaleMatch ? scaleMatch[0] : 'scale(1)';
            target.style.transformOrigin = 'top left';
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.body.style.cursor = 'grabbing';
        }
        e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!action || !target) return;
        if (action === 'resize') {
            target.style.width = Math.max(280, startWidth + (e.clientX - offsetX)) + 'px';
            target.style.height = Math.max(200, startHeight + (e.clientY - offsetY)) + 'px';
            if (globalSettings.autoScaleFont) applyAutoScaleFont();
        } else {
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;
            const scale = parseFloat(target.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1);
            const maxX = window.innerWidth - (target.offsetWidth * scale);
            const maxY = window.innerHeight - (target.offsetHeight * scale);
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            target.style.left = newLeft + 'px';
            target.style.top = newTop + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if (!target) return;
        target.style.transition = '';
        document.body.style.cursor = '';
        constrainToScreen(target);
        const x = parseInt(target.style.left) || 0, y = parseInt(target.style.top) || 0;
        if (target.id === 'settings-panel') globalSettings.settingsPos = { x, y };
        else if (target.id === 'widget-context-menu') globalSettings.contextMenuPos = { x, y };
        else if (target.id === 'widget-menu') globalSettings.widgetMenuPos = { x, y };
        saveSettings();
        action = null; target = null;
    });

    window.addEventListener('resize', () => {
        [settingsPanel, contextMenu, widgetMenu].forEach(el => {
            if (el && !el.classList.contains('hidden')) constrainToScreen(el);
        });
    });
}

function hideContextMenu() {
    const menu = document.getElementById('widget-context-menu');
    menu.classList.add('hidden');
    activeWidgetId = null;
}

function initContextMenu() {
    // Крестик закрытия
    document.getElementById('ctx-close-btn').onclick = (e) => { e.stopPropagation(); hideContextMenu(); };

    ['ctx-clock-mode', 'ctx-clock-format', 'ctx-show-seconds'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            const w = widgets.find(x => x.id === activeWidgetId);
            if (!w) return;
            if (id === 'ctx-clock-mode') w.clockSettings.mode = e.target.value;
            if (id === 'ctx-clock-format') w.clockSettings.format = e.target.value;
            if (id === 'ctx-show-seconds') w.clockSettings.showSeconds = e.target.checked;
            const el = document.getElementById(w.id);
            if (el) {
                const hideBtn = el.querySelector('.widget-hide-btn')?.outerHTML || '';
                const closeBtn = el.querySelector('.widget-close-btn')?.outerHTML || '';
                const menuBtn = el.querySelector('.widget-menu-btn')?.outerHTML || '';
                const res = el.querySelector('.resize-handle')?.outerHTML || '';
                const content = WIDGET_TYPES.clock.render(w);
                const contentDiv = el.querySelector('.clock-digital, .clock-analog')?.parentElement || el.firstElementChild;
                if (contentDiv) {
                    contentDiv.outerHTML = content;
                }
            }
            debouncedSave();
        });
    });

    document.getElementById('ctx-weather-city').addEventListener('change', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'weather') {
            w.city = e.target.value;
            debouncedSave();
            initWeatherWidget(w);
        }
    });

    // 🔥 ДОБАВЬТЕ ЭТОТ БЛОК:
    document.getElementById('ctx-weather-source')?.addEventListener('change', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'weather') {
            w.weatherSource = e.target.value;
            debouncedSave();
            initWeatherWidget(w);
        }
    });


    document.getElementById('ctx-weather-source')?.addEventListener('change', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'weather') {
            w.weatherSource = e.target.value;
            debouncedSave();
            initWeatherWidget(w);
        }
    });

    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ ГОРОДА В КОНТЕКСТНОМ МЕНЮ ===
    document.getElementById('ctx-weather-city')?.addEventListener('change', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'weather') {
            w.city = e.target.value.trim();
            debouncedSave(); // ← используем debouncedSave, а не прямой set()
            initWeatherWidget(w); // ← обязательно перезапускаем с новым city
        }
    });
        // Обработчик для названия события
    document.getElementById('ctx-countdown-title').addEventListener('input', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'countdown') {
            w.countdownTitle = e.target.value;
            const el = document.getElementById(w.id);
            if (el) {
                const titleEl = el.querySelector('.countdown-title');
                if (titleEl) titleEl.textContent = w.countdownTitle;
            }
            debouncedSave();
        }
    });

    // Обработчик для даты
    document.getElementById('ctx-countdown-date').addEventListener('change', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'countdown') {
            w.countdownDate = e.target.value;
            debouncedSave();
            // Обновляем виджет
            const el = document.getElementById(w.id);
            if (el) {
                initCountdownWidget(el, w);
            }
        }
    });

    document.getElementById('ctx-translator-layout')?.addEventListener('change', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'translator') {
            w.translatorLayout = e.target.value;
            const widget = document.getElementById(w.id);
            if (widget) {
                if (w.translatorLayout === 'horizontal') {
                    w.size = { w: 700, h: 280 };
                } else {
                    w.size = { w: 380, h: 420 };
                }
                widget.style.width = w.size.w + 'px';
                widget.style.height = w.size.h + 'px';
                widget.querySelector('.translator-widget').classList.toggle('translator-horizontal', w.translatorLayout === 'horizontal');
            }
            debouncedSave();
        }
    });

    // Обработчики для виджета Ссылка
    document.getElementById('ctx-link-text')?.addEventListener('input', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'link') {
            w.text = e.target.value;
            debouncedSave();
            const el = document.getElementById(w.id);
            if (el) {
                const linkEl = el.querySelector('a');
                if (linkEl) linkEl.textContent = w.text || 'Link';
            }
        }
    });

    document.getElementById('ctx-link-url')?.addEventListener('input', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'link') {
            w.url = e.target.value;
            debouncedSave();
            const el = document.getElementById(w.id);
            if (el) {
                const linkEl = el.querySelector('a');
                if (linkEl) linkEl.href = w.url || '#';
            }
        }
    });

    document.getElementById('ctx-link-icon')?.addEventListener('input', (e) => {
        const w = widgets.find(x => x.id === activeWidgetId);
        if (w && w.type === 'link') {
            w.icon = e.target.value;
            debouncedSave();
            const el = document.getElementById(w.id);
            if (el) {
                const contentEl = el.querySelector('.widget-link-content');
                if (contentEl) {
                    contentEl.innerHTML = `${w.icon ? `<span style="font-size:1.5em;">${w.icon}</span>` : ''}<a href="${w.url || '#'}" target="_blank">${w.text || 'Link'}</a>`;
                }
            }
        }
    });

    // Применение размера шрифта к окну настроек
    const fontSizeInput = document.getElementById('ctx-fontSize');
    if (fontSizeInput) {
        fontSizeInput.addEventListener('input', () => {
            const menu = document.getElementById('widget-context-menu');
            if (menu && globalSettings.autoScaleFont) {
                applyAutoScaleFont();
            }
        });
    }

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('widget-context-menu');
        if (!menu.contains(e.target) && !e.target.closest('.widget-menu-btn')) hideContextMenu();
    });
}

// === ГЛОБАЛЬНЫЕ НАСТРОЙКИ ===
function initGlobalSettings() {
    const btn = document.getElementById('dock-settings');
    const panel = document.getElementById('settings-panel');
    btn.onclick = (e) => { 
        e.stopPropagation(); 
        const wasHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden'); 
        document.getElementById('widget-menu').classList.add('hidden'); 
        
        // Проверяем позицию после открытия
        if (wasHidden && !panel.classList.contains('hidden')) {
            requestAnimationFrame(() => {
                let left = parseInt(panel.style.left) || 0;
                let top = parseInt(panel.style.top) || 0;
                
                const rect = panel.getBoundingClientRect();
                const width = rect.width;
                const height = rect.height;
                const maxX = window.innerWidth - width;
                const maxY = window.innerHeight - height;
                
                left = Math.max(0, Math.min(left, maxX));
                top = Math.max(0, Math.min(top, maxY));
                
                panel.style.left = left + 'px';
                panel.style.top = top + 'px';
            });
        }
    };
    document.getElementById('close-settings').onclick = (e) => { e.stopPropagation(); panel.classList.add('hidden'); };
}

function initWallpaperUpload() {
    const input = document.getElementById('wallpaper-input');
    const uploadBtn = document.getElementById('btn-upload-wallpaper');
    const resetBtn = document.getElementById('btn-reset-wallpaper');
    if (!uploadBtn) return;

    uploadBtn.onclick = () => input.click();
    input.onchange = (e) => {
        if (!e.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target.result;
            await chrome.storage.local.set({ wallpaperData: base64 });
            applyWallpaperFromBase64(base64);
            if (resetBtn) resetBtn.style.display = 'inline-block';
            debouncedSave();
        };
        reader.readAsDataURL(e.target.files[0]);
    };
    if (resetBtn) {
        resetBtn.onclick = async () => {
            globalSettings.wallpaper = null;
            if (wallpaperBlobUrl) { URL.revokeObjectURL(wallpaperBlobUrl); wallpaperBlobUrl = null; }
            document.body.style.backgroundImage = 'none';
            resetBtn.style.display = 'none';
            input.value = '';
            await chrome.storage.local.remove('wallpaperData');
            debouncedSave();
        };
    }
}

// === DOCK: ИСЧЕЗНОВЕНИЕ ПРИ РАЗВОРАЧИВАНИИ ===
let currentPreview = null;

function removeDockPreview() {
    if (currentPreview) {
        currentPreview.remove();
        currentPreview = null;
    }
}

function showDockPreview(widget, btn) {
    if (globalSettings.dockHoverPreview === false) return;
    removeDockPreview();

    const def = WIDGET_TYPES[widget.type];
    const preview = document.createElement('div');
    preview.className = 'dock-preview';

    const rect = btn.getBoundingClientRect();
    const pos = globalSettings.dockPosition ?? 'bottom';

    // Позиционирование превью в зависимости от позиции Dock
    if (pos === 'bottom') {
        preview.style.left = (rect.left + rect.width / 2 - 75) + 'px';
        preview.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
        preview.style.top = 'auto';
    } else if (pos === 'top') {
        preview.style.left = (rect.left + rect.width / 2 - 75) + 'px';
        preview.style.top = (rect.bottom + 10) + 'px';
        preview.style.bottom = 'auto';
    } else if (pos === 'left') {
        preview.style.left = (rect.right + 10) + 'px';
        preview.style.top = (rect.top + rect.height / 2 - 50) + 'px';
        preview.style.bottom = 'auto';
    } else if (pos === 'right') {
        preview.style.left = 'auto';
        preview.style.right = (window.innerWidth - rect.left + 10) + 'px';
        preview.style.top = (rect.top + rect.height / 2 - 50) + 'px';
        preview.style.bottom = 'auto';
    }

    let content = `<div class="preview-title">${def.label}</div>`;
    if (widget.type === 'clock') content += `<div class="preview-content">🕒</div>`;
    else if (widget.type === 'weather') content += `<div class="preview-content">🌤️ ${widget.city || '...'}</div>`;
    else if (widget.type === 'timer') content += `<div class="preview-content">⏱️ Таймер</div>`;
    else if (widget.type === 'todo') content += `<div class="preview-content">✅ ${widget.todos?.length || 0} задач</div>`;
    else if (widget.type === 'note') content += `<div class="preview-content" style="font-size:14px;max-width:140px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${widget.content?.substring(0, 30) || 'Заметка'}</div>`;
    else content += `<div class="preview-content">${def.icon}</div>`;

    preview.innerHTML = content;
    document.body.appendChild(preview);
    currentPreview = preview;
}

function applyDockAutoHide() {
    const dock = document.getElementById('bottom-panel');
    if (!dock) return;

    const minimizedCount = widgets.filter(w => w.minimized).length;

    if (globalSettings.dockAutoHide) {
        dock.classList.add('auto-hide');
        if (minimizedCount > 0) dock.classList.add('has-widgets');
        else dock.classList.remove('has-widgets');
    } else {
        dock.classList.remove('auto-hide', 'has-widgets');
    }
}

function applyDockScale() {
    const dock = document.getElementById('bottom-panel');
    if (!dock) return;
    const pos = globalSettings.dockPosition ?? 'bottom';
    if (pos === 'bottom' || pos === 'top') dock.style.transformOrigin = `${pos} center`;
    else dock.style.transformOrigin = `center ${pos}`;
}

function applyDockPosition() {
    const dock = document.getElementById('bottom-panel');
    if (!dock) return;

    const pos = globalSettings.dockPosition ?? 'bottom';
    const uiScale = globalSettings.uiScale ?? 1;

    dock.style.top = '';
    dock.style.bottom = '';
    dock.style.left = '';
    dock.style.right = '';
    dock.style.transform = '';
    dock.classList.remove('dock-left', 'dock-right', 'dock-top', 'dock-bottom');
    dock.classList.add(`dock-${pos}`);

    // Если есть сохранённая позиция от перетаскивания
    if (globalSettings.dockCustomPos) {
        dock.style.left = globalSettings.dockCustomPos.x + 'px';
        dock.style.top = globalSettings.dockCustomPos.y + 'px';
        dock.style.transform = `scale(${(globalSettings.dockScale ?? 1) * uiScale})`;
        if (pos === 'left' || pos === 'right') dock.style.flexDirection = 'column';
        applyDockScale();
        return;
    }

    if (pos === 'bottom') {
        dock.style.bottom = '24px';
        dock.style.left = '50%';
        dock.style.transform = `translateX(-50%) scale(${(globalSettings.dockScale ?? 1) * uiScale})`;
    } else if (pos === 'top') {
        dock.style.top = '24px';
        dock.style.left = '50%';
        dock.style.transform = `translateX(-50%) scale(${(globalSettings.dockScale ?? 1) * uiScale})`;
    } else if (pos === 'left') {
        dock.style.left = '24px';
        dock.style.top = '50%';
        dock.style.transform = `translateY(-50%) scale(${(globalSettings.dockScale ?? 1) * uiScale})`;
        dock.style.flexDirection = 'column';
    } else if (pos === 'right') {
        dock.style.right = '24px';
        dock.style.top = '50%';
        dock.style.transform = `translateY(-50%) scale(${(globalSettings.dockScale ?? 1) * uiScale})`;
        dock.style.flexDirection = 'column';
    }

    applyDockScale();
}

function initDockDrag() {
    const dock = document.getElementById('bottom-panel');
    if (!dock) return;
    let isDragging = false, offsetX, offsetY;

    dock.addEventListener('mousedown', (e) => {
        if (globalSettings.lockDock) return;
        if (e.target.closest('button, .dock-widget-btn, .dock-item')) return;
        
        const rect = dock.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        isDragging = true;
        
        const uiScale = globalSettings.uiScale ?? 1;
        const scale = (globalSettings.dockScale ?? 1) * uiScale;
        
        dock.style.transform = `scale(${scale})`;
        dock.style.transformOrigin = 'top left';
        dock.style.left = rect.left + 'px';
        dock.style.top = rect.top + 'px';
        dock.style.bottom = '';
        dock.style.right = '';
        dock.style.transition = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        dock.style.left = (e.clientX - offsetX) + 'px';
        dock.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        dock.style.transition = '';
        globalSettings.dockCustomPos = { x: parseInt(dock.style.left), y: parseInt(dock.style.top) };
        saveSettings();
    });
}

function renderDock() {
    const container = document.getElementById('dock-widgets-container');
    const minimized = widgets.filter(w => w.minimized);
    const existingIds = new Set([...container.children].map(el => el.dataset.widgetId));
    const newIds = new Set(minimized.map(w => w.id));

    // Удаляем кнопки, которых больше нет
    [...container.children].forEach(el => {
        if (!newIds.has(el.dataset.widgetId)) el.remove();
    });

    // Добавляем новые
    minimized.forEach(w => {
        if (existingIds.has(w.id)) return;
        const def = WIDGET_TYPES[w.type];
        if (!def) return;
        const btn = document.createElement('div');
        btn.className = 'dock-widget-btn';
        btn.dataset.widgetId = w.id;
        btn.title = `Восстановить: ${def.label}`;
        btn.innerHTML = `<span>${def.icon}</span>`;

        btn.addEventListener('mouseenter', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'dock-tooltip';
            tooltip.textContent = def.label;
            btn.appendChild(tooltip);
            showDockPreview(w, btn);
        });
        btn.addEventListener('mouseleave', () => {
            btn.querySelector('.dock-tooltip')?.remove();
            removeDockPreview();
        });

        btn.onclick = () => {
            removeDockPreview();
            const el = document.getElementById(w.id);
            if (el) {
                w.minimized = false;
                
                // Получаем позицию кнопки в Dock для анимации разворачивания
                const btnRect = btn.getBoundingClientRect();
                const targetX = w.pos.x;
                const targetY = w.pos.y;
                
                // Начальная позиция - от кнопки в Dock
                const startX = btnRect.left - targetX;
                const startY = btnRect.top - targetY;
                
                el.classList.remove('minimized');
                
                // Сначала применяем правильные стили
                applyWidgetStyle(w);
                
                // Затем делаем простую анимацию появления
                el.style.opacity = '0';
                requestAnimationFrame(() => {
                    el.style.transition = 'opacity 0.2s ease';
                    el.style.opacity = '';
                    
                    setTimeout(() => {
                        el.style.transition = '';
                    }, 200);
                });
                
                debouncedSave();
                renderDock();
                applyDockAutoHide();
            }
        };
        container.appendChild(btn);
    });

    applyDockAutoHide();
    applyDockPosition();
}

// === МЕНЮ ДОБАВЛЕНИЯ ===
function initMenu() {
    const container = document.getElementById('menu-items');
    let activeCategory = 'all';
    
    const renderWidgets = (category) => {
        container.innerHTML = '';
        for (const [type, def] of Object.entries(WIDGET_TYPES)) {
            if (category !== 'all' && def.category !== category) continue;
            const item = document.createElement('div');
            item.className = 'menu-item';
            item.innerHTML = `<span style="font-size:20px;">${def.icon}</span><span>${def.label}</span>`;
            item.onclick = () => addWidget(type);
            container.appendChild(item);
        }
    };
    
    // Инициализация вкладок
    document.querySelectorAll('.menu-tab').forEach(tab => {
        tab.onclick = (e) => {
            e.stopPropagation();
            activeCategory = tab.dataset.category;
            document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderWidgets(activeCategory);
        };
    });
    
    document.getElementById('close-widget-menu').onclick = (e) => {
        e.stopPropagation();
        const menu = document.getElementById('widget-menu');
        menu.classList.add('hidden');
    };
    
    document.getElementById('dock-add').onclick = (e) => {
        e.stopPropagation();
        const menu = container.parentElement;
        const wasHidden = menu.classList.contains('hidden');
        menu.classList.toggle('hidden');
        
        // Проверяем позицию после открытия
        if (wasHidden && !menu.classList.contains('hidden')) {
            requestAnimationFrame(() => {
                const rect = menu.getBoundingClientRect();
                
                // Если окно за границами экрана, сбрасываем позицию
                if (rect.left < 0 || rect.right > window.innerWidth || 
                    rect.top < 0 || rect.bottom > window.innerHeight) {
                    // Сбрасываем сохранённую позицию
                    globalSettings.widgetMenuPos = null;
                    saveSettings();
                    
                    // Возвращаем к центру по умолчанию
                    const uiScale = globalSettings.uiScale ?? 1;
                    menu.style.left = '50%';
                    menu.style.bottom = '100px';
                    menu.style.top = '';
                    menu.style.transform = `translateX(-50%) scale(${uiScale})`;
                    menu.style.transformOrigin = 'center bottom';
                }
            });
        }
    };
    
    renderWidgets('all');
}

function addWidget(type) {
    const def = WIDGET_TYPES[type];
    if (!def) return;
    const id = 'widget-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const centerX = (window.innerWidth - def.defaultSize.w) / 2;
    const centerY = (window.innerHeight - def.defaultSize.h - 100) / 2;
    const config = {
        id, type,
        pos: { x: snapToGrid(centerX), y: snapToGrid(centerY) },
        size: { w: def.defaultSize.w, h: def.defaultSize.h },
        minimized: false,
        style: { opacity: globalSettings.defaultOpacity, scale: 1, fontSize: 14, bgColor: '#313244', textColor: '#cdd6f4', borderWidth: 1, borderColor: '#45475a', blur: true, ghostMode: false, autoFontSize: false }
    };
    if (type === 'clock') config.clockSettings = { mode: 'digital', format: '24', showSeconds: true };
    if (type === 'todo') config.todos = [];
    if (type === 'timer') {
        config.timerData = { remaining: 0, isRunning: false, sound: 'classic', totalDuration: 0 };
        config.stopwatchData = { elapsed: 0, isRunning: false, laps: [] };
        config.timerMode = 'timer';
    }

    widgets.push(config);
    createWidgetDOM(config);
    debouncedSave();
    document.getElementById('widget-menu').classList.add('hidden');
    renderDock();
}


// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ИМПОРТА/ЭКСПОРТА ===

window.exportData = async function() {
    try {
        // Собираем текущие данные из памяти (они самые свежие)
        const currentWidgets = widgets;
        const currentSettings = globalSettings;

        // Получаем данные, которые хранятся только в chrome.storage
        const storageData = await chrome.storage.local.get(['wallpaperData', 'weatherApiKeys']);

        const exportObj = {
            version: "4.0",
            timestamp: new Date().toISOString(),
            widgets: currentWidgets,
            settings: currentSettings,
            wallpaperData: storageData.wallpaperData || null,
            weatherApiKeys: storageData.weatherApiKeys || {}
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MyNewTab_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Ошибка экспорта:', e);
        alert('Не удалось экспортировать данные.');
    }
};

window.importData = async function(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);

            // Простая валидация
            if (!data.widgets && !data.settings) {
                alert('Ошибка: Неправильный формат файла.');
                return;
            }

            const ok = await showConfirm('Импорт данных', 'Это перезапишет все ваши текущие настройки, виджеты и обои. Продолжить?');
            if (!ok) return;

            // Подготовка данных для сохранения
            const storageUpdate = {};
            if (data.widgets) storageUpdate.widgets = data.widgets;
            if (data.settings) storageUpdate.settings = data.settings;
            if (data.weatherApiKeys) storageUpdate.weatherApiKeys = data.weatherApiKeys;
            
            // Обработка обоев
            if (data.wallpaperData !== undefined) {
                storageUpdate.wallpaperData = data.wallpaperData;
                // Если есть данные обоев, убеждаемся, что флаг включен в настройках
                if (data.settings) {
                    data.settings.wallpaper = true;
                    storageUpdate.settings = data.settings;
                } else if (storageUpdate.settings) {
                    storageUpdate.settings.wallpaper = true;
                }
            }

            // Сохранение и перезагрузка
            await chrome.storage.local.set(storageUpdate);
            alert('Импорт успешен! Страница перезагружается...');
            location.reload();

        } catch (err) {
            console.error('Ошибка импорта:', err);
            alert('Ошибка при чтении файла резервной копии.');
        }
    };
    reader.readAsText(file);
    inputElement.value = ''; // Сброс инпута
};