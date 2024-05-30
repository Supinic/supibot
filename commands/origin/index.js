const createRelay = async (IDs) => await sb.Got("Supinic", {
	method: "POST",
	url: "relay",
	throwHttpErrors: false,
	json: {
		url: `/data/origin/lookup?${IDs}`
	}
});

module.exports = {
	Name: "origin",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the origin of a given emote.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "index", type: "number" }
	],
	Whitelist_Response: null,
	Code: (async function origin (context, emote) {
		if (!emote) {
			return {
				reply: "Check the emote origin list here: https://supinic.com/data/origin/list"
			};
		}

		const contextEmote = await context.getBestAvailableEmote([emote], null, { returnEmoteObject: true });
		const contextEmoteID = (contextEmote?.id) ? String(contextEmote.id) : "";
		let emoteData = await sb.Query.getRecordset(rs => rs
			.select("ID", "Emote_ID", "Text", "Tier", "Type", "Todo", "Emote_Added", "Emote_Deleted", "Author")
			.from("data", "Origin")
			.where("Name COLLATE utf8mb4_bin LIKE %s", emote)
			.where("Replaced = %b", false)
			.orderBy(`CASE WHEN Emote_ID = '${sb.Query.escapeString(contextEmoteID)}' THEN -1 ELSE 1 END`)
		);

		const customIndex = context.params.index ?? null;
		if (emoteData.length === 0) {
			if (emote.length < 4) {
				return {
					success: false,
					reply: "No definitions found for given query!"
				};
			}

			const fallbackEmoteData = await sb.Query.getRecordset(rs => rs
				.select("ID", "Emote_ID", "Text", "Tier", "Type", "Todo", "Emote_Added", "Author")
				.from("data", "Origin")
				.where("Name COLLATE utf8mb4_bin %*like*", emote)
			);

			if (fallbackEmoteData.length === 0) {
				return {
					success: false,
					reply: "No definitions found for given query!"
				};
			}
			else if (fallbackEmoteData.length === 1) {
				// if there is exactly one emote found with the fallback query, continue on with the code in
				// the branch below, basically pretending that that emote name was the input.
				emoteData = fallbackEmoteData;
			}
			else {
				const IDs = fallbackEmoteData.map(i => `ID=${i.ID}`).join("&");
				const response = await createRelay(IDs);

				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: "Could not create a relay link for found definitions! Try again later."
					};
				}
				else {
					return {
						reply: `Found ${fallbackEmoteData.length} definitions for your query, check them out here: ${response.body.data.link}`
					};
				}
			}
		}

		// Attempt to use the emote available in current channel (context) first, if no index is provided
		const implicitEmote = emoteData.find(i => i.Emote_ID === contextEmoteID);
		if (emoteData.length > 1 && customIndex === null && !implicitEmote) {
			const IDs = emoteData.map(i => `ID=${i.ID}`).join("&");
			const response = await createRelay(IDs);

			if (response.statusCode !== 200) {
				return {
					reply: `Multiple emotes found! Use "index:0" through "index:${IDs.length - 1}" to access each one.`,
					cooldown: { length: 2500 }
				};
			}
			else {
				return {
					reply: `Multiple emotes found! Check the list here: ${response.body.data.link} or use "index:0" through "index:${emoteData.length - 1}" to access them.`,
					cooldown: { length: 2500 }
				};
			}
		}

		const data = (emoteData.length > 1 && customIndex === null)
			? implicitEmote
			: emoteData[customIndex ?? 0];

		if (!data) {
			return {
				success: false,
				reply: "No emote definition exists for this index!"
			};
		}

		let extras = "";
		if (emoteData.length > 1 && customIndex === null) {
			extras = `(${emoteData.length - 1} extras) `;
		}

		let authorString = "";
		if (data.Author) {
			const authorUserData = await sb.User.get(data.Author);
			authorString = `Made by @${authorUserData.Name}.`;
		}

		let addedString = "";
		if (data.Emote_Added) {
			addedString = `Added on ${data.Emote_Added.format("Y-m-d")}.`;
		}

		let deletedString = "";
		if (data.Emote_Deleted) {
			deletedString = `Removed on ${data.Emote_Deleted.format("Y-m-d")}.`;
		}

		const text = data.Text.replace(/\[(.+?)]\(\d+\)/g, "$1");
		const link = `https://supinic.com/data/origin/detail/${data.ID}`;

		let type = "";
		const [provider, providerType = ""] = data.Type.split(" - ");
		if (data.Type === "Twitch - Bits" && data.Tier !== null) {
			const thousandBits = Number(data.Tier) / 1000;
			type = `${thousandBits}k bits ${provider}`;
		}
		else if (data.Tier) {
			type = `T${data.Tier} ${providerType.toLowerCase()} ${provider}`;
		}
		else {
			type = `${providerType.toLowerCase()} ${provider}`;
		}

		return {
			reply: sb.Utils.tag.trim `
				${extras}
				${link}					
				${type} emote:
				${text}
				${addedString}
				${deletedString}
				${authorString}
			`
		};
	}),
	Dynamic_Description: null
};
