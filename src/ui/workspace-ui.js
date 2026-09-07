import { WORKSPACE_TEMPLATES } from "../app/workspace-templates.js";
import { clear, element } from "./dom.js";

function makeButton(text, className, title) {
  return element("button", { className, text, title, attrs: { type: "button" } });
}

function makeTemplateSelect() {
  const select = element("select", { className: "workspace-template-select", attrs: { "aria-label": "Шаблон рабочего пространства" } });
  WORKSPACE_TEMPLATES.forEach((template) => {
    select.append(element("option", { value: template.id, text: `${template.title} — ${template.description}` }));
  });
  return select;
}

function makeCreateForm(defaultName, extraClass, onSubmit, onCancel) {
  const form = document.createElement("form");
  form.className = extraClass ? `workspace-create-form ${extraClass}` : "workspace-create-form";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 36;
  input.value = defaultName;
  input.setAttribute("aria-label", "Название нового рабочего пространства");
  const template = makeTemplateSelect();
  const submit = makeButton("Создать", "primary-action workspace-create-submit");
  submit.type = "submit";
  const cancel = makeButton("Отмена", "text-action workspace-create-cancel");
  cancel.addEventListener("click", onCancel);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(input.value, template.value);
  });
  const actions = document.createElement("div");
  actions.className = "workspace-create-actions";
  actions.append(submit, cancel);
  form.append(input, template, actions);
  queueMicrotask(() => { input.focus(); input.select(); });
  return form;
}

function run(action, notify) {
  return Promise.resolve().then(action).catch((error) => {
    const message = error instanceof Error ? error.message : "Не удалось обновить рабочие пространства.";
    if (notify) notify({ type: "error", title: "Рабочие пространства", message });
    else console.error(message, error);
  });
}

export function mountWorkspaceSwitcher({ root, manager, notify, onCreateTemplate }) {
  const container = document.createElement("div");
  container.className = "workspace-switcher";
  const trigger = makeButton("", "workspace-switcher-trigger", "Рабочие пространства");
  trigger.setAttribute("aria-haspopup", "menu");
  const menu = document.createElement("div");
  menu.className = "workspace-switcher-menu";
  menu.id = "workspace-switcher-menu";
  menu.setAttribute("role", "menu");
  trigger.setAttribute("aria-controls", menu.id);
  container.append(trigger, menu);
  root.append(container);
  let isOpen = false;
  let isCreating = false;
  const createWorkspace = (name, templateId) => onCreateTemplate
    ? onCreateTemplate(name, templateId)
    : manager.create(name);
  const setOpen = (next) => {
    isOpen = Boolean(next);
    if (!isOpen) isCreating = false;
    container.classList.toggle("is-open", isOpen);
    trigger.setAttribute("aria-expanded", String(isOpen));
  };
  const render = (snapshot = manager.getSnapshot()) => {
    const active = snapshot.layouts[snapshot.activeIndex];
    trigger.textContent = active?.name || "Рабочий стол";
    clear(menu);
    snapshot.layouts.forEach((workspace, index) => {
      const option = makeButton("", "workspace-switcher-option", `${workspace.name} — Alt+${index + 1}`);
      option.setAttribute("role", "menuitem");
      option.classList.toggle("is-active", index === snapshot.activeIndex);
      const name = document.createElement("span");
      name.className = "workspace-switcher-option-name";
      name.textContent = workspace.name;
      const shortcut = document.createElement("kbd");
      shortcut.textContent = `Alt+${index + 1}`;
      option.append(name, shortcut);
      option.addEventListener("click", () => run(async () => { await manager.switchTo(index); setOpen(false); }, notify));
      menu.append(option);
    });
    if (snapshot.layouts.length < 9) {
      const create = makeButton("+ Новое пространство", "workspace-switcher-create", "Создать рабочее пространство");
      create.addEventListener("click", () => {
        isCreating = true;
        setOpen(true);
        render(snapshot);
      });
      menu.append(create);
    }
    if (isCreating) {
      menu.append(makeCreateForm(`Рабочий стол ${snapshot.layouts.length + 1}`, "", (name, templateId) => {
        run(async () => {
          await createWorkspace(name, templateId);
          isCreating = false;
          setOpen(true);
          render();
        }, notify);
      }, () => { isCreating = false; render(snapshot); }));
    }
  };
  const outside = (event) => { if (!container.contains(event.target)) setOpen(false); };
  trigger.addEventListener("click", () => setOpen(!isOpen));
  document.addEventListener("pointerdown", outside);
  const unsubscribe = manager.subscribe(render);
  manager.ready.then(() => render());
  return { destroy() { unsubscribe(); document.removeEventListener("pointerdown", outside); container.remove(); } };
}

