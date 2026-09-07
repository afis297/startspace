import assert from "node:assert/strict";
import { callExtensionApi, getExtensionApi } from "../src/services/extension-api.js";

const chromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");
const browserDescriptor = Object.getOwnPropertyDescriptor(globalThis, "browser");

function restoreGlobal(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

try {
  let lastError = null;
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: { runtime: { get lastError() { return lastError; } } },
  });
  delete globalThis.browser;

  const callbackReceiver = { factor: 3 };
  const callbackMethod = function callbackMethod(value, callback) {
    setTimeout(() => callback(value * this.factor), 0);
  };
  assert.equal(await callExtensionApi(callbackMethod, callbackReceiver, [4]), 12, "callback API должен сохранять receiver и результат");

  const promiseReceiver = { offset: 5 };
  const promiseMethod = function promiseMethod(value) {
    return Promise.resolve(value + this.offset);
  };
  assert.equal(await callExtensionApi(promiseMethod, promiseReceiver, [7]), 12, "Promise API должен поддерживаться без имени браузера");

  const errorMethod = (callback) => {
    lastError = { message: "Тестовая ошибка API" };
    callback();
    lastError = null;
  };
  await assert.rejects(() => callExtensionApi(errorMethod, null), /Тестовая ошибка API/, "runtime.lastError должен превращаться в отклонённый Promise");
  await assert.rejects(() => callExtensionApi(null, null), /не поддерживает/, "отсутствующий метод должен давать понятную ошибку");

  Object.defineProperty(globalThis, "browser", { configurable: true, value: { runtime: {} } });
  assert.equal(getExtensionApi(), globalThis.browser, "browser должен иметь приоритет, когда Firefox предоставляет оба namespace");

  delete globalThis.browser;
  assert.equal(getExtensionApi(), globalThis.chrome, "chrome должен оставаться fallback в Chromium");
} finally {
  restoreGlobal("chrome", chromeDescriptor);
  restoreGlobal("browser", browserDescriptor);
}

console.log("extension-api-smoke: passed");
