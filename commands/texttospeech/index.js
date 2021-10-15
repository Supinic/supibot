module.exports = {
	Name: "texttospeech",
	Aliases: ["tts"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Plays TTS on Supinic's stream, if enabled. You can specify the language by using \"language:<language>\" anywhere in your message.",
	Flags: ["mention","pipe","skip-banphrase","use-params"],
	Params: [
		{ name: "lang", type: "string" },
		{ name: "language", type: "string" },
		{ name: "speed", type: "number" }
	],
	Whitelist_Response: null,
	Static_Data: (() => {
		const limit = 30_000;

		return {
			limit,
			maxCooldown: (this.Cooldown + (limit - 10000) * 10),
			locales: [
				{
					locale: "en-gb",
					language: "English",
					code: "en"
				},
				{
					locale: "en-us",
					language: "English",
					code: "en"
				},
				{
					locale: "en-au",
					language: "English",
					code: "en"
				},
				{
					locale: "en-in",
					language: "English",
					code: "en"
				},
				{
					locale: "ar",
					language: "Arabic",
					code: "ar"
				},
				{
					locale: "bn-bd",
					language: "Bengali",
					code: "bn"
				},
				{
					locale: "zh-cn",
					language: "Chinese",
					code: "zh"
				},
				{
					locale: "cs-cz",
					language: "Czech",
					code: "cs"
				},
				{
					locale: "da-dk",
					language: "Danish",
					code: "da"
				},
				{
					locale: "nl-nl",
					language: "Dutch",
					code: "nl"
				},
				{
					locale: "et-ee",
					language: "Estonian",
					code: "et"
				},
				{
					locale: "tl-ph",
					language: "Filipino",
					code: "tl"
				},
				{
					locale: "fi-fi",
					language: "Finnish",
					code: "fi"
				},
				{
					locale: "fr-fr",
					language: "French",
					code: "fr"
				},
				{
					locale: "fr-ca",
					language: "French",
					code: "fr"
				},
				{
					locale: "de-de",
					language: "German",
					code: "de"
				},
				{
					locale: "el-gr",
					language: "Greek",
					code: "el"
				},
				{
					locale: "hi-in",
					language: "Hindi",
					code: "hi"
				},
				{
					locale: "hu-hu",
					language: "Hungarian",
					code: "hu"
				},
				{
					locale: "it-it",
					language: "Italian",
					code: "it"
				},
				{
					locale: "id-id",
					language: "Indonesian",
					code: "id"
				},
				{
					locale: "ja-jp",
					language: "Japanese",
					code: "ja"
				},
				{
					locale: "jw-id",
					language: "Javanese",
					code: "jv"
				},
				{
					locale: "km-kh",
					language: "Khmer",
					code: "my"
				},
				{
					locale: "ko-kr",
					language: "Korean",
					code: "ko"
				},
				{
					locale: "la",
					language: "Latin",
					code: "la"
				},
				{
					locale: "ml-in",
					language: "Malayalam",
					code: "ml"
				},
				{
					locale: "mr-in",
					language: "Marathi",
					code: "mr"
				},
				{
					locale: "my-mm",
					language: "Burmese",
					code: "my"
				},
				{
					locale: "ne-np",
					language: "Nepali",
					code: "ne"
				},
				{
					locale: "nb-no",
					language: "Norwegian",
					code: "no"
				},
				{
					locale: "pl-pl",
					language: "Polish",
					code: "pl"
				},
				{
					locale: "pt-pt",
					language: "Portuguese",
					code: "pt"
				},
				{
					locale: "pt-br",
					language: "Portuguese",
					code: "pt"
				},
				{
					locale: "ro-ro",
					language: "Romanian",
					code: "ro"
				},
				{
					locale: "ru-ru",
					language: "Russian",
					code: "ru"
				},
				{
					locale: "si-lk",
					language: "Sinhala",
					code: "si"
				},
				{
					locale: "sk-sk",
					language: "Slovak",
					code: "sk"
				},
				{
					locale: "es-es",
					language: "Spanish",
					code: "es"
				},
				{
					locale: "es-mx",
					language: "Spanish",
					code: "es"
				},
				{
					locale: "su-sd",
					language: "Sundanese",
					code: "su"
				},
				{
					locale: "sv-se",
					language: "Swedish",
					code: "sv"
				},
				{
					locale: "ta-in",
					language: "Tamil",
					code: "ta"
				},
				{
					locale: "te-in",
					language: "Telugu",
					code: "te"
				},
				{
					locale: "th-th",
					language: "Thai",
					code: "th"
				},
				{
					locale: "tr-tr",
					language: "Turkish",
					code: "tr"
				},
				{
					locale: "uk-ua",
					language: "Ukrainian",
					code: "uk"
				},
				{
					locale: "vi-vn",
					language: "Vietnamese",
					code: "vi"
				},
				{
					locale: "cy-gb",
					language: "Welsh",
					code: "cy"
				}
			]
		};
	}),
	Code: (async function textToSpeech (context, ...args) {
		if (context.channel?.ID !== 38 || args.length === 0) {
			return {
				reply: "Check out the possible voices and locales here: https://supinic.com/stream/tts"
			};
		}
		else if (!sb.Config.get("TTS_ENABLED")) {
			return {
				reply: "Text-to-speech is currently disabled!"
			};
		}
		else if (!sb.Config.get("TTS_MULTIPLE_ENABLED")) {
			if (this.data.pending) {
				return {
					reply: "Someone else is using the TTS right now, and multiple TTS is not available right now!",
					cooldown: { length: 2500 }
				};
			}

			this.data.pending = true;
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
		let input = context.params.language ?? context.params.lang ?? "en-us";

		if (input === "random") {
			const randomItem = sb.Utils.randArray(this.staticData.locales);
			input = randomItem.locale;
		}
		else {
			code = sb.Utils.modules.languageISO.getCode(input);
		}

		const { locales } = this.staticData;
		const currentLocale = locales.find(i => i.locale === input || i.code === code);
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

			// @todo refactor to use local sb.Got instance when LocalRequest is refactored
			result = await sb.LocalRequest.playTextToSpeech({
				tts: [{
					locale: currentLocale.locale,
					text: args.join(" "),
					speed
				}],
				volume: sb.Config.get("TTS_VOLUME"),
				limit: this.staticData.limit
			});

			messageTime = process.hrtime.bigint() - messageTime;
		}
		catch (e) {
			console.log(e);
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
				reply: `Your TTS was refused, because its length exceeded the limit of ${this.staticData.limit / 1000} seconds!`,
				cooldown: { length: 5000 }
			};
		}

		const duration = sb.Utils.round(Number(messageTime) / 1.0e6, 0);
		let cooldown = (duration > 10000)
			? (this.Cooldown + (duration - 10000) * 10)
			: this.Cooldown;

		if (cooldown > this.staticData.maxCooldown) {
			cooldown = this.staticData.maxCooldown;
		}

		return {
			reply: `Your message has been succesfully played on TTS! It took ${duration / 1000} seconds to read out, and your cooldown is ${cooldown / 1000} seconds.`,
			cooldown: {
				length: cooldown
			}
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { locales } = values.getStaticData();
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

			`<code>${prefix}tts language:Italian Questo è un messaggio.</code>`,
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
