const ALLOWED_MODES = [
	{
		name: "Ignore",
		description: "Will send the message as if there was no API configured."
	},
	{
		name: "Notify",
		description: "Will send the message regardless, but adds a little warning emoji ⚠"
	},
	{
		name: "Nothing",
		description: "Will not reply at all."
	},
	{
		name: "Refuse",
		description: "Will reply with a message warning that the API did not respond."
	},
	{
		name: "Whisper",
		description: "Won't reply in the main channel at all, but the response will be private messaged to target user."
	}
];
const HTML_MODE_LIST = ALLOWED_MODES.map(i => `<li><code>${i.name}</code><br>${i.description}</li><br>`).join("");

module.exports = {
	name: "banphrase-api",
	aliases: ["api", "banphrase"],
	description: [
		`<code>$bot api url:(link) mode:(mode)</code>`,
		`<code>$bot api channel:(channel) url:(link) mode:(mode)</code>`,
		`Configures the channel's Pajbot banphrase API. You can use one of: "api", "banphrase", "banphrase-api" for the sub-command.`,
		"You can change the URL, but it has to reply properly to a test message.",
		`You can unset the URL by using "url:none".`,
		"",

		"You can also change the mode of Supibot's behaviour when the API times out.",
		"Modes:",
		"",
		`<ul>${HTML_MODE_LIST}</ul>`
	],
	execute: async (context, options = {}) => {
		const { params } = context;
		const { channelData } = options;

		const result = [];
		if (params.url) {
			if (params.url === "none") {
				await channelData.saveProperty("Banphrase_API_URL", null);
				await channelData.saveProperty("Banphrase_API_Type", null);
				result.push("Banphrase API URL has been unset.");
			}
			else {
				let url;
				try {
					url = new URL(params.url).hostname ?? params.url;
				}
				catch {
					url = params.url;
				}

				try {
					await sb.Banphrase.executeExternalAPI("test", "pajbot", url);
				}
				catch {
					return {
						success: false,
						reply: "Banphrase API URL is not valid - no response received!"
					};
				}

				await channelData.saveProperty("Banphrase_API_URL", url);
				await channelData.saveProperty("Banphrase_API_Type", "Pajbot");
				result.push(`Banphrase API URL has been set to ${url}.`);
			}
		}

		if (params.mode) {
			params.mode = sb.Utils.capitalize(params.mode.toLowerCase());
			const found = ALLOWED_MODES.find(i => i.name === params.mode);
			if (!found) {
				const allowedTypes = ALLOWED_MODES.map(i => i.name).join(", ");
				return {
					success: false,
					reply: `Banphrase API mode is not allowed! Use one of: ${allowedTypes}`
				};
			}

			await channelData.saveProperty("Banphrase_API_Downtime", params.mode);
			result.push(`Banphrase API mode has been set to ${params.mode}.`);
		}

		if (result.length === 0) {
			return {
				success: false,
				reply: "No changes have been made!"
			};
		}
		else {
			return {
				reply: result.join(" ")
			};
		}
	}
};
