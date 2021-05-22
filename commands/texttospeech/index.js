module.exports = {
	Name: "texttospeech",
	Aliases: ["tts"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Plays TTS on Supinic's stream, if enabled. You can specify the language by using \"language:<language>\" anywhere in your message.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => {
		const limit = 30_000;
		const partsLimit = 5;
	
		return {
			limit,
			partsLimit,
			maxCooldown: (this.Cooldown + (limit - 10000) * 10),
			locales: sb.Config.get("TTS_LOCALE_DATA")
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
	
		const { locales } = this.staticData;
	
		let ttsData = [];
		let currentLocale = "en-us";
		let currentText = [];
		let speed = 1;
	
		for (const token of args) {
			if (token.includes("speed:")) {
				const newSpeed = Number(token.split(":")[1]);
				if (!Number.isFinite(newSpeed) || newSpeed < 0.1 || newSpeed > 1.0) {
					this.data.pending = false;
					return {
						success: false,
						reply: `Invalid speed coefficient provided! Must be within the range <0.1, 1.0>`
					};
				}
	
				if (currentText.length > 0) {
					ttsData.push({
						locale: currentLocale.locale,
						text: currentText.join(" "),
						speed
					});
				}
	
				speed = newSpeed;
				currentText = [];
			}
			else if (token.includes("lang:") || token.includes("language:")) {
				const param = token.split(":")[1]?.toLowerCase();
				if (!param) {
					this.data.pending = false;
					return {
						reply: `Incorrect format provided! Use (voice|lang):(name) instead.`
					};
				}
	
				let locale = locales.find(i => i.locale === param);
				if (!locale) {
					const code = sb.Utils.modules.languageISO.getCode(param);
					if (!code) {
						this.data.pending = false;
						return {
							reply: `Language not found: ${param}`
						};
					}
	
					locale = locales.find(i => i.code === code);
					if (!locale) {
						this.data.pending = false;
						return {
							reply: `Language not supported: ${param}`
						};
					}
				}
	
				if (locale !== currentLocale) {
					if (currentText.length > 0) {
						ttsData.push({
							locale: currentLocale.locale,
							text: currentText.join(" "),
							speed
						});
					}
	
					currentLocale = locale;
					currentText = [];
				}
			}
			else {
				currentText.push(token);
			}
		}
	
		ttsData.push({
			locale: currentLocale.locale,
			text: currentText.join(" "),
			speed
		});
	
		ttsData = ttsData.filter(i => i.text.length > 0);
	
		if (ttsData.length > this.staticData.partsLimit) {
			this.data.pending = false;
			return {
				success: false,
				reply: `Your TTS was refused! You used too many parts - ${ttsData.length}, but the maximum is ${this.staticData.partsLimit}.`,
				cooldown: { length: 5000 }
			};
		}
	
		let messageTime = 0n;
		let result = null;
		try {
			messageTime = process.hrtime.bigint();
			result = await sb.LocalRequest.playTextToSpeech({
				tts: ttsData,
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
			? (this.Cooldown + (duration - 10000) * 10) * (ttsData.length)
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
		const { partsLimit, locales } = values.getStaticData();
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
			"Plays the TTS using a French.",
			"",
	
			`<code>${prefix}tts lang:fr-fr Ceci est un message.</code>`,
			"Plays the TTS, same as above, but using the locale <code>fr-fr</code>",
			"",
	
			`<code>${prefix}tts lang:en-au Once a jolly swagman, camped by a billabong, under the shade of a Coolibah tree.</code>`,
			"Plays the TTS using Australian English. You must use the locale to access this voice, because English is otherwise shared.",
			"",
	
			`<code>${prefix}tts lang:en-gb Hello there. lang:fr-fr Comment ça va? lang:polish Co mówisz?</code>`,
			"Plays the TTS using three voices for each message part.",
			"The voice name has to be specified before (!) the actual message.",
			"Be warned - there is a limit of how many parts of tts you can use in one command!",
			`Current limit: ${partsLimit} voices per message`,
			"",
	
			"Available locales:",
			`<ul>${list}</ul>`
		];
	})
};
