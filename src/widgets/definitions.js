import { basicDefinitions } from "./basic-definitions.js";
import { networkDefinitions } from "./network-definitions.js";
import { searchDefinition } from "./search-definition.js";
import { restDefinition } from "./rest-definition.js";
import { planningDefinitions } from "./planning-definitions.js";

export const widgetDefinitions = [...basicDefinitions, ...planningDefinitions, ...networkDefinitions, searchDefinition, restDefinition];
