module.exports = {
	Name: "randomgachi",
	Aliases: ["rg"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random gachi track from the gachi list, excluding Bilibili and Nicovideo videos with no Youtube reuploads",
	Flags: ["link-only","mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "fav", type: "string" },
		{ name: "favorite", type: "string" },
		{ name: "favourite", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomGachi (context) {
		const prefixRow = await sb.Query.getRow("data", "Video_Type");
		await prefixRow.load(1);
	
		const targetUserFavourite = context.params.favourite ?? context.params.favorite ?? context.params.fav ?? null;
		const userFavourites = (targetUserFavourite)
			? await sb.User.get(targetUserFavourite)
			: null;
	
		if (targetUserFavourite && !userFavourites) {
			return {
				success: false,
				reply: "No such user exists!"
			};
		}
	
		const data = await sb.Query.getRecordset(rs => {
			rs.select("Track.ID AS TrackID, Track.Name AS TrackName, Track.Link AS TrackLink")
				.select("GROUP_CONCAT(Author.Name SEPARATOR ',') AS Authors")
				.from("music", "Track")
				.leftJoin({
					toDatabase: "music",
					toTable: "Track_Tag",
					on: "Track_Tag.Track = Track.ID"
				})
				.leftJoin({
					toDatabase: "music",
					toTable: "Track_Author",
					on: "Track_Author.Track = Track.ID"
				})
				.leftJoin({
					toDatabase: "music",
					toTable: "Author",
					on: "Author.ID = Track_Author.Author"
				})
				.where("Available = %b", true)
				// .where("Track.Video_Type = %n", 1)
				.where("Track_Tag.Tag IN %n+", [6, 22])
				.groupBy("Track.ID")
				.orderBy("RAND() DESC")
				.single();
	
			if (userFavourites) {
				rs.where("User_Favourite.User_Alias = %n", userFavourites.ID)
					.where("User_Favourite.Active = %b", true)
					.join({
						toTable: "User_Favourite",
						on: "User_Favourite.Track = Track.ID"
					});
			}
	
			return rs;
		});
		if (!data) {
			return {
				success: false,
				link: null,
				reply: `No available YouTube tracks found for given combination of parameters!`
			};
		}
	
		const authorList = (data.Authors || "(unknown)").split(",");
		const authors = (authorList.length === 1) ? authorList[0] : "(various)";
		const supiLink = "https://supinic.com/track/detail/" + data.TrackID;
	
		return {
			link: `https://youtu.be/${data.TrackLink}`,
			reply: `Here's your random gachi: "${data.TrackName}" by ${authors} - ${supiLink} gachiGASM`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		return [
			`Returns a random gachimuchi track from the <a href="/track/gachi/list">track list</a>.`,
			"",
			
			`<code>${prefix}rg</code>`,
			"No arguments - any random track",
			"",
	
			`<code>${prefix}rg favourite:(user)</code>`,
			"If a provided user (including you) has marked any tracks as their favourites on the website, this will make the command choose only from those favourites.",
			"",
	
			`<code>${prefix}rg linkOnly:true</code>`,
			"Will only input the link, with no other text. Useful for piping.",
			"<b>Note:</b>When you pipe this command, <code>linkOnly</code> is used by default."		
		]
	})
};