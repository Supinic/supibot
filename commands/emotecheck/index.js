module.exports = {
	Name: "emotecheck",
	Aliases: ["ec"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts the list of each of Twitch's amazing \"global\" emote sets.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => {
		const path = require.resolve("./emote-sets.json");
		delete require.cache[path];

		const sets = require("./emote-sets.json");
		return {
			sets
		};
	}),
	Code: (async function emoteCheck (context, name) {
		if (!name) {
			return {
				reply: `Check available emote sets here: ${this.getDetailURL()}`
			};
		}

		name = name.toLowerCase();
		const result = this.staticData.sets.find(i => i.name === name || i.aliases.includes(name));
		if (!result) {
			return {
				reply: `No valid emote set found! Check available emote sets here: ${this.getDetailURL()}`
			};
		}

		return {
			reply: result.emotes.join(" ")
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const { sets } = this.staticData;
		const list = [...sets]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(i => {
				const aliases = (i.aliases.length === 0)
					? ""
					: `(${i.aliases.join(", ")})`;

				const list = [];
				if (i.link) {
					list.push(`<a href="${i.link}">Reference</a><br>`);
				}

				const emotesCopy = [...i.emotes];
				list.push(
					i.description,
					`<code>${emotesCopy.sort().join(" ")}</code>`
				);

				const listString = list.map(i => `<li>${i}</li>`).join("");
				return `<li><code>${i.name} ${aliases}</code><ul>${listString}</ul></li>`;
			})
			.join("<br>");

		return [
			"Posts entire emote sets on Twitch and stuff.",
			"Useful to see if you are missing any of given emotes, or just for convience and/or novelty",
			"",

			`<code>${prefix}emotecheck (set name)</code>`,
			"(emotes)",
			"",

			`<ul>${list}</ul>`
		];
	})
};
