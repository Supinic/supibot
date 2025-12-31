import { createRecentUseCacheKey } from "../../twitchlotto/definitions.js";
import type { CheckSubcommandDefinition } from "../index.js";
import type { User } from "../../../classes/user.js";
import { SupiError } from "supi-core";

export const TwitchLottoBlacklistSubcommand = {
	name: "twitchlottoblacklist",
	aliases: ["tlbl"],
	title: "TwitchLotto blacklist info",
	default: false,
	description: ["If the current channel has a TwitchLotto blacklist setup, this will post it."],
	execute: async (context) => {
		if (!context.channel) {
			return {
				success: false,
				reply: `There are no flags to be found here!`
			};
		}

		const flags = await context.channel.getDataProperty("twitchLottoBlacklistedFlags");
		return {
			success: true,
			reply: (!flags || flags.length === 0)
				? `There are currently no blacklisted TL flags in this channel.`
				: `Currently blacklisted flags in this channel: ${flags.join(", ")}`
		};
	}
} satisfies CheckSubcommandDefinition;

export const TwitchLottoDescriptionSubcommand = {
	name: "twitchlottodescription",
	aliases: ["tld"],
	title: "Description of a TwitchLotto link",
	default: false,
	description: ["Checks the posted description of a provided TwitchLotto link, if it exists."],
	execute: async (context, link) => {
		if (!link) {
			return {
				success: false,
				reply: `No image link provided! You must provide a Twitchlotto image link to check its description.`
			};
		}

		if (link.toLowerCase() === "last") {
			const key = createRecentUseCacheKey(context);
			const cacheData = await core.Cache.getByPrefix(key) as string | undefined;
			if (!cacheData) {
				return {
					success: false,
					reply: "You haven't rolled for any images in this channel recently!"
				};
			}
			else {
				link = cacheData;
			}
		}

		const regex = /(https:\/\/)?(www\.)?(imgur\.com\/)?([\d\w]{5,8}\.\w{3})/;
		const match = link.match(regex);
		if (!match) {
			return {
				success: false,
				reply: `Invalid link format!`
			};
		}

		type DescriptionData = { User_Alias: User["ID"]; Text: string; };
		const descriptions = await core.Query.getRecordset<DescriptionData[]>(rs => rs
			.select("User_Alias", "Text")
			.from("data", "Twitch_Lotto_Description")
			.where("Link = %s", match[4])
			.orderBy("Preferred DESC")
		);

		if (descriptions.length === 0) {
			const exists = await core.Query.getRecordset<string | undefined>(rs => rs
				.select("Link")
				.from("data", "Twitch_Lotto")
				.where("Link = %s", match[4])
				.limit(1)
				.flat("Link")
				.single()
			);

			return {
				success: false,
				reply: (exists)
					? `This picture either has not been described so far!`
					: `This picture does not exist in the database!`
			};
		}

		const item = descriptions.at(context.params.index ?? 0);
		if (!item) {
			return {
				success: false,
				reply: `There is no description with this index!`
			};
		}

		const authorData = await sb.User.get(item.User_Alias);
		if (!authorData) {
			throw new SupiError({
			    message: "Assert error: TL description author does not exist"
			});
		}

		return {
			reply: `(Use index:0 to index:${descriptions.length}) Description from ${authorData.Name}: ${item.Text}`
		};
	}
} satisfies CheckSubcommandDefinition;
