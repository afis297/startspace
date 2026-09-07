import { createInitialState, createStore } from "./store.js";
import { createPersistence, loadLayoutState } from "./persistence.js";
import { createWorkspaceManager } from "./workspace-manager.js";
import { createWidgetRegistry } from "../widgets/registry.js";
import { widgetDefinitions } from "../widgets/definitions.js";
import { mountWorkspace } from "../ui/workspace.js";
import { mountDock } from "../ui/dock.js";
import { mountPropertiesPanel } from "../ui/properties-panel.js";
import { mountSettingsPanel } from "../ui/settings-panel.js";
import { mountWorkspaceSettings, mountWorkspaceSwitcher } from "../ui/workspace-ui.js";
import { arrangeWidgets, mountAutoLayoutTools } from "../ui/auto-layout-ui.js";
import { getWorkspaceBounds, nextWidgetPosition } from "./geometry.js";
import { getWorkspaceTemplate } from "./workspace-templates.js";
import { mountFloatingPanel } from "../ui/floating-panel.js";
import { mountNotifications } from "../ui/notifications.js";
import { mountOnboarding } from "../ui/onboarding.js";
import { mountCommandPalette } from "../ui/command-palette.js";
import { applyTheme } from "../themes/theme-manager.js";
import { routeGlobalShortcut } from "./shortcuts.js";
import { createUndoHistory } from "./undo-history.js";
import { getMasonryFeedback } from "./masonry-feedback.js";
import { controlBrowserMedia, discoverBrowserMedia, ensureBrowserMediaPermission, focusBrowserMediaTab } from "../services/browser-media-controller.js";
import { permissionDeniedMessage, requestWidgetPermissions } from "../services/permissions.js";

function getRoot(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Не найден элемент приложения: #${id}`);
  return element;
}

function createInitialWidgets(registry) {
  const layout = [
    { type: "clock", position: { x: 56, y: 52 } },
    { type: "todo", position: { x: 430, y: 52 } },
    { type: "note", position: { x: 56, y: 322 } },
    { type: "weather", position: { x: 430, y: 332 } },
    { type: "bookmarks", position: { x: 804, y: 52 } },
  ];
  return layout.map((item, index) => registry.createWidget(item.type, {
    position: item.position,
    zIndex: 101 + index,
  }));
}

