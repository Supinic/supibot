module.exports = {
	Name: "bancheck",
	Aliases: ["bc"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks if a given message would be banphrased in a given channel. Checks the API banphrase (if it exists for given channel) and then the bot's banphrases as well.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function banCheck (context, channel, ...rest) {
		if (!channel) {
			return { reply: "No channel provided!" };
		}
		else if (rest.length === 0) {
			return { reply: "No message provided!" };
		}
	
		const message = rest.join(" ");
		const targetChannel = sb.Channel.get(channel.replace(/^#/, ""));
		if (!targetChannel) {
			return {
				reply: "Invalid channel provided!"
			};
		}
		else if (context.channel?.ID === targetChannel.ID)  {
			return {
				reply: "Don't you think it's a bit silly to bancheck the channel you're in? PepeLaugh"
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
			let data = null
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
				return {
					reply: "Banphrase API did not respond in time!"
				};
			}
	
			if (data.banned) {
				console.warn("bancheck command", { targetChannel, data });
				
				const { id, name, phrase, length, permanent, operator, case_sensitive: sensitive } = data.banphrase_data;
				const punishment = (permanent)
					? "permanent ban"
					: `${sb.Utils.formatTime(length)} seconds timeout`;
	
				return {
					reply: `Banphrase ID ${id} - ${name}. ${operator}: "${phrase}"; punishment: ${punishment}. Case sensitive: ${sensitive ? "yes" : "no"}.`
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