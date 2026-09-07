import assert from "node:assert/strict";
import {
  assertUrlPermission,
  getWidgetPermissionOrigins,
  requestWidgetPermissions,
} from "../src/services/permissions.js";

const chromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");
let granted = false;
const requests = [];
Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    permissions: {
      async contains({ origins }) {
        return granted && origins.every((origin) => requests.flat().includes(origin));
      },
      async request({ origins }) {
        requests.push(origins);
        granted = true;
        return true;
      },
    },
  },
});

try {
  assert.deepEqual(getWidgetPermissionOrigins("weather"), [
    "https://api.open-meteo.com/*",
    "https://geocoding-api.open-meteo.com/*",
  ]);
  assert.deepEqual(getWidgetPermissionOrigins("clock"), []);
  assert.equal(await requestWidgetPermissions("clock"), true);
  assert.equal(await requestWidgetPermissions("weather"), true);
  assert.equal(requests.length, 1);
  await assert.doesNotReject(() => assertUrlPermission("https://api.open-meteo.com/v1/forecast"));
  granted = false;
  await assert.rejects(() => assertUrlPermission("https://api.mymemory.translated.net/get"), /Доступ к внешнему сервису/);
  await assert.doesNotReject(() => assertUrlPermission("https://example.com/data"));
} finally {
  if (chromeDescriptor) Object.defineProperty(globalThis, "chrome", chromeDescriptor);
  else delete globalThis.chrome;
}

console.log("permissions-smoke: passed");
