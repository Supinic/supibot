import { type ContextPlatformSpecificData, declare } from "../../classes/command.js";
import type { MessageData as TwitchMessageData } from "../../platforms/twitch.js";
import { filterNonNullable } from "../../utils/ts-helpers.js";
import type { IvrEmoteData } from "../../utils/globals.js";
import { SupiError } from "supi-core";

const REGEXES = {
	V1: /^\d+$/,
	V2: /emotesv2_[a-z0-9]{32}/,
	CDN: /emoticons\/v[12]\/([\w\d]*)\//
};

const platformHasMessageId = (input: ContextPlatformSpecificData): input is TwitchMessageData => {
	if (!input) {
		return false;
	}
	return Object.hasOwn(input, "fragments");
};

export default declare({
	Name: "whatemoteisit",
	Aliases: ["weit"],
	Cooldown: 10000,
	Description: "What emote is it? Posts specifics about a given Twitch subscriber emote.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" },
		{ name: "noLinks", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function whatEmoteIsIt (context, ...args) {
		let input = args.join(" ");
		if (!input) {
			return {
				success: false,
				reply: `No emote name or ID provided!`
			};
		}

		const messageData = context.platformSpecificData;
		if (platformHasMessageId(messageData)) {
			const { fragments } = messageData;
			const eligibleEmoteFragments = filterNonNullable(fragments.map(i => i.emote));

			const firstEmoteFragment = eligibleEmoteFragments.at(0);
			if (firstEmoteFragment) {
				input = firstEmoteFragment.id;
			}
		}

		const inputEmoteIdentifier = (
			input.match(REGEXES.CDN)?.[1]
			?? input.match(REGEXES.V2)?.[0]
			?? input.match(REGEXES.V1)?.[0]
			?? args[0]
		);

		const isEmoteID = (REGEXES.V1.test(input) || REGEXES.V2.test(input) || REGEXES.CDN.test(input));
		const response = await core.Got.get("IVR")<IvrEmoteData>({
			url: `v2/twitch/emotes/${encodeURIComponent(inputEmoteIdentifier)}`,
			searchParams: {
				id: String(isEmoteID) // literally "true" or "false" based on if the input is an emote ID
			},
			throwHttpErrors: false
		});

		if (response.statusCode === 404 || !response.body.emoteID) {
			return {
				success: false,
				reply: "Emote has not been found!"
			};
		}

		const {
			channelName,
			channelLogin,
			// channelID,
			emoteAssetType,
			emoteCode,
			emoteID,
			emoteState,
			emoteTier,
			emoteType
		} = response.body;

		const originID = await core.Query.getRecordset<number | undefined>(rs => rs
			.select("ID")
			.from("data", "Origin")
			.where("Emote_ID = %s", emoteID)
			.limit(1)
			.single()
			.flat("ID")
		);

		const active = (emoteState === "INACTIVE") ? "inactive" : "";
		const originString = (originID)
			? `This emote has origin info - use the ${sb.Command.prefix}origin command.`
			: "";

		const cdnLink = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteID}/default/dark/3.0`;
		if (context.params.linkOnly) {
			return {
				reply: cdnLink
			};
		}

		let tierString: string;
		if (emoteType === "SUBSCRIPTIONS") {
			if (!channelName && !channelLogin) {
				const tier = (emoteTier) ? `tier ${emoteTier}` : "";
				return {
					reply: `${emoteCode} (ID ${emoteID}) - ${active} ${tier} emote to an unknown banned/deleted channel. ${cdnLink} ${originString}`
				};
			}
			else if (channelName && channelLogin) {
				let channelString = `@${channelName}`;
				if (channelName.toLowerCase() !== channelLogin.toLowerCase()) {
					channelString = `@${channelLogin} (${channelName})`;
				}

				// emoteLink += `channels/${channelID}/emotes/${emoteID}`;
				tierString = `tier ${emoteTier} ${emoteAssetType.toLowerCase()} sub emote to channel ${channelString}`;
			}
			else {
				throw new SupiError({
				    message: "Assert error: Unexpected emote type + data combination",
					args: { data: response.body }
				});
			}
		}
		else if (emoteType === "GLOBALS") {
			tierString = "global Twitch emote";
		}
		else {
			tierString = `${emoteAssetType.toLowerCase()} ${emoteType.toLowerCase()} ${channelName ?? ""} emote`;
		}

		const emoteLink = `https://chatvau.lt/emote/twitch/${emoteID}`;
		if (context.params.noLinks) {
			return {
				reply: `${emoteCode} - ID ${emoteID} - ${active} ${tierString}.`
			};
		}
		else {
			return {
				reply: `${emoteCode} - ID ${emoteID} - ${active} ${tierString}. ${emoteLink} ${cdnLink} ${originString}`
			};
		}
	}),
	Dynamic_Description: null
});
