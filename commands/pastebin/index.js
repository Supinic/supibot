module.exports = {
	Name: "pastebin",
	Aliases: ["pbg", "pbp", "gist"],
	Author: "supinic",
	Cooldown: 30000,
	Description: "Returns the contents of a Pastebin paste, or from a GitHub gist; or posts your input into a new paste.",
	Flags: ["external-input","mention","non-nullable","pipe"],
	Params: [
		{ name: "force", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pastebin (context, command, ...rest) {
		let type;
		const args = [...rest];
		if (command === "get" || context.invocation === "pbg") {
			type = "get";
			if (command && command !== "get") {
				args.unshift(command);
			}
		}
		else if (command === "post" || context.invocation === "pbp") {
			type = "post";
			if (command && command !== "post") {
				args.unshift(command);
			}
		}
		else if (context.invocation === "gist") {
			type = "gist";
			if (command && command !== "get") {
				args.unshift(command);
			}
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
			const result = await sb.Pastebin.post(args.join(" "));
			return {
				success: Boolean(result.success),
				reply: result.error ?? result.body
			};
		}
		else if (type === "gist") {
			const [ID] = args;
			if (!ID) {
				return {
					success: false,
					reply: `No Gist ID provided!`
				};
			}

			let data;
			let cooldown = this.Cooldown;
			const cacheData = (context.params.force) ? null : await this.getCacheData(ID);
			if (cacheData) {
				data = cacheData;
				cooldown = 5000;
			}
			else {
				const response = await sb.Got("GitHub", {
					url: `gists/${ID}`
				});

				if (response.statusCode !== 200) {
					return {
						success: false,
						reply: result.body.message
					};
				}

				const { files } = response.body;
				if (Object.keys(files).length === 0) {
					return {
						success: false,
						reply: `There are no files in this Gist!`
					};
				}
				else if (Object.keys(files).length > 1) {
					return {
						success: false,
						reply: `There are too many files in this Gist! This command only supports single-file Gists.`
					};
				}

				const [file] = Object.values(files);
				if (file.type !== "text/plain" && file.type === "application/javascript") {
					return {
						success: false,
						reply: `Invalid Gist file type! This command only supports text/plain and application/javascript.`
					};
				}

				data = file.content;
				await this.setCacheData(ID, data, {
					expiry: 30 * 864e5
				});
			}

			return {
				cooldown,
				reply: data
			};
		}
		else if (type === "get") {
			const path = sb.Utils.getPathFromURL(args[0]);
			if (!path) {
				return {
					success: false,
					reply: `Invalid Pastebin link provided!`
				};
			}

			let data;
			let cooldown = this.Cooldown;
			const cacheData = (context.params.force) ? null : await this.getCacheData(path);
			if (cacheData) {
				data = cacheData;
				cooldown = 5000;
			}
			else {
				const result = await sb.Pastebin.get(path);
				if (result.success !== true) {
					return {
						success: false,
						reply: result.error ?? result.body
					};
				}

				data = result.body;
				if (!data) {
					return {
						success: false,
						reply: `Could not fetch any data from your paste!`
					};
				}
				else if (data.length >= 50000) {
					data = null;
					return {
						success: false,
						reply: `Paste character limit exceeded! (50 000 characters)`
					};
				}

				await this.setCacheData(path, data, {
					expiry: 30 * 864e5
				});
			}

			return {
				cooldown,
				reply: data
			};
		}
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Gets a paste from Pastebin, or creates a new one with your text.",
			"",

			`<code>${prefix}pastebin get (link)</code>`,
			`<code>${prefix}pbg (link)</code>`,
			"For a specified link or a paste ID, fetches the contents of it.",
			"The output must not be longer than 50 000 characters, for performance reasons. If it is, the paste won't be fetched.",
			"",

			`<code>${prefix}gist (gist ID)</code>`,
			"For a specified Gist ID, fetches its contents.",
			"The Gist must only contain a single text/plain file.",
			"The output must not be longer than 50 000 characters, for performance reasons. If it is, the Gist won't be fetched.",
			"",

			`<code>${prefix}pastebin post (...text)</code>`,
			`<code>${prefix}pbp (...text)</code>`,
			"Creates a new temporary paste for you to see.",
			"The paste is set to only be available for 10 minutes from posting, then it is deleted.",
			"",

			`<code>${prefix}pastebin get (link) force:true</code>`,
			`<code>${prefix}pbg (link) force:true</code>`,
			"Since the results of fetching pastes are cached, use force:true to forcibly fetch the current status of the paste."
		];
	})
};