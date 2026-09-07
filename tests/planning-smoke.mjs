import assert from "node:assert/strict";
import { planningDefinitions } from "../src/widgets/planning-definitions.js";

const definitions = new Map(planningDefinitions.map((definition) => [definition.type, definition]));
assert.ok(definitions.has("bookmarks"));
assert.equal(definitions.get("bookmarks").defaultConfig.showDomain, true);
assert.equal(definitions.get("bookmarks").defaultConfig.links.length, 0);
console.log("planning-smoke: passed");
