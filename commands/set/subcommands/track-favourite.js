const { getLinkParser } = require("../../../utils/link-parser.js");

const fetchTrackIDs = async (tracks) => {
	const linkParser = await getLinkParser();
	const stringIDs = tracks.map(i => {
		const type = linkParser.autoRecognize(i);
		if (!type) {
			return null;
		}

		return linkParser.parseLink(i, "auto");
	}).filter(Boolean);

	if (stringIDs.length === 0) {
		return [];
	}

	return await sb.Query.getRecordset(rs => rs
		.select("ID")
		.from("music", "Track")
		.where("Link IN %s+", stringIDs)
		.flat("ID")
	);
};

const updateTrackFavouriteStatus = async (context, IDs, status) => {
	for (const ID of IDs) {
		const row = await sb.Query.getRow("music", "User_Favourite");
		await row.load({
			User_Alias: context.user.ID,
			Track: ID
		}, true);

		if (!row.loaded) {
			row.setValues({
				User_Alias: context.user.ID,
				Track: ID
			});
		}

		row.values.Active = status;
		await row.save({ skipLoad: true });
	}
};

export default {
	name: "trackfavourite",
	aliases: ["tf", "track-fav", "trackfavorite", "track-favourite", "track-favorite"],
	parameter: "arguments",
	description: `Lets you favourite a track in Supinic's track list from chat. Not toggleable, only sets the favourite. You can unset or check the favourite on the website. https://supinic.com/track/gachi/list`,
	flags: {
		pipe: true
	},
	set: async (context, ...args) => {
		const IDs = await fetchTrackIDs(args);
		await updateTrackFavouriteStatus(context, IDs, true);

		return {
			reply: `Successfully set ${IDs.length} track(s) as your favourite.`
		};
	},
	unset: async (context, ...args) => {
		const IDs = await fetchTrackIDs(args);
		await updateTrackFavouriteStatus(context, IDs, false);

		return {
			reply: `Successfully unset ${IDs.length} track(s) as your favourite.`
		};
	}
};
