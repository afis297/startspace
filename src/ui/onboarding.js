import { clear, element } from "./dom.js";
import { animatePanel } from "./motion.js";

function completed(settings) {
  return settings?.onboarding?.completed === true;
}

const TOUR_STEPS = Object.freeze([
  {
    label: "01 / 03 · ВИДЖЕТЫ",
    title: "Соберите нужный рабочий стол",
    description: "Startspace заменяет обычную новую вкладку на свободный рабочий стол. Начните с каталога: добавьте часы, заметку, задачи, данные или инструменты.",
    actionLabel: "Открыть каталог виджетов",
  },
  {
    label: "02 / 03 · ОФОРМЛЕНИЕ",
    title: "Настройте оформление под себя",
    description: "Шестерёнка в нижней панели открывает темы, мои цвета, обои, поведение рабочего стола и параметры выдвижной панели на сайтах.",
    actionLabel: "Открыть оформление",
  },
  {
    label: "03 / 03 · ПРОСТРАНСТВА",
    title: "Разделяйте разные задачи",
    description: "Кнопка с названием рабочего стола создаёт независимые пространства для работы, учёбы или отдыха. У каждого — свой набор и раскладка виджетов.",
    actionLabel: "Открыть рабочие пространства",
  },
]);

/** Interactive, one-time orientation for a new Startspace layout. */
export function mountOnboarding({ root, store, onAddWidget, onOpenSettings, onOpenSpaces }) {
  let overlay = null;
  let removeKeyListener = () => {};
  let resumeStep = null;

  const dismiss = (reason = "onboarding-dismiss") => {
    if (!overlay) return;
    store.updateSettings({ onboarding: { completed: true } }, reason);
    removeKeyListener();
    overlay.remove();
    overlay = null;
  };

  const pause = (nextStep) => {
    if (!overlay) return;
    resumeStep = nextStep;
    removeKeyListener();
    overlay.remove();
    overlay = null;
  };

  const runStepAction = (index) => {
    if (index === 0) { pause(1); onAddWidget?.(); return; }
    if (index === 1) { pause(2); onOpenSettings?.("appearance"); return; }
    dismiss("onboarding-open-spaces");
    onOpenSpaces?.();
  };

  const show = (force = false, initialStep = 0) => {
    if (overlay || (!force && completed(store.getState().settings))) return;
    let stepIndex = Math.max(0, Math.min(TOUR_STEPS.length - 1, Number(initialStep) || 0));
    const dialog = element("section", {
      className: "onboarding-dialog",
      attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "onboarding-title" },
    });
    const close = element("button", {
      className: "onboarding-close",
      text: "×",
      attrs: { type: "button", "aria-label": "Закрыть знакомство" },
      on: { click: () => dismiss("onboarding-close") },
    });
    const content = element("div", { className: "onboarding-step-content" });
    const back = element("button", { className: "text-action onboarding-back", text: "← Назад", attrs: { type: "button" } });
    const action = element("button", { className: "text-action onboarding-action", attrs: { type: "button" } });
    const next = element("button", { className: "primary-action onboarding-next", attrs: { type: "button" } });
    const progress = element("div", { className: "onboarding-progress", attrs: { "aria-label": "Прогресс знакомства" } });

    const renderStep = () => {
      const step = TOUR_STEPS[stepIndex];
      clear(content);
      content.append(
        element("p", { className: "onboarding-kicker", text: `STARTSPACE / ${step.label}` }),
        element("h2", { attrs: { id: "onboarding-title" }, text: step.title }),
        element("p", { className: "onboarding-intro", text: step.description }),
      );
      clear(progress);
      TOUR_STEPS.forEach((_, index) => progress.append(element("span", { className: `onboarding-progress-dot${index === stepIndex ? " is-active" : ""}`, text: String(index + 1), attrs: { "aria-current": index === stepIndex ? "step" : "false" } })));
      back.hidden = stepIndex === 0;
      action.textContent = step.actionLabel;
      next.textContent = stepIndex === TOUR_STEPS.length - 1 ? "Завершить" : `Далее: ${TOUR_STEPS[stepIndex + 1].title.split(" ").slice(0, 2).join(" ")} →`;
      animatePanel(content, store.getState().settings, { fromX: 10, fromY: 0, seconds: 0.14 });
    };

    back.addEventListener("click", () => { stepIndex = Math.max(0, stepIndex - 1); renderStep(); });
    action.addEventListener("click", () => runStepAction(stepIndex));
    next.addEventListener("click", () => {
      if (stepIndex === TOUR_STEPS.length - 1) { dismiss("onboarding-finish"); return; }
      stepIndex += 1;
      renderStep();
    });
    dialog.append(close, content, progress, element("div", { className: "onboarding-actions" }, [back, action, next]));
    renderStep();

    overlay = element("div", { className: "onboarding-overlay" }, [dialog]);
    root.append(overlay);
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss("onboarding-escape"); }
      if (event.key === "ArrowRight" && stepIndex < TOUR_STEPS.length - 1) { event.preventDefault(); stepIndex += 1; renderStep(); }
      if (event.key === "ArrowLeft" && stepIndex > 0) { event.preventDefault(); stepIndex -= 1; renderStep(); }
    };
    removeKeyListener = () => document.removeEventListener("keydown", onKeyDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    queueMicrotask(() => next.focus());
  };

  const replay = () => {
    resumeStep = null;
    store.updateSettings({ onboarding: { completed: false } }, "onboarding-replay");
    show(true);
  };
  const resume = () => {
    if (!Number.isInteger(resumeStep)) return;
    const nextStep = resumeStep;
    resumeStep = null;
    show(true, nextStep);
  };
  const onReplay = () => replay();
  const settingsRoot = document.getElementById("settings-panel");
  const settingsObserver = settingsRoot && typeof MutationObserver !== "undefined"
    ? new MutationObserver(() => { if (settingsRoot.hidden) resume(); })
    : null;
  settingsObserver?.observe(settingsRoot, { attributes: true, attributeFilter: ["hidden"] });
  const pickerRoot = document.querySelector(".widget-picker");
  const pickerObserver = pickerRoot && typeof MutationObserver !== "undefined"
    ? new MutationObserver(() => { if (pickerRoot.hidden) resume(); })
    : null;
  pickerObserver?.observe(pickerRoot, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("mflt-show-onboarding", onReplay);
  document.addEventListener("mflt-settings-closed", resume);

  queueMicrotask(show);
  return {
    show,
    replay,
    destroy() {
      removeKeyListener();
      document.removeEventListener("mflt-show-onboarding", onReplay);
      document.removeEventListener("mflt-settings-closed", resume);
      settingsObserver?.disconnect();
      pickerObserver?.disconnect();
      overlay?.remove();
      overlay = null;
      resumeStep = null;
    },
  };
}
