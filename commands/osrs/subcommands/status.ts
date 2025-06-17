import { bindOsrsSubcommand } from "../index.js";

type StatusData = {
	playDisabled: boolean;
	psaEnabled: boolean;
	psaMessage: string;
	loadRemoteBanner: boolean;
	loadRemoteLogo: boolean;
	remoteBannerFilename: string;
	remoteBannerLinkUrl: string;
	remoteLogoFileName: string;
};

export default bindOsrsSubcommand({
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
		const response = await core.Got.get("GenericAPI")<StatusData>({
			url: "https://files.publishing.production.jxp.jagex.com/osrs/osrs.json"
		});

		if (!response.ok) {
			return {
				success: false,
				reply: "Could not query the Game Status API!"
			};
		}

		const { psaEnabled, psaMessage } = response.body;
		if (!psaEnabled) {
			return {
				success: true,
				reply: "No game events detected at the moment."
			};
		}
		else {
			return {
				success: true,
				reply: `Game event detected: ${psaMessage}`
			};
		}
	}
});
