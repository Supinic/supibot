const { getPathFromURL, postToPastebin } = require("../../utils/command-utils.js");
const validateHastebinServer = require("./validate-hastebin.js");

const BASE_HASTEBIN_SERVER = "https://haste.zneix.eu";
const ALLOWED_GIST_TYPES = ["text/plain", "text/javascript", "application/javascript"];
const TEXT_LENGTH_LIMIT = 50_000;

const getHastebinServer = (param) => {
	let path = param ?? BASE_HASTEBIN_SERVER;
	if (!path.startsWith("http://") && !path.startsWith("https://")) {
		path = `https://${path}`;
	}

	let url;
	try {
		url = new URL(path);
	}
	catch {
		return null;
	}

	return url.hostname;
};

module.exports = {
	Name: "pastebin",
	Aliases: ["pbg", "pbp", "gist", "hbg", "hbp"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Returns the contents of a Pastebin/Hastebin paste, or from a GitHub gist; or posts your input into a new paste.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "hasteServer", type: "string" },
		{ name: "force", type: "boolean" },
		{ name: "gistUser", type: "string" },
		{ name: "raw", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: async function pastebin (context, command, ...rest) {
		let type;
		let provider;
		const rawArgs = [...rest];

		if (!command) {
			return {
				success: false,
				reply: `No input provided!`
			};
		}

		if (command === "get" || context.invocation === "pbg") {
			provider = "pastebin";
			type = "get";
			if (command && command !== "get") {
				rawArgs.unshift(command);
			}
		}
		else if (command === "post" || context.invocation === "pbp") {
			provider = "pastebin";
			type = "post";
			if (command && command !== "post") {
				rawArgs.unshift(command);
			}
		}
		else if (context.invocation === "gist") {
			provider = "gist";
			type = "get";
			rawArgs.unshift(command);
		}
		else if (context.invocation.startsWith("hb")) {
			type = (context.invocation.endsWith("g")) ? "get" : "post";
			provider = "hastebin";
			rawArgs.unshift(command);
		}
		else {
			const prefix = sb.Command.prefix;
			return {
				success: false,
				reply: `No valid type provided! Use ${prefix}pastebin (get/post) or ${prefix}pbg/pbp instead`
			};
		}

		const args = rawArgs.filter(Boolean);
		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		if (type === "post") {
			const rawString = (context.params.raw ?? true) ? "raw/" : "";
			const text = args.join(" ");

			if (provider === "pastebin") {
				const paste = await postToPastebin(text);
				if (paste.ok) {
					return {
						reply: paste.link
					};
				}
				else {
					return {
						success: false,
						reply: paste.reason
					};
				}
			}
			else if (provider === "hastebin") {
				const server = getHastebinServer(context.params.hasteServer);
				if (!server) {
					return {
						success: false,
						reply: `Invalid custom Hastebin server provided!`
					};
				}
				else if (server === "hastebin.com" && context.params.raw === false) {
					return {
						success: false,
						reply: `Cannot use ${server} with the raw:false parameter! The link would redirect you to Toptal instead.`
					};
				}

				let response;
				try {
					response = await sb.Got.get("GenericAPI")({
						method: "POST",
						url: `https://${server}/documents`,
						throwHttpErrors: false,
						body: text
					});
				}
				catch {
					response = null;
				}

				if (!response || response.statusCode !== 200) {
					return {
						success: false,
						reply: `Could not create a paste on ${server}!`
					};
				}

				return {
					reply: `https://${server}/${rawString}${response.body.key}`
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
			let userInput = args[0];
			if (provider === "gist" && context.params.gistUser) {
				const escapedUser = encodeURI(context.params.gistUser);
				const response = await sb.Got.get("GitHub")({
					url: `users/${escapedUser}/gists`,
					throwHttpErrors: false
				});

				if (response.statusCode === 404) {
					return {
						success: false,
						reply: `Provided user does not exist on GitHub!`
					};
				}
				else if (response.statusCode !== 200) {
					return {
						success: false,
						reply: `GitHub error: ${response.body.message}`
					};
				}

				/** @type {Array} */
				const gists = response.body;
				const eligibleGists = gists.filter(gist => {
					const eligibleFiles = Object.values(gist.files).filter(i => ALLOWED_GIST_TYPES.includes(i.type));
					return (eligibleFiles.length === 1);
				});

				if (eligibleGists.length === 0) {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							That user does not have any Gists I can use!							
							A Gist valid for this command must use exactly one file of one of these types:
							${ALLOWED_GIST_TYPES.join(", ")}
						`
					};
				}

				const randomUserGist = sb.Utils.randArray(eligibleGists);
				userInput = randomUserGist.id;
			}

			const id = getPathFromURL(userInput) || userInput;
			if (!id) {
				return {
					success: false,
					reply: `No file/paste ID provided!`
				};
			}

			const cacheKey = `${context.params.hasteServer ?? provider}-${id}`;
			const cacheData = (context.params.force) ? null : await this.getCacheData(cacheKey);
			if (cacheData) {
				return {
					reply: cacheData,
					cooldown: 5000
				};
			}

			let textData;
			if (provider === "pastebin") {
				const response = await sb.Got.get("GenericAPI")({
					url: `https://pastebin.com/raw/${id}`,
					throwHttpErrors: false,
					responseType: "text",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded"
					}
				});

				if (!response.ok) {
					return {
						success: false,
						reply: (response.statusCode === 403)
							? "This is a private paste or it is pending moderation!"
							: "Error while getting the paste!"
					};
				}

				textData = response.body;
			}
			else if (provider === "hastebin") {
				const server = getHastebinServer(context.params.hasteServer);
				if (!server) {
					return {
						success: false,
						reply: `Invalid custom Hastebin server provided!`
					};
				}

				const isValid = await validateHastebinServer(this, server);
				if (isValid === false) {
					return {
						success: false,
						reply: `Provided server is not a valid Hastebin server!`
					};
				}
				else if (isValid === null) {
					return {
						success: false,
						reply: `Provided server is currently not available!`
					};
				}

				const response = await sb.Got.get("GenericAPI")({
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
				const response = await sb.Got.get("GitHub")({
					url: `gists/${id}`
				});

				if (response.statusCode === 403) {
					const reset = response.headers["x-ratelimit-reset"];
					const resetDate = new Date(Number(reset) * 1000);

					return {
						success: false,
						reply: `Too many requests have been used recently! Try again ${sb.Utils.timeDelta(resetDate)}.`
					};
				}
				else if (response.statusCode !== 200) {
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

				const eligibleFiles = Object.values(files).filter(i => ALLOWED_GIST_TYPES.includes(i.type));
				if (eligibleFiles.length === 0) {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							No eligible files found in this Gist!
							Use exactly one file of one of these types:
							${ALLOWED_GIST_TYPES.join(", ")}
						 `
					};
				}
				else if (eligibleFiles.length > 1) {
					return {
						success: false,
						reply: sb.Utils.tag.trim `
							Too many eligible files found in this Gist!
							Use exactly one file of one of these types:
							${ALLOWED_GIST_TYPES.join(", ")}
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
			else if (textData.length > TEXT_LENGTH_LIMIT) {
				return {
					success: false,
					reply: sb.Utils.tag.trim `
						File/paste character limit exceeded!
						(${sb.Utils.groupDigits(TEXT_LENGTH_LIMIT)} characters)
					`
				};
			}

			await this.setCacheData(cacheKey, textData, {
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
	},
	Dynamic_Description: async function () {
		const threshold = sb.Utils.groupDigits(TEXT_LENGTH_LIMIT);
		return [
			"Gets or creates a new text paste on Pastebin or Hastebin; or fetches one from Gist.",
			`When fetching existing text, the output must not be longer than ${threshold} characters, for performance reasons.`,
			"If it is, the file/paste won't be fetched, and an error is returned instead.",
			"",

			"<h5> Pastebin </h5>",

			`<code>$pastebin get (link)</code>`,
			`<code>$pbg (link)</code>`,
			"Fetches the contents of a specified Pastebin paste via ID or link.",
			"",

			`<code>$pastebin post (...text)</code>`,
			`<code>$pbp (...text)</code>`,
			"Creates a new temporary paste for you to use.",
			"The paste is set to only be available for 10 minutes from posting, then it is deleted.",
			"",

			"<h5> Hastebin </h5>",

			`<code>$hbg (link)</code>`,
			`<code>$hbg (link) hasteServer:(custom Hastebin URL)</code>`,
			"Fetches the contents of a specified Hastebin haste via ID or link.",
			"Uses hastebin.com by default - but can use a specific custom instance of Hastebin via the <code>hasteServer</code> parameter.",
			"",

			`<code>$hbp (...text)</code>`,
			`<code>$hbp (...text) hasteServer:(custom Hastebin URL)</code>`,
			"Creates a new temporary haste for you to see.",
			"Uses hastebin.com by default - but can use a specific custom instance of Hastebin via the <code>hasteServer</code> parameter.",
			"",

			"<h5> GitHub Gist </h5>",

			`<code>$gist (gist ID)</code>`,
			"Fetches the contents of a specified GitHub Gist paste via its ID.",
			"The Gist must only contain a single text/plain or Javascript file.",
			"",

			`<code>$gist gistUser:(username)</code>`,
			"Fetches the contents of a randomg GitHub Gist owned by the provided user.",
			"This will automatically filter out all Gists that don't contain a single text/plain or Javascript file.",
			"",

			"<h5> Other arguments </h5>",

			`<code>$pbp (text) raw:false</code>`,
			`<code>$hbp (text) raw:false</code>`,
			`<code>$hbp (text) raw:false hasteServer:(custom Hastebin URL)</code>`,
			"This command will post \"raw\" paste links, which only contain the text, rather than the website's layout.",
			"If you would like to receive a proper link, use <code>raw:false</code> as this parameter is <code>true</code> by default!",
			"",

			`<code>$pastebin get (link) force:true</code>`,
			`<code>$pbg (link) force:true</code>`,
			`<code>$hbg (link)</code>`,
			`<code>$hbg (link) hasteServer:(custom Hastebin URL)</code>`,
			`<code>$gist (gist ID) force:true</code>`,
			"Since the results of all fetching (pastebin, hastebin, gist) are cached, use <code>force:true</code> to forcibly fetch the current status of the paste."
		];
	}
};
