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
	Static_Data: null,
	Code: (async function origin (context, emote) {
		if (!emote) {
			return {
				reply: "Check the emote origin list here: https://supinic.com/data/origin/list"
			};
		}

		const contextEmote = await context.getBestAvailableEmote([emote], null, { returnEmoteObject: true });
		const emoteData = await sb.Query.getRecordset(rs => rs
			.select("ID", "Emote_ID", "Text", "Tier", "Type", "Todo", "Emote_Added", "Author")
			.from("data", "Origin")
			.where("Name COLLATE utf8mb4_bin LIKE %s", emote)
			.where("Replaced = %b", false)
		);

		const customIndex = context.params.index ?? null;
		if (emoteData.length === 0) {
			return {
				success: false,
				reply: "No definition found for given emote!"
			};
		}

		// Attempt to use the emote available in current channel (context) first, if no index is provided
		const implicitEmote = emoteData.find(i => i.Emote_ID === contextEmote.id);
		if (emoteData.length > 1 && customIndex === null && !implicitEmote) {
			return {
				reply: `Multiple emotes found for this name! Use "index:0" through "index:${emoteData.length - 1}" to access each one.`,
				cooldown: { length: 2500 }
			};
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