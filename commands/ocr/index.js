module.exports = {
	Name: "ocr",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Takes your image link and attempts to find the text in it by using OCR.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "force", type: "boolean" },
		{ name: "lang", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => {
		const definitions = require("./languages.json");
		const names = Object.keys(definitions)
			.map(i => sb.Utils.modules.languageISO.getName(i));

		return { definitions, names };
	}),
	Code: (async function ocr (context, ...args) {
		let languageCode = "eng";
		if (context.params.lang) {
			languageCode = sb.Utils.modules.languageISO.getCode(context.params.lang, "iso6393");
			if (!languageCode) {
				return {
					success: false,
					reply: "Provided language could not be parsed!"
				};
			}
		}

		if (languageCode === "chi") {
			languageCode = "chs"; // thanks for using standard codes everyone
		}

		const language = this.staticData.definitions[languageCode];
		if (!language) {
			return {
				success: false,
				reply: `Language is not supported! Use one of these: ${this.staticData.names}`,
				cooldown: 2500
			};
		}

		let link;
		const { URL } = require("url");
		for (const arg of args) {
			let parsedURL;
			try {
				parsedURL = new URL(arg);
			}
			catch {
				continue;
			}

			parsedURL.protocol = "https";
			link = parsedURL.toString();

			break;
		}

		if (!link) {
			return {
				success: false,
				reply: "No valid link provided!",
				cooldown: 2500
			};
		}

		let data;
		let statusCode;

		const engine = Math.max(...language.engines);
		const key = { language: languageCode, link };

		// If force is true, don't even bother fetching the cache data
		const cacheData = (context.params.force) ? null : await this.getCacheData(key);
		if (cacheData) {
			data = cacheData.data;
			statusCode = cacheData.statusCode;
		}
		else {
			const response = await sb.Got({
				method: "GET",
				responseType: "json",
				throwHttpErrors: false,
				url: "https://api.ocr.space/parse/imageurl",
				headers: {
					apikey: sb.Config.get("API_OCR_SPACE")
				},
				searchParams: {
					url: link,
					language: languageCode,
					scale: "true",
					isTable: "true",
					OCREngine: String(engine),
					isOverlayRequired: "false"
				}
			});

			statusCode = response.statusCode;
			data = response.body;

			// set cache with no expiration - only if request didn't time out
			if (!data.ErrorMessage || !data.ErrorMessage.some(i => i.includes("Timed out"))) {
				await this.setCacheData(key, { data, statusCode }, {
					expiry: 30 * 864e5
				});
			}
		}

		if (statusCode !== 200 || data?.OCRExitCode !== 1) {
			return {
				success: false,
				reply: (data?.ErrorMessage)
					? data.ErrorMessage.join(" ")
					: data
			};
		}

		const result = data.ParsedResults[0].ParsedText;
		if (result.length === 0) {
			return {
				success: false,
				reply: `No text found.`
			};
		}
		else {
			return {
				keepWhitespace: true,
				reply: result
			};
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { names } = values.getStaticData();
		const list = names.map(name => `<li>${sb.Utils.capitalize(name)}</li>`).join("");

		return [
			"Attempts to read a provided image with OCR, and posts the found text in chat.",
			"You can specify a language, and only 3-letter codes are supported, i.e. 'jpn'.",
			"By default, the language is English (eng).",
			"",

			`<code>${prefix}ocr <a href="https://i.imgur.com/FutGrGV.png">https://i.imgur.com/FutGrGV.png</a></code>`,
			"HELLO WORLD LOL NAM",
			"",

			`<code>${prefix}ocr lang:japanese <a href="https://i.imgur.com/4iK4ZHy.png">https://i.imgur.com/4iK4ZHy.png</a></code>`,
			"ロ明寝マンRetweeted 蜜柑すい@mikansul・May11 ティフアに壁ドンされるだけ",
			"",

			`<code>${prefix}ocr (link) force:true</code>`,
			"Since the results of ocr results are cached, use force:true to forcibly run another detection.",
			"",

			"List of supported languages:",
			list
		];
	})
};