export function mountWorkspaceSettings({ root, manager, notify, onCreateTemplate }) {
  const section = document.createElement("section");
  section.className = "settings-section workspace-settings";
  let isCreating = false;
  const createWorkspace = (name, templateId) => onCreateTemplate
    ? onCreateTemplate(name, templateId)
    : manager.create(name);
  const attach = () => { if (root.dataset.settingsTab === "desktop") { if (section.parentElement !== root) root.append(section); } else { section.remove(); } };
  const render = (snapshot = manager.getSnapshot()) => {
    clear(section);
    const title = document.createElement("h3");
    title.textContent = "Рабочие пространства";
    const description = document.createElement("p");
    description.className = "workspace-settings-description";
    description.textContent = "У каждого пространства своя раскладка. Переключение: Alt+1…Alt+9.";
    const list = document.createElement("div");
    list.className = "workspace-settings-list";
    snapshot.layouts.forEach((workspace, index) => {
      const field = document.createElement("div");
      field.className = "property-field workspace-settings-row";
      field.classList.toggle("is-active", index === snapshot.activeIndex);
      const label = document.createElement("span");
      label.textContent = workspace.name;
      const actions = document.createElement("div");
      actions.className = "button-row workspace-settings-actions";
      const select = makeButton(index === snapshot.activeIndex ? "Текущее" : "Открыть", "text-action workspace-settings-select", `Alt+${index + 1}`);
      select.addEventListener("click", () => run(() => manager.switchTo(index), notify));
      const rename = makeButton("Переименовать", "text-action workspace-settings-action");
      rename.addEventListener("click", () => {
        const nextName = window.prompt("Название рабочего пространства", workspace.name);
        if (nextName !== null) run(() => manager.rename(index, nextName), notify);
      });
      const remove = makeButton("Удалить", "text-action workspace-settings-action is-danger");
      remove.disabled = snapshot.layouts.length === 1;
      remove.addEventListener("click", () => {
        if (window.confirm(`Удалить рабочее пространство «${workspace.name}»?`)) run(() => manager.remove(index), notify);
      });
      actions.append(select, rename, remove);
      field.append(label, actions);
      list.append(field);
    });
    const addRow = document.createElement("div");
    addRow.className = "button-row workspace-settings-add";
    const add = makeButton("Новое рабочее пространство", "primary-action");
    add.disabled = snapshot.layouts.length >= 9;
    add.addEventListener("click", () => { isCreating = true; render(snapshot); });
    addRow.append(add);
    if (isCreating) {
      addRow.append(makeCreateForm(`Рабочий стол ${snapshot.layouts.length + 1}`, "workspace-create-form-settings", (name, templateId) => {
        run(async () => {
          await createWorkspace(name, templateId);
          isCreating = false;
          render();
        }, notify);
      }, () => { isCreating = false; render(snapshot); }));
    }
    section.append(title, description, list, addRow);
    attach();
  };
  const observer = new MutationObserver(attach);
  observer.observe(root, { childList: true });
  const unsubscribe = manager.subscribe(render);
  manager.ready.then(() => render());
  attach();
  return { destroy() { unsubscribe(); observer.disconnect(); section.remove(); } };
}

