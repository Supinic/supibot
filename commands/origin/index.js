module.exports = {
	Name: "origin",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the origin of a given emote",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "index", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		createRelay: async (IDs) => await sb.Got("Supinic", {
			method: "POST",
			url: "relay",
			throwHttpErrors: false,
			json: {
				url: `/data/origin/lookup?${IDs}`
			}
		})
	})),
	Code: (async function origin (context, emote) {
		if (!emote) {
			return {
				reply: "Check the emote origin list here: https://supinic.com/data/origin/list"
			};
		}

		const contextEmote = await context.getBestAvailableEmote([emote], null, { returnEmoteObject: true });
		const contextEmoteID = (contextEmote?.id) ? String(contextEmote.id) : "";
		const emoteData = await sb.Query.getRecordset(rs => rs
			.select("ID", "Emote_ID", "Text", "Tier", "Type", "Todo", "Emote_Added", "Author")
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

			const emoteData = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("data", "Origin")
				.where("Name COLLATE utf8mb4_bin %*like*", emote)
			);

			if (emoteData.length === 0) {
				return {
					success: false,
					reply: "No definitions found for given query!"
				};
			}

			const IDs = emoteData.map(i => `ID=${i.ID}`).join("&");
			const response = await this.staticData.createRelay(IDs);

			if (response.statusCode !== 200) {
				return {
					success: false,
					reply: "Could not create a relay link for found definitions! Try again later."
				};
			}
			else {
				return {
					reply: `Found ${emoteData.length} definitions for your query, check them out here: ${response.body.data.link}`
				};
			}
		}

		// Attempt to use the emote available in current channel (context) first, if no index is provided
		const implicitEmote = emoteData.find(i => i.Emote_ID === contextEmoteID);
		if (emoteData.length > 1 && customIndex === null && !implicitEmote) {
			const IDs = emoteData.map(i => `ID=${i.ID}`).join("&");
			const response = await this.staticData.createRelay(IDs);

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
		else {
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

			const text = data.Text.replace(/\[(.+?)]\(\d+\)/g, "$1");
			const link = `https://supinic.com/data/origin/detail/${data.ID}`;
			const type = (data.Tier) ? `T${data.Tier}` : "";

			return {
				reply: sb.Utils.tag.trim `
					${extras}
					${link}					
					${type} ${data.Type} emote:
					${text}
					${addedString}
					${authorString}
				`
			};
		}
	}),
	Dynamic_Description: null
};
