import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { TTS_ENABLED } = cacheKeys;

import { getConfig } from "../../config.js";
const { epalAudioChannels, listenerAddress, listenerPort } = getConfig().local ?? {};

const PROFILES_CACHE_KEY = "epal-profiles";

export default {
	Name: "epal",
	Aliases: ["ForeverAlone"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random person from epal.gg - posts their description. If used on configured channels with TTS on, and if they have an audio introduction, it will be played on stream.",
	Flags: ["mention"],
	Params: [],
	Whitelist_Response: null,
	initialize: function () {
		if (!epalAudioChannels || !listenerAddress || !listenerPort) {
			console.warn("$epal: TTS not configured - will be unavailable");
			this.data.listenerEnabled = false;
		}
		else {
			this.data.listenerEnabled = true;
		}
	},
	Code: async function epal (context) {
		let profilesData = await this.getCacheData(PROFILES_CACHE_KEY);
		if (!profilesData) {
			const response = await core.Got.get("GenericAPI")({
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
					? core.Utils.round(i.serveNum * i.price / 100, 2)
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
		} = core.Utils.randArray(profilesData);

		const ttsStatus = await core.Cache.getByPrefix(TTS_ENABLED);
		if (epalAudioChannels.includes(context.channel?.ID) && ttsStatus && this.data.listenerEnabled) {
			await core.Got.get("GenericAPI")({
				url: `${listenerAddress}:${listenerPort}`,
				responseType: "text",
				searchParams: new URLSearchParams({
					specialAudio: "1",
					url: audioFile,
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
			reply: core.Utils.tag.trim `
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
