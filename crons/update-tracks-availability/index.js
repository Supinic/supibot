module.exports = {
	Name: "update-tracks-availability",
	Expression: "0 0 12 7,21 * *",
	Description: "Updates the \"Available\" status of all music tracks in the database",
	Defer: null,
	Type: "Website",
	Code: (async function updateTracksAvailability () {
		const videoIDs = await sb.Query.getRecordset(rs => rs
			.select("Track.ID AS ID", "Link", "Available", "Video_Type.Type AS Type")
			.from("music", "Track")
			.join({
				toDatabase: "data",
				toTable: "Video_Type",
				toField: "ID",
				fromField: "Video_Type"
			})
		);

		const youtubeIDs = videoIDs.filter(i => i.Type === "yt");
		for (const track of youtubeIDs) {
			const trackData = await sb.Utils.modules.linkParser.fetchData(track.Link, "youtube");
			if ((trackData && track.Available) || (!trackData && !track.Available)) {
				continue;
			}

			const row = await sb.Query.getRow("music", "Track");
			await row.load(track.ID);

			row.values.Available = Boolean(trackData);
			await row.save({ skipLoad: true });
		}
	})
};
