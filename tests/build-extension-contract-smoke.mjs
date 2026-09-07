import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../build-extension.ps1", import.meta.url), "utf8");

assert.match(script, /\[ValidateSet\('all', 'chrome', 'firefox'\)\]/, "Сборка должна поддерживать общую и целевые конфигурации.");
assert.match(script, /manifest\.firefox\.json/, "Firefox-сборка должна использовать отдельный манифест.");
assert.match(script, /Startspace-\$Name/, "Имя архива должно включать целевой браузер.");
assert.match(script, /\$archiveBase-unsigned\.xpi/, "Firefox-сборка должна выпускать XPI без подписи.");
assert.match(script, /System\.IO\.Compression\.ZipFileExtensions.*CreateEntryFromFile/, "Архивы должны создаваться через управляемый ZIP API.");
assert.match(script, /TrimStart\(\[char\]92\).*?-replace '\\\\', '\/'/, "Пути внутри ZIP должны нормализоваться в прямые слеши.");
assert.match(script, /\$result\.Target[\s\S]*?Archive = \$archive/, "Результат сборки должен явно возвращать путь к готовому архиву.");

console.log("build-extension-contract-smoke: passed");
