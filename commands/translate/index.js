module.exports = {
	Name: "translate",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Implicitly translates from auto-recognized language to English. Supports parameters 'from' and 'to'. Example: from:german to:french Guten Tag\",",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function translate (context, ...args) {
		const options = { from: "auto", to: "en", direction: true, confidence: true };
		let fail = { from: null, to: null };
	
		for (let i = args.length - 1; i >= 0; i--) {
			const token = args[i];
			if (/^(from|to):/.test(token)) {
				const [option, lang] = args[i].split(":");
				const newLang = sb.Utils.languageISO.getCode(lang);
	
				if (!newLang) {
					fail[option] = lang;
					continue;
				}
	
				options[option] = newLang.toLowerCase();
				fail[option] = false;
				args.splice(i, 1);
			}
			else if (token === "direction:false") {
				options.direction = false;
				args.splice(i, 1);
			}
			else if (token === "confidence:false") {
				options.confidence = false;
				args.splice(i, 1);
			}
		}
	
		if (fail.from || fail.to) {
			return { reply: `Language "${fail.from || fail.to}" was not recognized!` };
		}
		else if (args.length === 0) {
			return {
				reply: "No text for translation provided!",
				cooldown: 2500
			};
		}
	
		const { body: response, statusCode } = await sb.Got({
			responseType: "json",
			url: "https://translate.googleapis.com/translate_a/single",
			throwHttpErrors: false,
			searchParams: new sb.URLParams()
				.set("client", "gtx")
				.set("dt", "t")
				.set("sl", options.from)
				.set("tl", options.to)
				.set("ie", "UTF-8")
				.set("oe", "UTF-8")
				.set("q", args.join(" "))
				.toString()
		});
	
		if (statusCode === 400) {
			return { 
				success: false,
				reply: "Language not supported" 
			};
		}
		else if (statusCode !== 200) {
			throw new sb.errors.APIError({
				statusCode,
				apiName: "GoogleTranslateAPI"
			});
		}
	
		let reply = response[0].map(i => i[0]).join(" ");
		if (options.direction) {
			const languageID = response[2].replace(/-.*/, "");
			const array = [sb.Utils.capitalize(sb.Utils.languageISO.getName(languageID))];
	
			if (options.confidence && response[6] && response[6] !== 1) {
				const confidence = sb.Utils.round(response[6] * 100, 0) + "%";
				array.push("(" +  confidence + ")");
			}
	
			array.push("->", sb.Utils.capitalize(sb.Utils.languageISO.getName(options.to)));
			reply = array.join(" ") + ": " + reply;
		}
	
		return { reply: reply };
	}),
	Dynamic_Description: null
};