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
				success: false,
				reply: "No emote provided!"
			};
		}
	
		const emoteData = await sb.Query.getRecordset(rs => rs
			.select("Text", "Tier", "Type", "Todo", "Approved", "Emote_Added", "Author")
			.from("data", "Origin")
			.where("Name COLLATE utf8mb4_bin LIKE %s", emote)
		);

		const customIndex = context.params.index ?? null;
		if (emoteData.length === 0) {
			return {
				success: false,
				reply: "No definition found for given emote!"
			};
		}
		else if (emoteData.length > 1 && customIndex === null) {
			return {
				reply: `Multiple emotes found for this name! Use "index:0" through "index:${emoteData.length - 1}" to access each one.`,
				cooldown: { length: 2500 }
			};
		}
	
		const data = emoteData[customIndex ?? 0];
		if (!data) {
			return {
				success: false,
				reply: "No emote definition exists for this index!"
			};
		}
		else if (!data.Approved) {
			return {
				success: false,
				reply: "A definition exists, but has not been approved yet!"
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

			const type = (data.Tier) ? `T${data.Tier}` : "";
			return {
				reply: sb.Utils.tag.trim `
					${data.Todo ? "(needs more info)" : ""}
					${type} ${data.Type} emote:
					${data.Text}
					${addedString}
					${authorString}
				`
			};
		}
	}),
	Dynamic_Description: null
};