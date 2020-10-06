module.exports = {
	Name: "origin",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the origin of a given emote",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function origin (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}
	
		let emote = null;
		let customIndex = null;
		for (let i = args.length - 1; i >= 0; i--) {
			const token = args[i];
			if (/^index:\d+$/.test(token)) {
				customIndex = Number(token.split(":")[1]);
				args.splice(i, 1);
			}
		}
	
		emote = args.join(" ");
		if (emote === null) {
			return {
				success: false,
				reply: "No emote provided!"
			};
		}
	
		const emoteData = await sb.Query.getRecordset(rs => rs
			.select("Text", "Tier", "Type", "Todo", "Approved", "Emote_Added")
			.from("data", "Origin")
			.where("Name COLLATE utf8mb4_bin LIKE %s", emote)
		);
	
		if (emoteData.length === 0) {
			return {
				success: false,
				reply: "No definition found for given emote!"
			};
		}
		else if (emoteData.length > 1 && customIndex === null) {
			return {
				reply: `Multiple emotes found for this name! Use "index:0" through "index:${emoteData.length-1}" to access each one.`,
				cooldown: { length: 2500 }
			};
		}
	
		const data = emoteData[customIndex ?? 0];
		if (!data) {
			return {
				reply: "No emote definition exists for that index!"
			};
		}
		else if (!data.Approved) {
			return { reply: "A definition exists, but has not been approved yet!" };
		}
		else {
			const type = (data.Tier) ? `T${data.Tier}` : "";
			let string = `${type} ${data.Type} emote: ${data.Text}`;
	
			if (data.Emote_Added) {
				string += " (emote added on " + data.Emote_Added.sqlDate() + ")";
			}
			if (data.Todo) {
				string = "(TODO) " + string;
			}
	
			return {
				reply: string
			};
		}
	}),
	Dynamic_Description: null
};