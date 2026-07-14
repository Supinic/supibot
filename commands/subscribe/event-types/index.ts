import * as z from "zod";
import { SupiError } from "supi-core";
import type { EventDefinition } from "../generic-event.js";

import BrighterShoresSubDefinition from "./brighter-shores.js";
import ChangelogSubDefinition from "./changelog.js";
import ChannelLiveSubDefinition from "./channel-live.js";
import GlobalTwitchEmotesDefinition from "./global-twitch-emotes.js";
import NodeSubDefinition from "./nodejs.js";
import OsrsSubDefinition from "./osrs.js";
import SuggestionSubDefinition from "./suggestion.js";

import rawRssDefinitions from "./rss-definitions.json" with { type: "json" };

const rssDefinitionSchema = z.object({
	title: z.string(),
	names: z.array(z.string()).min(1),
	url: z.string(),
	channelSpecificMention: z.boolean().optional(),
	cronExpression: z.string().optional(),
	item: z.string().optional(),
	options: z.object({
		ignoredCategories: z.array(z.string().lowercase()).min(1)
	}).optional()
});
const rssJsonSchema = z.array(rssDefinitionSchema);
const rssDefinitions = rssJsonSchema.parse(rawRssDefinitions).map(i => ({
	...i,
	type: "rss" as const
}));

const definitions = [
	BrighterShoresSubDefinition,
	ChangelogSubDefinition,
	ChannelLiveSubDefinition,
	GlobalTwitchEmotesDefinition,
	NodeSubDefinition,
	OsrsSubDefinition,
	SuggestionSubDefinition,
	...rssDefinitions
] satisfies EventDefinition[];

{
	// Validates every definition to have a non-empty, all-lowercase `names` array
	const checkLowercaseNamesSchema = z.array(z.object({
		names: z.array(z.string().lowercase()).min(1)
	}));
	checkLowercaseNamesSchema.parse(definitions);

	const names = new Set();
	const titles = new Set();
	for (const definition of definitions) {
		if (titles.has(definition.title)) {
			throw new SupiError({
				message: `Assert error: Repeated $subscribe title "${definition.title}"`
			});
		}
		titles.add(definition.title);

		for (const name of definition.names) {
			if (names.has(name)) {
				throw new SupiError({
					message: `Assert error: Repeated $subscribe name "${name}"`
				});
			}

			names.add(name);
		}
	}
}

export default definitions;
