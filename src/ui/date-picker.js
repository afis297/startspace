import { clear, element } from "./dom.js";
import { createLineIcon } from "./icons.js";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatManualValue(value) {
  const date = parseDateKey(value);
  return date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : "";
}

function normalizeManualTyping(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function parseManualValue(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return parseDateKey(`${year}-${month}-${day}`);
}

export function createDatePicker({ value = "", onChange, ariaLabel = "Дата задачи", className = "" } = {}) {
  let selectedValue = parseDateKey(value) ? value : "";
  let displayedMonth = monthStart(parseDateKey(selectedValue) || new Date());
  let open = false;

  const root = element("div", { className: `date-picker ${className}`.trim(), dataset: { value: selectedValue } });
  const trigger = element("div", { className: "date-picker-trigger", attrs: { role: "group", "aria-label": ariaLabel } });
  const input = element("input", { className: "date-picker-trigger-input", value: formatManualValue(selectedValue), attrs: { type: "text", inputmode: "numeric", autocomplete: "off", placeholder: "ДД.ММ.ГГГГ", maxlength: "10", "aria-label": ariaLabel } });
  const marker = element("button", { className: "date-picker-trigger-marker", attrs: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": "Открыть календарь" } }, [createLineIcon("calendar", { size: 14 })]);
  trigger.append(input, marker);

  const previous = element("button", { className: "date-picker-nav", attrs: { type: "button", "aria-label": "Предыдущий месяц" } }, [createLineIcon("chevronLeft", { size: 15 })]);
  const next = element("button", { className: "date-picker-nav", attrs: { type: "button", "aria-label": "Следующий месяц" } }, [createLineIcon("chevronRight", { size: 15 })]);
  const monthLabel = element("strong", { className: "date-picker-month" });
  const days = element("div", { className: "date-picker-days", attrs: { role: "grid", "aria-label": "Дни месяца" } });
  const popover = element("div", { className: "date-picker-popover", attrs: { role: "dialog", "aria-label": ariaLabel, "aria-hidden": "true" } }, [
    element("div", { className: "date-picker-heading" }, [previous, monthLabel, next]),
    element("div", { className: "date-picker-weekdays", attrs: { "aria-hidden": "true" } }, weekdays.map((day) => element("span", { text: day }))),
    days,
  ]);
  const clearButton = element("button", { className: "text-action date-picker-clear", text: "Без даты", attrs: { type: "button" } });
  const todayButton = element("button", { className: "text-action date-picker-today", text: "Сегодня", attrs: { type: "button" } });
  popover.append(element("div", { className: "date-picker-actions" }, [clearButton, todayButton]));

  const placePopover = () => {
    const rect = root.getBoundingClientRect();
    const width = Math.max(248, Math.min(296, Math.max(rect.width, 248)));
    const estimatedHeight = 312;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    const top = window.innerHeight - rect.bottom < estimatedHeight + 8 && rect.top > estimatedHeight
      ? Math.max(8, rect.top - estimatedHeight - 6)
      : Math.min(window.innerHeight - estimatedHeight - 8, rect.bottom + 6);
    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${Math.max(8, top)}px`;
  };
  const onDocumentPointerDown = (event) => { if (!root.contains(event.target) && !popover.contains(event.target)) close(); };
  const renderValue = () => {
    root.dataset.value = selectedValue;
    if (document.activeElement !== input) input.value = formatManualValue(selectedValue);
    trigger.classList.toggle("has-value", Boolean(selectedValue));
  };
  const renderMonth = () => {
    clear(days);
    monthLabel.textContent = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(displayedMonth);
    const firstWeekday = (displayedMonth.getDay() + 6) % 7;
    const lastDay = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
    const today = toDateKey(new Date());
    for (let index = 0; index < 42; index += 1) {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > lastDay) {
        days.append(element("span", { className: "date-picker-day is-empty", attrs: { "aria-hidden": "true" } }));
        continue;
      }
      const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
      const key = toDateKey(date);
      const button = element("button", { className: `date-picker-day${key === selectedValue ? " is-selected" : ""}${key === today ? " is-today" : ""}`, text: String(day), attrs: { type: "button", role: "gridcell", "aria-label": new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date), "aria-selected": String(key === selectedValue), "data-value": key } });
      button.addEventListener("click", () => setValue(key, { notify: true, closeAfter: true }));
      days.append(button);
    }
  };
  const close = () => {
    if (!open) return;
    open = false;
    root.classList.remove("is-open");
    popover.classList.remove("is-open");
    popover.setAttribute("aria-hidden", "true");
    marker.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    window.removeEventListener("resize", placePopover);
    root.append(popover);
  };
  const show = () => {
    if (open) return;
    open = true;
    displayedMonth = monthStart(parseDateKey(selectedValue) || new Date());
    renderMonth();
    document.body.append(popover);
    root.classList.add("is-open");
    popover.classList.add("is-open");
    popover.setAttribute("aria-hidden", "false");
    marker.setAttribute("aria-expanded", "true");
    placePopover();
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    window.addEventListener("resize", placePopover);
  };
  const setValue = (nextValue, { notify = false, closeAfter = false } = {}) => {
    selectedValue = parseDateKey(nextValue) ? nextValue : "";
    input.value = formatManualValue(selectedValue);
    renderValue();
    displayedMonth = monthStart(parseDateKey(selectedValue) || displayedMonth);
    renderMonth();
    if (notify) onChange?.(selectedValue);
    if (closeAfter) {
      close();
      input.focus({ preventScroll: true });
    }
  };
  const commitManualValue = () => {
    const date = parseManualValue(input.value);
    input.classList.toggle("is-invalid", Boolean(input.value.trim()) && !date);
    if (!date) return false;
    const key = toDateKey(date);
    selectedValue = key;
    displayedMonth = monthStart(date);
    input.value = formatManualValue(key);
    renderValue();
    renderMonth();
    onChange?.(key);
    return true;
  };

  previous.addEventListener("click", () => { displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1); renderMonth(); });
  next.addEventListener("click", () => { displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1); renderMonth(); });
  clearButton.addEventListener("click", () => setValue("", { notify: true, closeAfter: true }));
  todayButton.addEventListener("click", () => setValue(toDateKey(new Date()), { notify: true, closeAfter: true }));
  marker.addEventListener("click", () => { if (open) close(); else show(); });
  input.addEventListener("input", () => {
    const cursorAtEnd = input.selectionStart === input.value.length;
    input.value = normalizeManualTyping(input.value);
    if (cursorAtEnd) input.setSelectionRange(input.value.length, input.value.length);
    input.classList.remove("is-invalid");
    if (input.value.length === 10) commitManualValue();
  });
  input.addEventListener("change", () => { if (input.value.trim()) commitManualValue(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { close(); input.blur(); return; }
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitManualValue()) close();
      else show();
    }
    if (event.key === "ArrowDown") { event.preventDefault(); show(); days.querySelector(".is-selected, .is-today, .date-picker-day:not(.is-empty)")?.focus(); }
  });
  popover.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); close(); input.focus({ preventScroll: true }); } });

  renderValue();
  renderMonth();
  root.append(trigger, popover);
  return { root, setValue, close };
}
