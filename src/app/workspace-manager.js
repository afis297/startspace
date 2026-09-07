import { callExtensionApi, getExtensionApi } from "../services/extension-api.js";

const STORAGE_KEY = "workspaceLayoutsV1";
const MAX_WORKSPACES = 9;
const MAX_NAME_LENGTH = 36;

const clone = (value) => typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

const makeId = () => globalThis.crypto?.randomUUID?.()
  || `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function normalizeName(value, fallback) {
  const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return name || fallback;
}

function storage() {
  return getExtensionApi()?.storage?.local || null;
}

async function readWorkspaces() {
  const area = storage();
  if (area) return (await callExtensionApi(area.get, area, [{ [STORAGE_KEY]: null }]))[STORAGE_KEY];
  try {
    return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

async function writeWorkspaces(value) {
  const area = storage();
  if (area) return callExtensionApi(area.set, area, [{ [STORAGE_KEY]: value }]);
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
}

function normalizeEntry(entry, index, fallbackState) {
  return {
    id: String(entry?.id || makeId()),
    name: normalizeName(entry?.name, `Рабочий стол ${index + 1}`),
    createdAt: Number(entry?.createdAt) || Date.now(),
    updatedAt: Number(entry?.updatedAt) || Date.now(),
    state: clone(entry?.state || fallbackState),
  };
}

function normalizeCollection(value, fallbackState) {
  const layouts = Array.isArray(value?.layouts)
    ? value.layouts.slice(0, MAX_WORKSPACES).map((entry, index) => normalizeEntry(entry, index, fallbackState))
    : [];
  const safeLayouts = layouts.length ? layouts : [normalizeEntry(null, 0, fallbackState)];
  const requestedIndex = Number(value?.activeIndex);
  return {
    version: 1,
    activeIndex: Number.isInteger(requestedIndex)
      ? Math.min(Math.max(requestedIndex, 0), safeLayouts.length - 1)
      : 0,
    layouts: safeLayouts,
  };
}

export function createWorkspaceManager(store, { delay = 300 } = {}) {
  let collection = null;
  let timer = null;
  let writeChain = Promise.resolve();
  let destroyed = false;
  const listeners = new Set();

  const getSnapshot = () => {
    const source = collection || normalizeCollection(null, store.getState());
    return clone({
      activeIndex: source.activeIndex,
      layouts: source.layouts.map(({ state, ...entry }) => entry),
    });
  };

  const emit = () => {
    const snapshot = getSnapshot();
    listeners.forEach((listener) => listener(snapshot));
  };

  const saveActiveState = () => {
    const active = collection?.layouts[collection.activeIndex];
    if (!active) return;
    active.state = store.getState();
    active.updatedAt = Date.now();
  };

  const persist = () => {
    if (destroyed || !collection) return Promise.resolve();
    clearTimeout(timer);
    const payload = clone(collection);
    writeChain = writeChain.catch(() => undefined).then(() => writeWorkspaces(payload));
    return writeChain;
  };

  const schedulePersist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      saveActiveState();
      persist();
    }, delay);
  };

  const ready = readWorkspaces()
    .catch(() => null)
    .then((saved) => {
      if (destroyed) return getSnapshot();
      collection = normalizeCollection(saved, store.getState());
      if (!saved) persist();
      emit();
      return getSnapshot();
    });

  const switchTo = async (index) => {
    await ready;
    const nextIndex = Number(index);
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= collection.layouts.length) return false;
    if (nextIndex === collection.activeIndex) return true;

    saveActiveState();
    collection.activeIndex = nextIndex;
    const target = clone(collection.layouts[nextIndex].state);
    persist();
    store.replaceState(target, "workspace-switch");
    emit();
    return true;
  };

  const create = async (name) => {
    await ready;
    if (collection.layouts.length >= MAX_WORKSPACES) {
      throw new Error(`Можно создать не более ${MAX_WORKSPACES} рабочих пространств.`);
    }

    saveActiveState();
    const state = store.getState();
    const entry = normalizeEntry({
      id: makeId(),
      name: normalizeName(name, `Рабочий стол ${collection.layouts.length + 1}`),
      state: { ...state, widgets: [] },
    }, collection.layouts.length, state);
    collection.layouts.push(entry);
    collection.activeIndex = collection.layouts.length - 1;
    persist();
    store.replaceState(clone(entry.state), "workspace-create");
    emit();
    return getSnapshot();
  };

  const rename = async (index, name) => {
    await ready;
    const target = collection.layouts[index];
    if (!target) return false;
    target.name = normalizeName(name, target.name);
    target.updatedAt = Date.now();
    persist();
    emit();
    return true;
  };

  const remove = async (index) => {
    await ready;
    if (collection.layouts.length <= 1) {
      throw new Error("Нельзя удалить единственное рабочее пространство.");
    }
    if (!collection.layouts[index]) return false;

    saveActiveState();
    const removedActive = index === collection.activeIndex;
    collection.layouts.splice(index, 1);
    if (index < collection.activeIndex) collection.activeIndex -= 1;
    if (collection.activeIndex >= collection.layouts.length) {
      collection.activeIndex = collection.layouts.length - 1;
    }

    persist();
    if (removedActive) {
      store.replaceState(clone(collection.layouts[collection.activeIndex].state), "workspace-remove");
    }
    emit();
    return true;
  };

  const unsubscribeStore = store.subscribe((_state, event) => {
    if (event?.type !== "widget-focus") schedulePersist();
  });

  return {
    ready,
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    switchTo,
    create,
    rename,
    remove,
    async flush() {
      await ready;
      clearTimeout(timer);
      saveActiveState();
      await persist();
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      unsubscribeStore();
      listeners.clear();
    },
  };
}
