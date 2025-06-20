import { VIDEO_TYPE_REPLACE_PREFIX } from "../../utils/command-utils.js";

export default {
	Name: "trackreupload",
	Aliases: ["tr"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Sets a track ID in the list already to have the next track as a reupload. The next track can be an existing ID (if it's not a reupload already) or a new link, in which case it gets added to the list.",
	Flags: ["developer","mention","pipe","whitelist"],
	Params: [],
	Whitelist_Response: "Only available for people who know what they're doing Kappa",
	Code: (async function trackReload (extra, existingID, reuploadLink) {
		existingID = Number(existingID);

		if (!core.Utils.isValidInteger(existingID)) {
			return { reply: "First argument must be positive finite integer!" };
		}
		else if (!reuploadLink) {
			return { reply: "Second argument must either be positive finite integer or a link!" };
		}

		const reuploadCheck = Number(reuploadLink);
		if (core.Utils.isValidInteger(reuploadCheck)) {
			const row = await core.Query.getRecordset(rs => rs
				.select("Link")
				.select("Link_Prefix")
				.from("music", "Track")
				.join("data", "Video_Type")
				.where("Track.ID = %n", reuploadCheck)
				.single()
			);

			if (!row) {
				return { reply: "Given reupload ID does not exist!" };
			}

			reuploadLink = row.Link_Prefix.replace(VIDEO_TYPE_REPLACE_PREFIX, row.Link);
		}

		const result = await core.Got.get("Supinic")({
			method: "POST",
			url: "track/reupload",
			searchParams: { reuploadLink, existingID }
		}).json();

		return {
			reply: `Result: ${result.data.message}.`
		};
	}),
	Dynamic_Description: null
};
