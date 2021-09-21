module.exports = {
	Name: "whatemoteisit",
	Aliases: ["weit"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "What emote is it? Posts specifics about a given Twitch subscriber emote.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		regexV1: /^\d+$/,
		regexV2: /^emotesv2_[a-z0-9]{32}$/
	})),
	Code: (async function whatEmoteIsIt (context, input) {
		if (!input) {
			return {
				success: false,
				reply: `No emote name or ID provided!`
			};
		}

		if (context.platform.Name === "twitch" && context.append.emotes) {
			input = context.append.emotes.split(":")[0];
		}

		const { regexV1, regexV2 } = this.staticData;
		const isEmoteID = (regexV1.test(input) || regexV2.test(input));

		const response = await sb.Got("Leppunen", {
			url: `v2/twitch/emotes/${input}`,
			searchParams: (isEmoteID) ? { id: "true" } : {},
			throwHttpErrors: false
		});

		if (response.statusCode >= 500) {
			const { error } = response.body;
			await sb.Platform.get("twitch").pm(
				`twitch/emotes API failed for "${input}" - server error ${response.statusCode}: ${error ?? "(unknown)"}`,
				"leppunen"
			);

			return {
				success: false,
				reply: `API failed with error ${response.statusCode}: ${error}!`
			};
		}
		else if (response.statusCode !== 200) {
			return {
				success: false,
				reply: response.body.error
			};
		}

		const {
			channelName,
			channelLogin,
			channelID,
			emoteAssetType,
			emoteCode,
			emoteID,
			emoteState,
			emoteTier,
			emoteType
		} = response.body;

		const originID = await sb.Query.getRecordset(rs => rs
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

		let tierString = "";
		if (emoteType === "SUBSCRIPTIONS") {
			if (!channelName && !channelLogin && !emoteTier) {
				return {
					reply: `${emoteCode} (ID ${emoteID}) - ${active} emote to an unknown banned/deleted channel. ${cdnLink} ${originString}`
				};
			}
			else if (channelName !== null) {
				let channelString = `@${channelName}`;
				if (channelName.toLowerCase() !== channelLogin.toLowerCase()) {
					channelString = `@${channelLogin} (${channelName})`;
				}

				tierString = `tier ${emoteTier} ${emoteAssetType.toLowerCase()} sub emote to channel ${channelString}`;
			}
		}
		else if (emoteType === "GLOBALS") {
			tierString = "global Twitch emote";
		}
		else {
			tierString = `${emoteAssetType?.toLowerCase() ?? ""} ${emoteType?.toLowerCase() ?? ""} ${channelName ?? ""} emote`;
		}

		let emoteLink;
		if (channelName) {
			emoteLink = `https://twitchemotes.com/channels/${channelID}/emotes/${emoteID}`;
		}
		else {
			emoteLink = `https://twitchemotes.com/global/emotes/${emoteID}`;
		}

		return {
			reply: `${emoteCode} (ID ${emoteID}) - ${active} ${tierString}. ${emoteLink} ${cdnLink} ${originString}`
		};
	}),
	Dynamic_Description: null
};
