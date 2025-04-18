export default {
	name: "status",
	title: "Game status",
	aliases: [],
	default: false,
	description: [
		"Game status",
		`<code>$osrs status</code>`,
		"If there is a Jagex Launcher status (e.g. worlds going down, etc.), this command will tell you about it."
	],
	execute: async function () {
		const response = await core.Got.get("GenericAPI")({
			url: "https://files.publishing.production.jxp.jagex.com/osrs.json"
		});

		if (!response.ok) {
			return {
				success: false,
				reply: "Could not query the Game Status API!"
			};
		}

		const { psa } = response.body;
		if (!psa) {
			return {
				success: true,
				reply: "No game events detected at the moment."
			};
		}
		else {
			return {
				success: true,
				reply: `Game event detected: ${psa}`
			};
		}
	}
};
