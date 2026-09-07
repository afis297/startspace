import { getExtensionApi } from "./extension-api.js";

const numeric = (value) => (value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null);
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
const gib = (bytes) => {
  const value = numeric(bytes);
  return value === null ? null : Math.round(value / (1024 ** 3) * 10) / 10;
};

function friendlyError(error) {
  const message = String(error?.message || error || "");
  if (/not supported|не поддерж/i.test(message)) return "Этот браузер не предоставляет системные показатели расширениям.";
  if (/permission|доступ|denied/i.test(message)) return "Браузер не предоставил доступ к системным показателям.";
  return "Не удалось получить показатели ПК. Повторите обновление карточки.";
}

function fallbackSnapshot(previous = null, error = "") {
  return {
    supported: false,
    cpu: null,
    memory: null,
    memoryUsedGiB: null,
    memoryTotalGiB: null,
    cores: Number(navigator?.hardwareConcurrency || 0) || null,
    deviceMemoryGiB: Number(navigator?.deviceMemory || 0) || null,
    disk: null,
    diskUsedGiB: null,
    diskTotalGiB: null,
    source: "Системные API недоступны",
    error: friendlyError(error),
    previousCpu: previous?.previousCpu || null,
  };
}

function requestBackgroundMetrics() {
  const api = getExtensionApi();
  if (!api?.runtime?.connect) return Promise.reject(new Error("Системный канал не поддерживается."));
  return new Promise((resolve, reject) => {
    let port;
    let settled = false;
    let timer = null;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { port?.onMessage?.removeListener?.(onMessage); } catch { /* no-op */ }
      try { port?.onDisconnect?.removeListener?.(onDisconnect); } catch { /* no-op */ }
      try { port?.disconnect?.(); } catch { /* no-op */ }
      handler(value);
    };
    const onMessage = (response) => finish(resolve, response);
    const onDisconnect = () => {
      const error = api?.runtime?.lastError?.message || "Фоновый модуль недоступен.";
      finish(reject, new Error(error));
    };
    try {
      port = api.runtime.connect({ name: "mflt-system-metrics" });
      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(onDisconnect);
      timer = setTimeout(() => finish(reject, new Error("Истекло время ожидания системных показателей.")), 8000);
      port.postMessage({ type: "mflt-system-metrics" });
    } catch (error) {
      finish(reject, error);
    }
  });
}

function cpuPercent(info, previous) {
  const processors = Array.isArray(info?.processors) ? info.processors : [];
  const current = processors.map((processor) => {
    const usage = processor.usage || {};
    const total = Number(usage.total ?? ((Number(usage.user) || 0) + (Number(usage.kernel) || 0) + (Number(usage.idle) || 0)));
    return { total, idle: Number(usage.idle || 0) };
  });
  if (!current.length || !Array.isArray(previous) || previous.length !== current.length) return { percent: null, snapshot: current };
  let busy = 0;
  let total = 0;
  current.forEach((sample, index) => {
    const before = previous[index] || { total: sample.total, idle: sample.idle };
    const deltaTotal = Math.max(0, sample.total - before.total);
    const deltaIdle = Math.max(0, sample.idle - before.idle);
    total += deltaTotal;
    busy += Math.max(0, deltaTotal - deltaIdle);
  });
  return { percent: total > 0 ? clamp(busy / total * 100) : null, snapshot: current };
}

function buildSnapshot(metrics, previous = null) {
  const cpuInfo = metrics?.cpuInfo || {};
  const memoryInfo = metrics?.memoryInfo || {};
  const cpu = cpuPercent(cpuInfo, previous?.previousCpu);
  const capacity = numeric(memoryInfo.capacity) || 0;
  const available = numeric(memoryInfo.availableCapacity) || 0;
  const memoryUsed = Math.max(0, capacity - available);
  const disks = (Array.isArray(metrics?.storageInfo) ? metrics.storageInfo : []).filter((disk) => numeric(disk?.capacity) !== null && numeric(disk.capacity) > 0 && numeric(disk.availableCapacity) !== null);
  const diskCapacity = disks.reduce((sum, disk) => sum + Number(disk.capacity), 0);
  const diskAvailable = disks.reduce((sum, disk) => sum + Number(disk.availableCapacity), 0);
  return {
    supported: true,
    cpu: cpu.percent,
    memory: capacity > 0 ? clamp(memoryUsed / capacity * 100) : null,
    memoryUsedGiB: capacity > 0 ? gib(memoryUsed) : null,
    memoryTotalGiB: capacity > 0 ? gib(capacity) : null,
    cores: Number(cpuInfo?.numOfProcessors || cpuInfo?.processors?.length || 0) || null,
    deviceMemoryGiB: null,
    disk: diskCapacity > 0 ? clamp((diskCapacity - diskAvailable) / diskCapacity * 100) : null,
    diskUsedGiB: diskCapacity > 0 ? gib(diskCapacity - diskAvailable) : null,
    diskTotalGiB: diskCapacity > 0 ? gib(diskCapacity) : null,
    source: "Система ПК",
    error: "",
    previousCpu: cpu.snapshot,
  };
}

export async function getSystemMetrics(previous = null) {
  try {
    const response = await requestBackgroundMetrics();
    if (response?.ok) return buildSnapshot(response.metrics, previous);
    return fallbackSnapshot(previous, response?.error || "Показатели ПК недоступны.");
  } catch (error) {
    return fallbackSnapshot(previous, error);
  }
}
