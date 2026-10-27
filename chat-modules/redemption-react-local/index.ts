import { getConfig } from "../../config.ts";
import { defineChatModule } from "../../classes/chat-module.ts";

const { local = {} } = getConfig();

const SUPPORTED_EFFECTS = new Set(["wobbly-windows"]);
const effectNames = [...SUPPORTED_EFFECTS].join(", ");

export default defineChatModule({
	name: "redemption-react-local",
	description: "Reacts to Twitch redemptions with a local HTTP request",
	platform: ["twitch"],
	scope: "channel",
	initialize: () => {
		const { listenerAddress, listenerPort } = local;
		return Boolean(listenerAddress && listenerPort);
	},
	handlers: {
		async redemption (context) {
			const { listenerAddress, listenerPort } = local;
			if (!listenerAddress || !listenerPort) {
				return;
			}

			const { channel, message, data } = context;
			if (data.reward.title !== "Desktop effects") {
				return;
			}

			const effect = message.split(" ")[0].toLowerCase();
			if (!SUPPORTED_EFFECTS.has(effect)) {
				await channel.send(`No valid desktop effect provided! Use one of: ${effectNames}`);
				return;
			}

			await channel.send(`Successfully enabled the ${effect} effect!`);

			await core.Got.get("GenericAPI")({
				url: `${listenerAddress}:${listenerPort}`,
				responseType: "text",
				searchParams: new URLSearchParams({
					desktopEffect: "1",
					action: "enable",
					effect
				})
			});
		}
	}
});
