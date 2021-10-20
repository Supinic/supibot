module.exports = {
	Name: "pastebin",
	Aliases: ["pbg", "pbp", "gist", "hbg", "hbp"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Returns the contents of a Pastebin paste, or from a GitHub gist; or posts your input into a new paste.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "hasteServer", type: "string" },
		{ name: "force", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		allowedGistTypes: ["text/plain", "application/javascript"],
		getHastebinServer: (param) => {
			let path = param ?? "https://hastebin.com";
			if (!path.startsWith("http://") && !path.startsWith("https://")) {
				path = `https://${path}`;
			}

			const { URL } = require("url");
			let url;
			try {
				url = new URL(path);
			}
			catch {
				return null;
			}

			return url.hostname;
		},
		textDataCharacterThreshold: 50_000
	})),
	Code: (async function pastebin (context, command, ...rest) {
		let type;
		let provider;
		const args = [...rest];

		if (command === "get" || context.invocation === "pbg") {
			provider = "pastebin";
			type = "get";
			if (command && command !== "get") {
				args.unshift(command);
			}
		}
		else if (command === "post" || context.invocation === "pbp") {
			provider = "pastebin";
			type = "post";
			if (command && command !== "post") {
				args.unshift(command);
			}
		}
		else if (context.invocation === "gist") {
			provider = "gist";
			type = "get";
			args.unshift(command);
		}
		else if (context.invocation.startsWith("hb")) {
			type = (context.invocation.endsWith("g")) ? "get" : "post";
			provider = "hastebin";
			args.unshift(command);
		}
		else {
			const prefix = sb.Command.prefix;
			return {
				success: false,
				reply: `No valid type provided! Use ${prefix}pastebin (get/post) or ${prefix}pbg/pbp instead`
			};
		}

		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		if (type === "post") {
			const text = args.join(" ");

			if (provider === "pastebin") {
				const result = await sb.Pastebin.post(text);
				return {
					success: Boolean(result.success),
					reply: result.error ?? result.body
				};
			}
			else if (provider === "hastebin") {
				const server = this.staticData.getHastebinServer(context.params.hasteServer);
				if (!server) {
					return {
						success: false,
						reply: `Invalid custom Hastebin server provided!`
					};
				}

				const response = await sb.Got("GenericAPI", {
					method: "POST",
					url: `https://${server}/documents`,
					throwHttpErrors: false,
					body: text
				});

				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: `Could not create a paste on ${server}!`
					};
				}

				return {
					reply: `https://${server}/${response.body.key}`
				};
			}
			else {
				return {
					success: false,
					reply: `Cannot create new files/pastes with ${sb.Utils.capitalize(provider)}!`
				};
			}
		}
		else if (type === "get") {
			const id = sb.Utils.getPathFromURL(args[0]);
			if (!id) {
				return {
					success: false,
					reply: `No file/paste ID provided!`
				};
			}

			const cacheData = (context.params.force) ? null : await this.getCacheData(id);
			if (cacheData) {
				return {
					reply: cacheData,
					cooldown: 5000
				};
			}

			let textData;
			if (provider === "pastebin") {
				const result = await sb.Pastebin.get(id);
				if (result.success !== true) {
					return {
						success: false,
						reply: result.error ?? result.body
					};
				}

				textData = result.body;
			}
			else if (provider === "hastebin") {
				const server = this.staticData.getHastebinServer(context.params.hasteServer);
				if (!server) {
					return {
						success: false,
						reply: `Invalid custom Hastebin server provided!`
					};
				}

				const response = await sb.Got("GenericAPI", {
					method: "GET",
					url: `https://${server}/raw/${id}`,
					throwHttpErrors: false,
					responseType: "text"
				});

				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: `Could not fetch a paste from ${server}!`
					};
				}

				textData = response.body;
			}
			else if (provider === "gist") {
				const response = await sb.Got("GitHub", {
					url: `gists/${id}`
				});

				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: response.body.message
					};
				}

				const { files } = response.body;
				if (Object.keys(files).length === 0) {
					return {
						success: false,
						reply: `There are no files in this Gist!`
					};
				}

				const { allowedGistTypes } = this.staticData;
				const eligibleFiles = Object.values(files).filter(i => allowedGistTypes.includes(i.type));

				if (eligibleFiles.length === 0) {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							No eligible files found in this Gist!
							Use exactly one file of one of these types: ${allowedGistTypes.join(", ")}
						 `
					};
				}
				else if (eligibleFiles.length > 1) {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							Too many eligible files found in this Gist!
							Use exactly one file of one of these types: ${allowedGistTypes.join(", ")}
						`
					};
				}

				textData = eligibleFiles[0].content;
			}
			else {
				return {
					success: false,
					reply: `Cannot fetch existing files/pastes with ${sb.Utils.capitalize(provider)}!`
				};
			}

			if (!textData) {
				return {
					success: false,
					reply: `No text data found in your file/paste!`
				};
			}
			else if (textData.length > this.staticData.textDataCharacterThreshold) {
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						File/paste character limit exceeded!
						(${sb.Utils.groupDigits(this.staticData.textDataCharacterThreshold)} characters)
					`
				};
			}

			await this.setCacheData(id, textData, {
				expiry: 30 * 864e5 // 30 days
			});

			return {
				reply: textData
			};
		}
		else {
			return {
				success: false,
				reply: `Invalid operation provided!`
			};
		}
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { textDataCharacterThreshold } = values.getStaticData();
		const threshold = sb.Utils.groupDigits(textDataCharacterThreshold);

		return [
			"Gets or creates a new text paste on Pastebin or Hastebin; or fetches one from Gist.",
			`When fetching existing text, the output must not be longer than ${threshold} characters, for performance reasons.`,
			"If it is, the file/paste won't be fetched, and an error is returned instead.",
			"",

			"<h5> Pastebin </h5>",

			`<code>${prefix}pastebin get (link)</code>`,
			`<code>${prefix}pbg (link)</code>`,
			"Fetches the contents of a specified Pastebin paste via ID or link.",
			"",

			`<code>${prefix}pastebin post (...text)</code>`,
			`<code>${prefix}pbp (...text)</code>`,
			"Creates a new temporary paste for you to use.",
			"The paste is set to only be available for 10 minutes from posting, then it is deleted.",
			"",

			"<h5> Hastebin </h5>",

			`<code>${prefix}hbg (link)</code>`,
			`<code>${prefix}hbg (link) hasteServer:(custom Hastebin URL)</code>`,
			"Fetches the contents of a specified Hastebin haste via ID or link.",
			"Uses hastebin.com by default - but can use a specific custom instance of Hastebin via the <code>hasteServer</code> parameter.",
			"",

			`<code>${prefix}hbp (...text)</code>`,
			`<code>${prefix}hbp (...text) hasteServer:(custom Hastebin URL)</code>`,
			"Creates a new temporary haste for you to see.",
			"Uses hastebin.com by default - but can use a specific custom instance of Hastebin via the <code>hasteServer</code> parameter.",
			"",

			"<h5> GitHub Gist </h5>",

			`<code>${prefix}gist (gist ID)</code>`,
			"Fetches the contents of a specified GitHub Gist paste via its ID.",
			"The Gist must only contain a single text/plain or Javascript file.",
			"",

			"<h5> Caching </h5>",

			`<code>${prefix}pastebin get (link) force:true</code>`,
			`<code>${prefix}pbg (link) force:true</code>`,
			`<code>${prefix}hbg (link)</code>`,
			`<code>${prefix}hbg (link) hasteServer:(custom Hastebin URL)</code>`,
			`<code>${prefix}gist (gist ID) force:true</code>`,
			"Since the results of all fetching (pastebin, hastebin, gist) are cached, use <code>force:true</code> to forcibly fetch the current status of the paste."
		];
	})
};
