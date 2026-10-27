import { getConfig } from "../../config.ts";
import { defineChatModule } from "../../classes/chat-module.ts";

const { local = {} } = getConfig();

const SUPPORTED_EFFECTS = new Set(["wobbly-windows"]);
const effectNames = [...SUPPORTED_EFFECTS].join(", ");

const updateRedemption = async (status: "CANCELED" | "FULFILLED", redemptionId: string, rewardId: string, channelId: string) => {
	const response = await core.Got.get("Helix")({
		method: "PATCH",
		url: "channel_points/custom_reward/redemptions",
		searchParams: {
			id: redemptionId,
			reward_id: rewardId,
			broadcaster_id: channelId
		},
		json: { status }
	});

	return response.statusCode;
};

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

			const { channel, channelId, message, data } = context;
			const { reward, redemption } = data;
			if (reward.title !== "Desktop effects") {
				return;
			}

			const effect = message.split(" ")[0].toLowerCase();
			if (!SUPPORTED_EFFECTS.has(effect)) {
				await updateRedemption("CANCELED", redemption.id, reward.id, channelId);
				await channel.send(`No valid desktop effect provided! Use one of: ${effectNames}`);
				return;
			}

			await updateRedemption("FULFILLED", redemption.id, reward.id, channelId);
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
