export function getExtensionApi() {
  // Firefox exposes the Promise-native browser namespace. Prefer it when both
  // namespaces exist; Chromium keeps using chrome without browser-name checks.
  return globalThis.browser || globalThis.chrome || null;
}

function getLastError() {
  const api = getExtensionApi();
  return api?.runtime?.lastError || null;
}

/**
 * Normalizes WebExtension calls that may use callbacks in one Chromium build
 * and Promises in another. The callback is supplied deliberately: Chrome MV3
 * documents it as the backwards-compatible branch, and modern builds still
 * support it for the API calls used by this extension.
 */
export function callExtensionApi(method, receiver, args = []) {
  if (typeof method !== "function") return Promise.reject(new Error("Этот браузер не поддерживает необходимый API расширения."));
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      handler(value);
    };
    const callback = (result) => {
      const lastError = getLastError();
      if (lastError) {
        settle(reject, new Error(lastError.message || String(lastError)));
        return;
      }
      settle(resolve, result);
    };
    try {
      const returned = method.call(receiver, ...args, callback);
      // Some Chromium builds expose only the Promise branch even if a callback
      // is accepted syntactically. Support both without depending on browser name.
      if (returned && typeof returned.then === "function") returned.then((result) => settle(resolve, result), (error) => settle(reject, error));
    } catch (error) {
      settle(reject, error);
    }
  });
}

export function extensionUrl(path) {
  return getExtensionApi()?.runtime?.getURL?.(path) || path;
}
