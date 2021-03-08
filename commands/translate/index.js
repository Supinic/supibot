module.exports = {
	Name: "translate",
	Aliases: null,
	Author: "supinic",
	Cooldown: 15000,
	Description: "Implicitly translates from auto-recognized language to English. Supports parameters 'from' and 'to'. Example: from:german to:french Guten Tag\",",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "confidence", type: "boolean" },
		{ name: "direction", type: "boolean" },
		{ name: "from", type: "string" },
		{ name: "to", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function translate (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No text for translation provided!",
				cooldown: 2500
			};
		}

		const options = {
			from: "auto",
			to: "en",
			direction: context.params.direction ?? true,
			confidence: context.params.confidence ?? true
		};
	
		for (const option of ["from", "to"]) {
			const lang = context.params[option];
			if (!lang) {
				continue;
			}

			const newLang = sb.Utils.languageISO.get(lang);
			const code = newLang?.iso6391 ?? newLang?.iso6392 ?? null;
			if (!code) {
				return {
					success: false,
					reply: `Language "${lang}" was not recognized!`
				};
			}
	
			options[option] = code.toLowerCase();
		}
	
		const response = await sb.Got("GenericAPI", {
			url: "https://translate.googleapis.com/translate_a/single",
			searchParams: {
				client: "gtx",
				dt: "t",
				ie: "UTF-8",
				oe: "UTF-8",
				sl: options.from,
				tl: options.to,
				q: args.join(" ")
			},
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36"
			}
		});
	
		let reply = response.body[0].map(i => i[0]).join(" ");
		if (options.direction) {
			const languageID = response[2].replace(/-.*/, "");
			const fromLanguageName = sb.Utils.languageISO.getName(languageID);
			if (!fromLanguageName) {
				console.warn("$translate - could not get language name", { response, reply, options, languageID });
				return {
					success: false,
					reply: "Language code could not be translated into a name! Please let @Supinic know about this :)"
				};
			}
	
			const array = [sb.Utils.capitalize(fromLanguageName)];
			if (options.confidence && response[6] && response[6] !== 1) {
				const confidence = sb.Utils.round(response[6] * 100, 0) + "%";
				array.push("(" +  confidence + ")");
			}
	
			array.push("->", sb.Utils.capitalize(sb.Utils.languageISO.getName(options.to)));
			reply = array.join(" ") + ": " + reply;
		}
	
		return { reply };
	}),
	Dynamic_Description: null
};