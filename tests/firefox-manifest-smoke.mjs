import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const [chromeManifest, firefoxManifest, firefoxBackground] = await Promise.all([
  readJson("manifest.json"),
  readJson("manifest.firefox.json"),
  readFile(new URL("src/app/background-firefox.html", root), "utf8"),
]);

assert.equal(chromeManifest.manifest_version, 3, "Chrome manifest должен оставаться MV3");
assert.equal(chromeManifest.background?.service_worker, "src/app/background.js", "Chrome должен использовать существующий service worker");
assert.ok(chromeManifest.permissions.includes("system.cpu"), "Chrome-сборка должна сохранять доступ к системным метрикам");

assert.equal(firefoxManifest.manifest_version, 3, "Firefox manifest должен быть MV3");
assert.equal(firefoxManifest.browser_specific_settings?.gecko?.id, "startspace@local", "Firefox-сборке нужен стабильный Gecko ID");
assert.equal(firefoxManifest.background?.page, "src/app/background-firefox.html", "Firefox должен использовать модульную background page");
assert.equal(firefoxManifest.chrome_url_overrides?.newtab, chromeManifest.chrome_url_overrides?.newtab, "обе сборки должны использовать одинаковую новую вкладку");
assert.deepEqual(firefoxManifest.content_scripts, chromeManifest.content_scripts, "панель на сайтах должна иметь одинаковый content script");
assert.deepEqual(firefoxManifest.web_accessible_resources, chromeManifest.web_accessible_resources, "обе сборки должны публиковать одинаковые аудиоресурсы");
for (const permission of ["system.cpu", "system.memory", "system.storage"]) {
  assert.ok(!firefoxManifest.permissions.includes(permission), `Firefox manifest не должен запрашивать Chromium API ${permission}`);
}
assert.match(firefoxBackground, /<script type="module" src="\.\/background\.js"><\/script>/, "Firefox background page должна подключать общую модульную логику");

console.log("firefox-manifest-smoke: passed");
