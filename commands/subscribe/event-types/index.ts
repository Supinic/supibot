import * as z from "zod";
import { SupiError } from "supi-core";
import { type EventDefinition, rssEventDefinitionSchema } from "../generic-event.ts";

import BrighterShoresSubDefinition from "./brighter-shores.ts";
import ChangelogSubDefinition from "./changelog.ts";
import ChannelLiveSubDefinition from "./channel-live.ts";
import GlobalTwitchEmotesDefinition from "./global-twitch-emotes.ts";
import NodeSubDefinition from "./nodejs.ts";
import OsrsSubDefinition from "./osrs.ts";
import SuggestionSubDefinition from "./suggestion.ts";
import YoutubeVideoSubDefinition from "./youtube-video.ts";

import rawRssDefinitions from "./rss-definitions.json" with { type: "json" };

const rssJsonSchema = z.array(rssEventDefinitionSchema);
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
	YoutubeVideoSubDefinition,
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
