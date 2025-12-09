import { declare } from "../../classes/command.js";

export default declare({
	Name: "wrongsong",
	Aliases: ["ws"],
	Cooldown: 5000,
	Description: "If you have at least one song playing or in the queue, this command will skip the first one. You can also add an ID to skip a specific song.",
	Flags: ["developer", "mention", "pipe", "whitelist"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function wrongSong (context, target) {
		if (!sb.MpvClient) {
			return {
			    success: false,
			    reply: "mpv client is not available! Check configuration if this is required."
			};
		}

		let result;
		if (target) {
			const targetId = Number(target);
			if (!core.Utils.isValidInteger(targetId)) {
				return {
					success: false,
					reply: `Could not parse your provided song ID!`
				};
			}

			result = await sb.MpvClient.removeById(targetId, context.user.ID);
		}
		else {
			result = await sb.MpvClient.removeUserFirst(context.user.ID);
		}

		if (!result.success) {
			return {
				success: false,
				reply: (target)
					? "Target video ID was not found, or it wasn't requested by you!"
					: "You don't currently have any videos in the playlist!"
			};
		}

		const action = (result.order === 0) ? "skipped" : "removed from the playlist";
		return {
			success: true,
			reply: `Your request "${result.name ?? result.url}" (ID ${result.id}) has been successfully ${action}.`
		};
	}),
	Dynamic_Description: (prefix) => [
		"Skips your current or queued song.",
		"Can add an ID to skip/delete a specific song in the queue, queued by you only.",
		"",

		`<code>${prefix}ws</code>`,
		"Skips the earliest request you have playing or in the queue.",
		"",

		`<code>${prefix}ws (ID)</code>`,
		"Skips your request with given ID. Fails if it's not your request."
	]
});
