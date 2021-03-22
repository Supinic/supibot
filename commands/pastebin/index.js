module.exports = {
	Name: "pastebin",
	Aliases: ["pbg", "pbp"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "Takes the result of a different command (pipe-only) and posts a Pastebin paste with it.",
	Flags: ["mention","non-nullable","pipe"],
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
			if (command !== "get") {
				args.unshift(command);
			}
		}
		else if (command === "post" || context.invocation === "pbp") {
			type = "post";
			if (command !== "post") {
				args.unshift(command);
			}
		}
		else {
			const prefix = sb.Command.prefix;
			return {
				success: false,
				reply: `No valid type provided! Use ${prefix}pastebin (fetch/post) or ${prefix}pbf/pbp instead`
			};
		}

		if (args.length === 0) {
			return {
				success: false,
				reply: "No input provided!"
			};
		}

		if (type === "post") {
			return {
				reply: await sb.Pastebin.post(args.join(" "))
			};
		}
		else if (type === "get") {
			const path = sb.Utils.getPathFromURL(args[0]);
			if (!path) {
				return {
					success: false,
					reply: `Invalid Pastebin link provided! `
				};
			}

			let data;
			const cacheData = (context.params.force) ? null : await this.getCacheData(path);
			if (cacheData) {
				data = cacheData;
			}
			else {
				data = await sb.Pastebin.get(path);
				await this.setCacheData(path, data, {
					expiry: 30 * 864e5
				});
			}

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

			return {
				reply: data
			};
		}
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			"Gets a paste from Pastebin, or creates a new one with your text.",
			"",

			`<code>${prefix}pastebin get (link)`,
			`<code>${prefix}pbg (link)`,
			"For a specified link or a paste ID, fetches the contents of it.",
			"The output must not be longer than 50 000 characters, for performance reasons. If it is, the paste won't be fetched.",
			"",

			`<code>${prefix}pastebin post (...text)`,
			`<code>${prefix}pbp (...text)`,
			"Creates a new temporary paste for you to see.",
			"The paste is set to only be available for 10 minutes from posting, then it is deleted.",
			"",

			`<code>${prefix}pastebin get (link) force:true`,
			`<code>${prefix}pbg (link) force:true`,
			"Since the results of fetching pastes are cached, use force:true to forcibly fetch the current status of the paste."
		];
	})
};