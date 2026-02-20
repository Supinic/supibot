import * as z from "zod";
import { getCode } from "../../utils/languages.js";
import { declare } from "../../classes/command.js";
import { getConfig } from "../../config.js";
import rawLocales from "./tts-locales.json" with { type: "json" };
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };

const { TTS_ENABLED } = cacheKeys;
const { listenerAddress, listenerPort, ttsLengthLimit, ttsListUrl } = getConfig().local ?? {};

const locales = z.array(z.object({
	locale: z.string(),
	language: z.string(),
	code: z.string()
})).parse(rawLocales);
const htmlListItems = locales.map(i => `<li><code>${i.locale}</code> - ${i.language}</li>`).join("");

let pending = false;
const ttsEnabled = Boolean(listenerAddress && listenerPort);
const DEFAULT_TTS_LIMIT = 30_000;
const limit = ttsLengthLimit ?? DEFAULT_TTS_LIMIT;

const BASE_COOLDOWN = 10000; // @todo add generic to Command to have  the specific value available
const MAX_TTS_COOLDOWN = 60000;

export default declare({
	Name: "texttospeech",
	Aliases: ["tts"],
	Cooldown: BASE_COOLDOWN,
	Description: "Plays TTS on Supinic's stream, if enabled. You can specify the language by using \"language:<language>\" anywhere in your message.",
	Flags: ["mention", "pipe", "skip-banphrase", "whitelist"],
	Params: [
		{ name: "lang", type: "string" },
		{ name: "speed", type: "number" }
	],
	Whitelist_Response: `Check out the possible voices and locales here: ${ttsListUrl}`,
	Code: (async function textToSpeech (context, ...args) {
		if (!ttsEnabled) {
			return {
				success: false,
				reply: "Local playsound listener is not configured!"
			};
		}

		const text = args.join(" ").trim();
		if (!text) {
			return {
				cooldown: 5000,
				success: false,
				reply: `Check out the possible voices and locales here: ${ttsListUrl}`
			};
		}

		const state = await core.Cache.getByPrefix(TTS_ENABLED) as string | undefined;
		if (!state) {
			return {
				success: false,
				reply: "Text-to-speech is currently disabled!"
			};
		}

		const speed = context.params.speed ?? 1;
		if (!Number.isFinite(speed) || speed < 0.1 || speed > 1) {
			this.data.pending = false;
			return {
				success: false,
				reply: `Invalid speed coefficient provided! Must be within the range <0.1, 1.0>`
			};
		}

		let locale = "en-gb";
		if (context.params.lang) {
			if (context.params.lang === "random") {
				const randomItem = core.Utils.randArray(locales);
				locale = randomItem.locale;
			}
			else {
				const languageCode = getCode(context.params.lang);
				if (!languageCode) {
					return {
						success: false,
						reply: "Provided language does not exist!"
					};
				}

				const localeDef = locales.find(i => i.code === languageCode);
				if (!localeDef) {
					return {
						success: false,
						reply: "Your provided language is not supported in TTS!"
					};
				}

				locale = localeDef.locale;
			}
		}

		if (pending) {
			return {
				reply: "Someone else is using the TTS right now!",
				cooldown: { length: 2500 }
			};
		}
		else {
			pending = true;
		}

		let messageTime;
		let result;
		try {
			messageTime = process.hrtime.bigint();

			const response = await core.Got.get("GenericAPI")({
				url: `${listenerAddress}:${listenerPort}`,
				responseType: "text",
				searchParams: new URLSearchParams({
					tts: JSON.stringify([{ locale, text, speed }]),
					limit: String(limit)
				})
			});

			messageTime = process.hrtime.bigint() - messageTime;
			result = (response.body === "true");
		}
		catch {
			await core.Cache.setByPrefix(TTS_ENABLED, false);
			return {
				reply: "TTS Listener encountered an error or is turned on! Turning off text to speech."
			};
		}
		finally {
			pending = false;
		}

		if (!result) {
			return {
				reply: `Your TTS was refused, because its length exceeded the limit of ${limit / 1000} seconds!`,
				cooldown: { length: 5000 }
			};
		}

		const duration = core.Utils.round(Number(messageTime) / 1_000_000, 0);
		let cooldown = (duration > 10000)
			? (BASE_COOLDOWN + (duration - 10000) * 10)
			: BASE_COOLDOWN;

		if (cooldown > MAX_TTS_COOLDOWN) {
			cooldown = MAX_TTS_COOLDOWN;
		}

		return {
			reply: core.Utils.tag.trim `
				Your message has been successfully played on TTS! 
				It took ${duration / 1000} seconds to read out,
				and your cooldown is ${cooldown / 1000} seconds.
			`,
			cooldown: {
				length: cooldown
			}
		};
	}),
	Dynamic_Description: (prefix) => [
		"Plays your messages as TTS on supinic's stream, if enabled.",
		"You can specify a language or a locale to have it say your message. If you don't specify, UK English is used by default",
		"If you use multiple voices, each part of the message will be read out by different voices.",
		"",

		`<code>${prefix}tts This is a message.</code>`,
		"Plays the TTS using UK English.",
		"",

		`<code>${prefix}tts speed:0.5 This is a message.</code>`,
		"Plays the TTS at 50% speed.",
		"Speed can be a value between 0.1 and 1.0 inclusive, and defaults to 1.0 (100%, normal speed).",
		"",

		`<code>${prefix}tts lang:Italian Questo è un messaggio.</code>`,
		"Plays the TTS using Italian.",
		"",

		`<code>${prefix}tts lang:french Ceci est un message.</code>`,
		`<code>${prefix}tts lang:fr-fr Ceci est un message.</code>`,
		"Plays the TTS using French.",
		"",

		`<code>${prefix}tts lang:en-au Once a jolly swagman, camped by a billabong, under the shade of a Coolibah tree.</code>`,
		"Plays the TTS using Australian English. You must use the locale to access this voice, because English has multiple locales - Australian, Canadian UK English, US English, Indian, ....",
		"",

		`<code>${prefix}tts lang:random (your message)</code>`,
		"Plays the TTS using a random supported language",
		"",

		"Available languages and locales:",
		`<ul>${htmlListItems}</ul>`
	]
});
