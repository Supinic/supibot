import { getConfig } from "../../config.ts";
import { defineChatModule } from "../../classes/chat-module.ts";

const { local = {} } = getConfig();

const SUPPORTED_EFFECTS = new Set(["wobbly-windows"]);
const effectNames = [...SUPPORTED_EFFECTS].join(", ");

/**
 * @todo this call requires a self-broadcaster token with the `channel:manage:redemptions` scope
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const updateRedemption = async (status: "CANCELED" | "FULFILLED", redemptionId: string, rewardId: string, channelId: string) => {
	const accessToken = await core.Cache.getByPrefix("TWITCH_READ_SUBSCRIPTIONS_ACCESS_TOKEN") as string | undefined;
	if (!accessToken) {
		return;
	}

	const response = await core.Got.get("Helix")({
		method: "PATCH",
		url: "channel_points/custom_rewards/redemptions",
		headers: {
			"Client-ID": process.env.TWITCH_CLIENT_ID,
			Authorization: `Bearer ${accessToken}`
		},
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

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { channel, channelId, message, data } = context;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { reward, redemption } = data;
			if (reward.title !== "Desktop effects") {
				return;
			}

			const effect = message.split(" ")[0].toLowerCase();
			if (!SUPPORTED_EFFECTS.has(effect)) {
				// await updateRedemption("CANCELED", redemption.id, reward.id, channelId);
				await channel.send(`No valid desktop effect provided! Use one of: ${effectNames}`);
				return;
			}

			// await updateRedemption("FULFILLED", redemption.id, reward.id, channelId);
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