async function bootstrap() {
  const workspaceRoot = getRoot("workspace");
  const dockRoot = getRoot("dock");
  const propertiesRoot = getRoot("properties-panel");
  const settingsRoot = getRoot("settings-panel");
  const notificationsRoot = getRoot("toast-region");
  const registry = createWidgetRegistry();
  widgetDefinitions.forEach((definition) => registry.register(definition));

  let loaded;
  try {
    loaded = await loadLayoutState();
  } catch (error) {
    console.warn("Не удалось загрузить сохранённый макет V5.", error);
    loaded = { state: createInitialState(), migrated: false };
  }
  const store = createStore(loaded.state);
  const workspaceManager = createWorkspaceManager(store);
  if (!store.getState().widgets.length && !loaded.migrated) {
    store.batch(() => createInitialWidgets(registry).forEach((widget) => store.addWidget(widget)), "initial-widgets");
  }

  const persistence = createPersistence(store);
  if (loaded.migrated || !loaded.state.widgets.length) persistence.scheduleSave();
    const notifications = mountNotifications({ root: notificationsRoot });
  const history = createUndoHistory({ notify: notifications.notify });
	
  const context = Object.freeze({
    store,
    registry,
    notify: notifications.notify,
    locale: () => store.getState().settings.locale || navigator.language || "ru-RU",
  });

  const properties = mountPropertiesPanel({
    root: propertiesRoot,
    store,
    registry,
    notify: notifications.notify,
    onClose: () => properties.close(),
  });
  const settings = mountSettingsPanel({
    root: settingsRoot,
    store,
    registry,
    notify: notifications.notify,
    onClose: () => {
      settings.close();
      document.dispatchEvent(new Event("mflt-onboarding-resume"));
    },
  });
  const propertiesFloating = mountFloatingPanel({ root: propertiesRoot, store, key: "properties" });
  const settingsFloating = mountFloatingPanel({ root: settingsRoot, store, key: "settings" });
  const workspace = mountWorkspace({
    root: workspaceRoot,
    store,
    registry,
    context,
    onOpenProperties: (id) => properties.open(id),
    notify: notifications.notify,
    onHistoryCommand: history.record,
  });
  const dock = mountDock({
    root: dockRoot,
    store,
    registry,
    workspaceRoot,
    notify: notifications.notify,
    onOpenSettings: () => settings.open(),
    onOpenProperties: (id) => properties.open(id),
    onHistoryCommand: history.record,
  });

  const createWorkspaceFromTemplate = async (name, templateId) => {
    const template = getWorkspaceTemplate(templateId);
    for (const type of template.types) {
      const granted = await requestWidgetPermissions(type);
      if (!granted) throw new Error(permissionDeniedMessage(type));
    }
    await workspaceManager.create(name);
    if (!template.types.length) return;
    const state = store.getState();
    const bounds = getWorkspaceBounds(workspaceRoot);
    store.batch((api) => {
      template.types.forEach((type, index) => {
        const widget = registry.createWidget(type, {
          position: nextWidgetPosition(state.widgets.length + index, bounds),
          zIndex: state.ui.nextZIndex + index + 1,
        });
        api.addWidget(widget, "workspace-template-add");
      });
    }, "workspace-template-add");
    requestAnimationFrame(() => arrangeWidgets(store, workspaceRoot));
    notifications.notify({
      title: `Пространство «${template.title}» создано`,
      message: `Добавлено виджетов: ${template.types.length}. Раскладку можно изменить вручную.`,
      type: "success",
    });
  };
  const workspaceSwitcher = mountWorkspaceSwitcher({
    root: dockRoot,
    manager: workspaceManager,
    notify: notifications.notify,
    onCreateTemplate: createWorkspaceFromTemplate,
  });
  const workspaceSettings = mountWorkspaceSettings({
    root: settingsRoot,
    manager: workspaceManager,
    notify: notifications.notify,
    onCreateTemplate: createWorkspaceFromTemplate,
  });
  const autoLayoutTools = mountAutoLayoutTools({
    root: settingsRoot,
    store,
    workspaceRoot,
    notify: notifications.notify,
    onHistoryCommand: history.record,
  });
  const onboarding = mountOnboarding({
    root: document.body,
    store,
    onAddWidget: () => dockRoot.querySelector(".dock-add")?.click(),
    onOpenSettings: (tab) => settings.open(tab),
    onOpenSpaces: () => dockRoot.querySelector(".workspace-switcher-trigger")?.click(),
  });
	
  const apply = (state) => applyTheme(state.settings);
  apply(store.getState());
  if (location.hash === "#web-panel") {
    settings.open("web-panel");
    history.replaceState(null, "", location.pathname);
  }

  // Панель, встроенная в собственную вкладку расширения, вызывает этот мост напрямую.
  // Так она использует абсолютно тот же сервис, что и обычный виджет воспроизведения,
  // без нестабильного сообщения между контекстами расширения.
  const onWebPanelMediaRequest = (event) => {
    const request = event.detail;
    if (!request?.message || typeof request.respond !== "function") return;
    (async () => {
      const message = request.message;
      if (message.type === "mflt-web-panel-media-discover") {
        let snapshot = await discoverBrowserMedia({ ...(message.session || {}), cycle: Boolean(message.cycle), forceRefresh: !message.cycle });
        if (snapshot.permissionRequired && message.requestPermission) {
          const permission = await ensureBrowserMediaPermission();
          snapshot = permission.granted ? await discoverBrowserMedia({ ...(message.session || {}), cycle: Boolean(message.cycle), forceRefresh: !message.cycle }) : { found: false, message: permission.message || "Доступ к медиавкладкам не предоставлен." };
        }
        request.respond({ ok: true, snapshot });
        return;
      }
      if (message.type === "mflt-web-panel-media-command") {
        const session = message.session || {};
        const snapshot = message.action === "focus"
          ? { ...session, found: Boolean(await focusBrowserMediaTab(session.tabId)) }
          : await controlBrowserMedia(session.tabId, message.action, message.value ?? null, session.frameId, session.mediaKey);
        request.respond({ ok: true, snapshot });
      }
    })().catch((error) => request.respond({ ok: false, snapshot: { found: false, message: error?.message || "Не удалось выполнить команду медиаплеера." } }));
  };
  document.addEventListener("mflt-web-panel-media-request", onWebPanelMediaRequest);
  const unsubscribeTheme = store.subscribe((state, event) => {
    if (["settings", "replace", "batch"].includes(event?.type)) apply(state);
  });

  let widgetsHidden = false;
  const toggleWidgetsVisibility = () => {
    widgetsHidden = !widgetsHidden;
    workspaceRoot.classList.toggle("is-widgets-hidden", widgetsHidden);
    if (widgetsHidden) workspaceRoot.setAttribute("aria-hidden", "true");
    else workspaceRoot.removeAttribute("aria-hidden");
    workspaceRoot.inert = widgetsHidden;
    notifications.notify({
      title: widgetsHidden ? "Виджеты скрыты" : "Виджеты показаны",
      message: "Ctrl+Shift+H — переключить видимость всех виджетов",
      type: "success",
    });
  };
  const recordCommandPatch = (id, before, after, label) => {
    history.record({
      label,
      undo: () => store.updateWidget(id, structuredClone(before), "history-undo"),
      redo: () => store.updateWidget(id, structuredClone(after), "history-redo"),
    });
  };
  const revealWidget = (widget) => {
    if (widget.collapsed) store.updateWidget(widget.id, { collapsed: false }, "command-palette-expand");
    store.bringToFront(widget.id, "command-palette-focus");
  };
  const toggleFocusTimer = () => {
    const widget = store.getState().widgets.find((item) => item.type === "focus-timer");
    if (!widget) {
      notifications.notify({ title: "Таймер не найден", message: "Добавьте виджет «Таймер» через каталог.", type: "warning" });
      return;
    }
    const config = widget.config || {};
    const now = Date.now();
    const total = Math.min(180 * 60, Math.max(1, Number(config.totalSeconds) || 25 * 60));
    const remaining = config.running && Number(config.endsAt)
      ? Math.max(0, Math.ceil((Number(config.endsAt) - now) / 1000))
      : Math.max(0, Number(config.remainingSeconds) || total);
    const running = !Boolean(config.running);
    const nextRemaining = running ? (remaining || total) : remaining;
    const before = { collapsed: Boolean(widget.collapsed), config: structuredClone(config) };
    const after = { collapsed: false, config: { ...config, running, remainingSeconds: nextRemaining, endsAt: running ? now + nextRemaining * 1000 : null } };
    store.updateWidget(widget.id, after, "command-palette-focus-timer");
    recordCommandPatch(widget.id, before, after, running ? "Запуск таймера" : "Пауза таймера");
    store.bringToFront(widget.id, "command-palette-focus");
    notifications.notify({ title: running ? "Таймер запущен" : "Таймер на паузе", message: running ? "Отсчёт продолжается в виджете таймера." : "Оставшееся время сохранено.", type: "success" });
  };
  const refreshDataWidget = ({ type, label, selector = "button[data-role='refresh']" }) => {
    const widget = store.getState().widgets.find((item) => item.type === type);
    if (!widget) {
      notifications.notify({ title: `${label} не найден`, message: `Добавьте виджет «${label}» через каталог.`, type: "warning" });
      return;
    }
    revealWidget(widget);
    requestAnimationFrame(() => {
      const widgetRoot = [...workspaceRoot.querySelectorAll("[data-widget-id]")].find((node) => node.dataset.widgetId === widget.id);
      const refresh = widgetRoot?.querySelector(selector);
      if (!(refresh instanceof HTMLButtonElement)) {
        notifications.notify({ title: `${label}: обновление недоступно`, message: "Кнопка обновления пока не готова. Попробуйте ещё раз через секунду.", type: "warning" });
        return;
      }
      if (refresh.disabled) {
        notifications.notify({ title: `${label}: обновление уже выполняется`, message: "Дождитесь завершения текущего запроса.", type: "warning" });
        return;
      }
      refresh.click();
      notifications.notify({ title: `${label}: обновление запущено`, message: "Статус и результат появятся прямо в виджете.", type: "success" });
    });
  };
  const focusTodoInput = () => {
    const widget = store.getState().widgets.find((item) => item.type === "todo");
    if (!widget) {
      notifications.notify({ title: "Задачи не найдены", message: "Добавьте виджет «Задачи» через каталог.", type: "warning" });
      return;
    }
    const before = { collapsed: Boolean(widget.collapsed) };
    const after = { collapsed: false };
    revealWidget(widget);
    if (before.collapsed) recordCommandPatch(widget.id, before, after, "Разворачивание задач");
    requestAnimationFrame(() => workspaceRoot.querySelector(`[data-widget-id="${widget.id}"] input[type="text"], [data-widget-id="${widget.id}"] input:not([type])`)?.focus());
  };
  const runMasonry = () => {
    const result = arrangeWidgets(store, workspaceRoot, { onHistoryCommand: history.record, recordHistory: true });
    notifications.notify(getMasonryFeedback(result));
  };
  const toggleDockCompact = () => {
    const current = Boolean(store.getState().settings.dock?.compact);
    store.updateSettings({ dock: { ...(store.getState().settings.dock || {}), compact: !current } }, "command-palette-dock-compact");
    notifications.notify({ title: current ? "Обычный режим панели" : "Компактный режим панели", message: current ? "Стандартные размеры кнопок восстановлены." : "Нижняя панель занимает меньше места.", type: "success" });
  };
  const commandPalette = mountCommandPalette({
    root: document.body,
    store,
    actions: [
      { title: "Добавить виджет", description: "Открыть каталог и выбрать новую карточку", keywords: ["плюс", "каталог", "виджет"], hint: "Ctrl K", run: () => dockRoot.querySelector(".dock-add")?.click() },
      { title: "Открыть настройки", description: "Все параметры Startspace", keywords: ["шестерёнка", "параметры"], run: () => settings.open() },
      { title: "Выбрать тему", description: "Готовые палитры и оформление", keywords: ["цвет", "оформление", "палитра"], run: () => settings.open("appearance") },
      { title: "Настроить свои цвета", description: "Точная палитра фона, текста и акцента", keywords: ["акцент", "кастом", "цвета"], run: () => settings.open("colors") },
      { title: "Сменить обои", description: "Градиент, цвет или изображение", keywords: ["фон", "wallpaper"], run: () => settings.open("wallpaper") },
      { title: "Открыть рабочие пространства", description: "Создать или переключить рабочий стол", keywords: ["пространство", "работа", "учёба"], run: () => dockRoot.querySelector(".workspace-switcher-trigger")?.click() },
      { title: "Настроить панель сайтов", description: "Параметры выдвижной панели и её виджетов", keywords: ["сайты", "боковая", "панель"], run: () => settings.open("web-panel") },
      { title: "Переключить фокус-таймер", description: "Запустить или поставить на паузу первый таймер", keywords: ["таймер", "фокус", "старт", "пауза"], run: toggleFocusTimer },
      { title: "Добавить задачу", description: "Открыть первый виджет задач и поставить курсор в поле", keywords: ["задача", "todo", "ввод"], run: focusTodoInput },
      { title: "Обновить RSS-ленту", description: "Открыть первую RSS-карточку и запросить свежие публикации", keywords: ["rss", "новости", "лента", "обновить"], run: () => refreshDataWidget({ type: "rss", label: "RSS-лента" }) },
      { title: "Обновить погоду", description: "Открыть первую карточку погоды и запросить актуальные данные", keywords: ["погода", "температура", "обновить"], run: () => refreshDataWidget({ type: "weather", label: "Погода" }) },
      { title: "Обновить загрузку ПК", description: "Открыть монитор системы и запросить показатели CPU, памяти и диска", keywords: ["пк", "cpu", "память", "система", "обновить"], run: () => refreshDataWidget({ type: "system-monitor", label: "Загрузка ПК" }) },
      { title: "Заполнить экран мозаикой", description: "Перестроить незакреплённые виджеты", keywords: ["мозаика", "раскладка", "авторасстановка"], run: runMasonry },
      { title: "Переключить компактный режим панели", description: "Уменьшить или восстановить размеры нижней панели", keywords: ["панель", "dock", "компактный"], run: toggleDockCompact },
      { title: widgetsHidden ? "Показать все виджеты" : "Скрыть все виджеты", description: "Переключить видимость рабочего стола", keywords: ["фокус", "скрыть", "показать"], hint: "Ctrl Shift H", run: toggleWidgetsVisibility },
      { title: "Показать знакомство", description: "Повторить интерактивный гайд по Startspace", keywords: ["тур", "помощь", "обучение"], run: () => document.dispatchEvent(new Event("mflt-show-onboarding")) },
    ],
  });
  const onKeyDown = (event) => routeGlobalShortcut(event, {
    workspaceManager,
    closePanels: () => { properties.close(); settings.close(); },
    toggleWidgetsVisibility: toggleWidgetsVisibility,
    openCommandPalette: commandPalette.open,
    undo: history.undo,
    redo: history.redo,
  });
  const onBeforeUnload = () => { workspaceManager.flush(); persistence.flush(); };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("beforeunload", onBeforeUnload);

  window.__myFreeLayoutTab = {
    version: 5,
    store,
    registry,
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("mflt-web-panel-media-request", onWebPanelMediaRequest);
      unsubscribeTheme();
      commandPalette.destroy();
      dock.destroy();
      workspaceSwitcher.destroy();
      workspaceSettings.destroy();
      autoLayoutTools.destroy();
      history.clear();
      onboarding.destroy();
      workspace.destroy();
      propertiesFloating.destroy();
      settingsFloating.destroy();
      properties.destroy();
      settings.destroy();
      notifications.destroy();
      workspaceManager.destroy();
      persistence.destroy();
    },
  };
}

bootstrap().catch((error) => {
  console.error("Startspace V5 не запущен.", error);
  const fallback = document.createElement("p");
  fallback.textContent = "Не удалось запустить новую вкладку. Откройте консоль расширения для деталей.";
  fallback.style.cssText = "position:fixed;inset:24px;color:#fff;font:16px system-ui;z-index:9999";
  document.body.append(fallback);
});




