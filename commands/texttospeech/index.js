const LanguageCodes = require("language-iso-codes");

const tts = {
	enabled: null,
	url: null,
	maxCooldown: null,
	limit: null,
	locales: []
};

module.exports = {
	Name: "texttospeech",
	Aliases: ["tts"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Plays TTS on Supinic's stream, if enabled. You can specify the language by using \"language:<language>\" anywhere in your message.",
	Flags: ["mention","pipe","skip-banphrase","whitelist"],
	Params: [
		{ name: "lang", type: "string" },
		{ name: "speed", type: "number" }
	],
	Whitelist_Response: "Check out the possible voices and locales here: https://supinic.com/stream/tts",
	initialize: function () {
		if (!sb.Config.has("LOCAL_IP", true) || !sb.Config.has("LOCAL_PLAY_SOUNDS_PORT", true)) {
			console.warn("$tts: Listener not configured - will be unavailable");
			tts.enabled = false;
		}
		else {
			tts.url = `${sb.Config.get("LOCAL_IP")}:${sb.Config.get("LOCAL_PLAY_SOUNDS_PORT")}`;
			tts.enabled = true;

			const { limit, locales } = require("./tts-config.json");
			tts.limit = limit;
			tts.maxCooldown = this.Cooldown + (limit - 10_000) * 10;
			tts.locales = locales;

			this.data.pending = false;
		}
	},
	Code: (async function textToSpeech (context, ...args) {
		if (!tts.enabled) {
			return {
				success: false,
				reply: "Local playsound listener is not configured!"
			};
		}
		else if (args.length === 0) {
			return {
				cooldown: 5000,
				success: false,
				reply: "Check out the possible voices and locales here: https://supinic.com/stream/tts"
			};
		}
		else if (!sb.Config.get("TTS_ENABLED")) {
			return {
				reply: "Text-to-speech is currently disabled!"
			};
		}

		if (!sb.Config.get("TTS_MULTIPLE_ENABLED")) {
			if (this.data.pending) {
				return {
					reply: "Someone else is using the TTS right now, and multiple TTS is not available right now!",
					cooldown: { length: 2500 }
				};
			}
			else {
				this.data.pending = true;
			}
		}

		const speed = context.params.speed ?? 1;
		if (!Number.isFinite(speed) || speed < 0.1 || speed > 1.0) {
			this.data.pending = false;
			return {
				success: false,
				reply: `Invalid speed coefficient provided! Must be within the range <0.1, 1.0>`
			};
		}

		let code;
		let input = context.params.lang ?? "en-us";

		if (input === "random") {
			const randomItem = sb.Utils.randArray(tts.locales);
			input = randomItem.locale;
		}
		else {
			code = LanguageCodes.getCode(input);
		}

		const currentLocale = tts.locales.find(i => i.locale === input || i.code === code);
		if (!currentLocale) {
			this.data.pending = false;
			return {
				reply: `Language not found or supported: ${code ?? input}`
			};
		}

		let messageTime;
		let result = null;
		try {
			messageTime = process.hrtime.bigint();

			const response = await sb.Got("GenericAPI", {
				url: tts.url,
				responseType: "text",
				searchParams: new URLSearchParams({
					tts: JSON.stringify([{
						locale: currentLocale.locale,
						text: args.join(" "),
						speed
					}]),
					volume: sb.Config.get("TTS_VOLUME"),
					limit: tts.limit
				})
			});

			messageTime = process.hrtime.bigint() - messageTime;
			result = (response.body === "true");
		}
		catch (e) {
			await sb.Config.set("TTS_ENABLED", false);

			return {
				reply: "TTS Listener encountered an error or is turned on. Turning off text to speech!"
			};
		}
		finally {
			this.data.pending = false;
		}

		if (result === null || result === false) {
			return {
				reply: `Your TTS was refused, because its length exceeded the limit of ${tts.limit / 1000} seconds!`,
				cooldown: { length: 5000 }
			};
		}

		const duration = sb.Utils.round(Number(messageTime) / 1.0e6, 0);
		let cooldown = (duration > 10000)
			? (this.Cooldown + (duration - 10000) * 10)
			: this.Cooldown;

		if (cooldown > tts.maxCooldown) {
			cooldown = tts.maxCooldown;
		}

		return {
			reply: sb.Utils.tag.trim `
				Your message has been successfully played on TTS! 
				It took ${duration / 1000} seconds to read out,
				and your cooldown is ${cooldown / 1000} seconds.
			`,
			cooldown: {
				length: cooldown
			}
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const { locales } = require("./tts-config.json");
		const list = locales.map(i => `<li><code>${i.locale}</code> - ${i.language}</li>`).join("");

		return [
			"Plays your messages as TTS on supinic's stream, if enabled.",
			"You can specify a language or a locale to have it say your message. If you don't specify, UK English is used by default",
			"If you use multiple voices, each part of the message will be read out by different voices.",
			"",

			`<code>${prefix}tts This is a message.</code>`,
			"Plays the TTS using UK English.",
			"",

			`<code>${prefix}tts speed:0.5 This is a message.</code>`,
			"Plays the TTS, same as above, but at 50% speed.",
			"",

			`<code>${prefix}tts lang:Italian Questo è un messaggio.</code>`,
			"Plays the TTS using Italian.",
			"",

			`<code>${prefix}tts lang:french Ceci est un message.</code>`,
			"Plays the TTS using French.",
			"",

			`<code>${prefix}tts lang:fr-fr Ceci est un message.</code>`,
			"Plays the TTS, same as above, but using the locale <code>fr-fr</code>",
			"",

			`<code>${prefix}tts lang:en-au Once a jolly swagman, camped by a billabong, under the shade of a Coolibah tree.</code>`,
			"Plays the TTS using Australian English. You must use the locale to access this voice, because English has multiple locales - Australian, Canadian UK English, US English, Indian, ....",
			"",

			`<code>${prefix}tts lang:random (your message)</code>`,
			"Plays the TTS using a random supported language",
			"",

			"Available locales:",
			`<ul>${list}</ul>`
		];
	})
};
