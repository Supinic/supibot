const {
	TTS_ENABLED,
	TTS_VOLUME
} = require("../../utils/shared-cache-keys.json");

const PROFILES_CACHE_KEY = "profiles";
const tts = {
	enabled: null,
	url: null,
	channels: []
};

module.exports = {
	Name: "epal",
	Aliases: ["ForeverAlone"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random person from epal.gg - posts their description. If used on Supinic's channel with TTS on, and if they have an audio introduction, it will be played on stream.",
	Flags: ["mention"],
	Params: [],
	Whitelist_Response: null,
	initialize: function () {
		if (!sb.Config.has("LOCAL_IP", true) || !sb.Config.has("LOCAL_PLAY_SOUNDS_PORT", true)) {
			console.warn("$epal: TTS not configured - will be unavailable");
			tts.enabled = false;
		}
		else {
			tts.url = `${sb.Config.get("LOCAL_IP")}:${sb.Config.get("LOCAL_PLAY_SOUNDS_PORT")}`;
			tts.enabled = true;

			const { ttsChannels } = require("./epal-tts-config.json");
			tts.channels = ttsChannels;
		}
	},
	Code: async function epal (context) {
		let profilesData = await this.getCacheData(PROFILES_CACHE_KEY);
		if (!profilesData) {
			const response = await sb.Got("GenericAPI", {
				method: "POST",
				responseType: "json",
				throwHttpErrors: false,
				url: "https://h.epal.gg/web/home-rc/fy/v2",
				json: {}
			});

			if (!response.ok || !response.body.content) {
				return {
					success: false,
					reply: `No profile data is currently available! Try again later.`
				};
			}

			profilesData = response.body.content.list.map(i => ({
				ID: i.userId,
				name: i.userName,
				intro: i.introduction,
				description: i.introductionText,
				audioFile: i.introductionSpeech,
				product: i.productName,
				profilePicture: i.cover,
				tags: i.styleDesc ?? [],
				revenue: (i.serveNum)
					? sb.Utils.round(i.serveNum * i.price / 100, 2)
					: null,
				price: {
					regular: (i.price / 100),
					unit: i.priceUnitDesc ?? "hour"
				}
			}));

			await this.setCacheData(PROFILES_CACHE_KEY, profilesData, { expiry: 864e5 });
		}

		if (profilesData.length === 0) {
			return {
				success: false,
				reply: "The website does not have any active profiles at the moment!? (This shouldn't really happen)"
			};
		}

		const {
			ID,
			audioFile,
			description,
			name,
			revenue,
			price,
			product,
			tags
		} = sb.Utils.randArray(profilesData);

		const ttsStatus = await sb.Cache.getByPrefix(TTS_ENABLED);
		if (tts.channels.includes(context.channel?.ID) && ttsStatus) {
			const ttsVolume = await sb.Cache.getByPrefix(TTS_VOLUME);
			await sb.Got("GenericAPI", {
				url: tts.url,
				responseType: "text",
				searchParams: new URLSearchParams({
					specialAudio: "1",
					url: audioFile,
					volume: ttsVolume,
					limit: 20_000
				})
			});
		}

		const priceString = `$${price.regular} per ${price.unit}`;
		const tagsString = (tags.length !== 0) ? `Tags: ${tags.join(", ")}` : "";
		const revenueString = (revenue !== null && revenue > 0)
			? `Total revenue: $${revenue}.`
			: "";

		const profileUrl = `https://www.epal.gg/epal/${ID}`;

		return {
			reply: sb.Utils.tag.trim `
				${name} provides "${product}" content for ${priceString}.
				${tagsString}
				${revenueString}
				${profileUrl}
				${description}
			`
		};
	},
	Dynamic_Description: async function (prefix) {
		return [
			`Fetches a random description of a user profile from <a target="_blank" href="//epal.gg">epal.gg</a>.`,
			`If this command is executed in Supinic's channel and TTS is on, the user introduction audio will be played.`,
			"",

			`<code>${prefix}epal</code>`,
			`<code>${prefix}ForeverAlone</code>`,
			"Random user from the current featured/top list"
		];
	}
};
