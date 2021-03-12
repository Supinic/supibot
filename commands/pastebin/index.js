module.exports = {
	Name: "pastebin",
	Aliases: ["pbf", "pbp"],
	Author: "supinic",
	Cooldown: 20000,
	Description: "Takes the result of a different command (pipe-only) and posts a Pastebin paste with it.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function pastebin (context, command, ...rest) {
		let type;
		const args = [...rest];
		if (command === "fetch" || context.invocation === "pbf") {
			type = "get";
			if (command !== "fetch") {
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
		else if (type === "fetch") {
			const path = sb.Utils.getPathFromURL(args[0]);

			let data = await sb.Pastebin.get(path);
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
	Dynamic_Description: null
};