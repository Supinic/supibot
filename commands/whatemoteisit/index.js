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
		regexV2: /emotesv2_[a-z0-9]{32}/,
		regexCDN: /emoticons\/v[12]\/([\w\d]*)\//
	})),
	Code: (async function whatEmoteIsIt (context, ...args) {
		let input = args.join(" ");
		if (!input) {
			return {
				success: false,
				reply: `No emote name or ID provided!`
			};
		}

		if (context.platform.Name === "twitch" && context.append.emotes) {
			input = context.append.emotes.split(":")[0];
		}

		const { regexCDN, regexV1, regexV2 } = this.staticData;
		const isEmoteID = (regexV1.test(input) || regexV2.test(input) || regexCDN.test(input));

		let inputEmoteIdentifier;
		if (isEmoteID) {
			if (regexCDN.test(input)) {
				inputEmoteIdentifier = input.match(regexCDN)[1];
			}
			else if (regexV2.test(input)) {
				inputEmoteIdentifier = input.match(regexV2)[0];
			}
			else if (regexV1.test(input)) {
				inputEmoteIdentifier = input.match(regexV1)[0];
			}
		}
		else {
			inputEmoteIdentifier = args[0];
		}

		const response = await sb.Got("Leppunen", {
			url: `v2/twitch/emotes/${encodeURIComponent(inputEmoteIdentifier)}`,
			searchParams: {
				id: String(isEmoteID) // literally "true" or "false" based on if the intput is an emote ID
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

		const emoteLink = `https://emotes.raccatta.cc/twitch/emote/${emoteID}`;
		return {
			reply: `${emoteCode} - ID ${emoteID} - ${active} ${tierString}. ${emoteLink} ${cdnLink} ${originString}`
		};
	}),
	Dynamic_Description: null
};
