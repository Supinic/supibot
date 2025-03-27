const REGEXES = {
	V1: /^\d+$/,
	V2: /emotesv2_[a-z0-9]{32}/,
	CDN: /emoticons\/v[12]\/([\w\d]*)\//
};

export default {
	Name: "whatemoteisit",
	Aliases: ["weit"],
	Author: "supinic",
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
		if (messageData?.emotes) {
			input = messageData.emotes.split(":")[0];
		}

		const isEmoteID = (REGEXES.V1.test(input) || REGEXES.V2.test(input) || REGEXES.CDN.test(input));

		let inputEmoteIdentifier;
		if (isEmoteID) {
			// Ordering is important here, go from the most → the least specific regex
			if (REGEXES.CDN.test(input)) {
				inputEmoteIdentifier = input.match(REGEXES.CDN)[1];
			}
			else if (REGEXES.V2.test(input)) {
				inputEmoteIdentifier = input.match(REGEXES.V2)[0];
			}
			else if (REGEXES.V1.test(input)) {
				inputEmoteIdentifier = input.match(REGEXES.V1)[0];
			}
		}
		else {
			inputEmoteIdentifier = args[0];
		}

		const response = await sb.Got.get("IVR")({
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
		else if (response.statusCode !== 200) {
			return {
				success: false,
				reply: response.body.error.message
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
			if (!channelName && !channelLogin) {
				const tier = (emoteTier) ? `tier ${emoteTier}` : "";
				return {
					reply: `${emoteCode} (ID ${emoteID}) - ${active} ${tier} emote to an unknown banned/deleted channel. ${cdnLink} ${originString}`
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

		if (context.params.noLinks) {
			return {
				reply: `${emoteCode} - ID ${emoteID} - ${active} ${tierString}.`
			};
		}
		else {
			const emoteLink = `https://emotes.awoo.nl/twitch/emote/${emoteID}`;
			return {
				reply: `${emoteCode} - ID ${emoteID} - ${active} ${tierString}. ${emoteLink} ${cdnLink} ${originString}`
			};
		}
	}),
	Dynamic_Description: null
};
