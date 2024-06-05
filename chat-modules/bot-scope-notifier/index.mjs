const BASE_CACHE_KEY = "website-twitch-auth-bot";
const DEAD_LINE = new sb.Date("2024-06-26");
const TIMEOUT = 18 * 36e5; // 18 hours

const createScopeKey = (channelData) => `${BASE_CACHE_KEY}-${channelData.Specific_ID}`;
const createNotificationKey = (channelData) => `chat-module-bot-scope-notifier-channel-${channelData.ID}`;

const isModerator = (channelData) => (channelData.Mode === "Moderator");
const checkScope = async (channelData) => await sb.Cache.getByPrefix(createScopeKey(channelData));

const neverCheckAgainChannels = new Set();
const timeouts = new Map();

const createMessage = (channel) => sb.Utils.tag.trim `
	Starting June 26th 2024, to stay in this channel, I have to either:
	1) get permission from @${channel.Name} via Twitch,
	or 2) get modded here. 
	Make sure you do either or both by the deadline.
	Twitch permission is granted here: https://supinic.com/bot/twitch-auth
`;

export const definition = {
	Name: "bot-scope-notifier",
	Events: ["message"],
	Description: "Makes sure channels that do not have Supibot modded or permitted are notified about this, unintrusively, no spam.",
	Code: (async function botScopeNotifier (context) {
		const { channel, message: incomingMessage, platform, user } = context;

		// Do not check anything on platforms outside Twitch
		if (platform.name !== "twitch") {
			return;
		}

		// If checked already and the channel has either or both permissions -> SKIP
		if (neverCheckAgainChannels.has(channel.ID)) {
			return;
		}
		// Do not check Inactive/Read-only channels
		else if (channel.Mode === "Inactive" || channel.Mode === "Read") {
			neverCheckAgainChannels.add(channel.ID);
			return;
		}
		// If user is not yet established in database -> SKIP
		else if (!user) {
			return;
		}
		// Don't check own messages
		else if (user.Name === platform.selfName) {
			return;
		}
		// Don't check non-command messages
		else if (!sb.Command.is(incomingMessage)) {
			return;
		}

		const now = sb.Date.now();

		// Don't check anything past the deadline
		if (now >= DEAD_LINE) {
			return;
		}

		// If the channel has Supibot moderated, or the permission was granted via website
		if (isModerator(channel) || await checkScope(channel)) {
			// Add to "checked already" list and skip
			neverCheckAgainChannels.add(channel.ID);
			return;
		}

		// If they received a message recently (saved in memory) -> SKIP
		const existingTimeout = timeouts.get(channel.ID) ?? 0;
		if (existingTimeout > now) {
			return;
		}

		// If they received a message recently (saved in Redis) -> SKIP
		const alreadyNotifiedKey = createNotificationKey(channel);
		const notifiedInCache = await sb.Cache.getByPrefix(alreadyNotifiedKey);
		if (notifiedInCache) {
			return;
		}

		// If none of above is true, first set the timeout checks, both memory and Redis
		timeouts.set(channel.ID, now + TIMEOUT);
		await sb.Cache.setByPrefix(alreadyNotifiedKey, "NOTIFIED", {
			expiry: TIMEOUT
		});

		await channel.setDataProperty("botScopeNotificationSent", now);

		// Finally, create and send the message
		const message = createMessage(channel);
		await channel.send(message);
	}),
	Global: true,
	Platform: "twitch"
};
