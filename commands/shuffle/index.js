module.exports = {
	Name: "shuffle",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Shuffles the provided message, word by word.",
	Flags: ["non-nullable","pipe","use-params"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function shuffle (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		let reply;
		if (context.params.fancy === "true") {
			const result = [];
			const message = args.join(" ").split(/\b|(?:(\s))/).filter(Boolean);
			while (message.length > 0) {
				const randomIndex = sb.Utils.random(0, message.length - 1);
				result.push(message[randomIndex]);
				message.splice(randomIndex, 1);
			}

			reply = result.join(" ").replace(/\s+/g, " ");
		}
		else {
			const result = [];
			const message = [...args];
			while (message.length > 0) {
				const randomIndex = sb.Utils.random(0, message.length - 1);
				result.push(message[randomIndex]);
				message.splice(randomIndex, 1);
			}

			reply = result.join(" ");
		}

		return { 
			reply,
			cooldown: {
				length: (context.append.pipe) ? null : this.Cooldown
			}
		};
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"For a given message, shuffles the words around.",
			"",

			`<code>${prefix}shuffle this is a random message`,
			`a random is message this`,
			"",

			`<code>${prefix}shuffle fancy:true (this) isn't a random! message`,
			`) isn a ' ! random this ( message`,
		];
	})
};