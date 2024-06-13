module.exports = {
	Name: "bancheck",
	Aliases: ["bc"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks if a given message would be banphrased in a given channel. Only works for channels that I am in, plus the result isn't 100% guaranteed!",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function banCheck (context, channel, ...rest) {
		if (!channel) {
			return {
				success: false,
				reply: "No channel provided!"
			};
		}
		else if (rest.length === 0) {
			return {
				success: false,
				reply: "No message provided!"
			};
		}

		const message = rest.join(" ");
		const targetChannel = sb.Channel.get(channel.replace(/^#/, "").toLowerCase());
		if (!targetChannel) {
			return {
				success: false,
				reply: "Invalid channel provided!"
			};
		}
		else if (context.channel && context.channel.ID === targetChannel.ID) {
			const emote = await context.channel.getBestAvailableEmote(
				["PepeLaugh", "pepeLaugh", "LULW", "LuL", "LUL", "4HEad", "4Head"],
				"😀"
			);

			return {
				success: false,
				reply: `Don't you think it's a bit silly to bancheck the channel you're in? ${emote}`
			};
		}

		if (!targetChannel.Links_Allowed) {
			const linkCheck = message.replace(sb.Config.get("LINK_REGEX"), "");
			if (linkCheck !== message) {
				return {
					reply: "Links are not allowed in that channel, so your message would probably get timed out."
				};
			}
		}

		if (targetChannel.Banphrase_API_Type === "Pajbot") {
			let data = null;
			try {
				data = await sb.Banphrase.executeExternalAPI(
					message,
					targetChannel.Banphrase_API_Type,
					targetChannel.Banphrase_API_URL,
					{ fullResponse: true }
				);
			}
			catch (e) {
				console.warn(e);
				const code = e.statusCode ?? e.message;

				return {
					success: false,
					reply: `Banphrase API did not respond in time! (code ${code})`
				};
			}

			if (data.banned) {
				const {
					id,
					name,
					phrase,
					length,
					permanent,
					operator,
					case_sensitive: sensitive,
					remove_accents: removeAccents,
					sub_immunity: subImmunity
				} = data.banphrase_data;

				let accents = "";
				if (typeof removeAccents === "boolean") {
					accents = `ignores accents: ${(removeAccents) ? "yes" : "no"};`;
				}

				let immunity = "";
				if (typeof subImmunity === "boolean") {
					immunity = `applied to subs: ${(subImmunity) ? "no" : "yes"};`;
				}

				const punishment = (permanent)
					? "permanent ban"
					: `${sb.Utils.formatTime(length)} timeout`;

				return {
					reply: sb.Utils.tag.trim `
						Banphrase ID ${id} - ${name}
						${operator}: "${phrase}";
						punishment: ${punishment};
						${accents}
						${immunity}
						case sensitive: ${sensitive ? "yes" : "no"}
					`
				};
			}
		}

		const { string } = await sb.Banphrase.execute(message, targetChannel);
		if (message === string) {
			return {
				reply: "That message should be fine."
			};
		}
		else {
			return {
				reply: "That message is most likely going to get timed out, based on my banphrases."
			};
		}
	}),
	Dynamic_Description: null
};
