module.exports = {
	Name: "randomgachi",
	Aliases: ["rg"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random gachi track from the gachi list, excluding Bilibili and Nicovideo videos with no Youtube reuploads",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "fav", type: "string" },
		{ name: "linkOnly", type: "boolean" },
		{ name: "type", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		types: {
			youtube: 1,
			soundcloud: 3,
			vimeo: 4,
			nicovideo: 21,
			bilibili: 22,
			"leppunen-archive": 23,
			vk: 23,
			"bepis-archive": 25,
			"leppunen-video-archive": 26
		}
	})),
	Code: (async function randomGachi (context) {
		const prefixRow = await sb.Query.getRow("data", "Video_Type");
		await prefixRow.load(1);

		const targetUserFavourite = context.params.fav ?? null;
		const userDataFavourite = (targetUserFavourite)
			? await sb.User.get(targetUserFavourite)
			: null;

		if (targetUserFavourite && !userDataFavourite) {
			return {
				success: false,
				reply: "No such user exists!"
			};
		}

		const { types } = this.staticData;
		const allowedTypes = (context.params.type) ? context.params.type.split(/\W/) : ["youtube"];
		const typeIDs = allowedTypes.map(i => types[i] ?? null).filter(Boolean);

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
				.where("Track_Tag.Tag IN %n+", [6, 22])
				.groupBy("Track.ID")
				.orderBy("RAND() DESC")
				.single();

			if (typeIDs.length > 0) {
				rs.where("Track.Video_Type IN %n+", typeIDs);
			}
			if (userDataFavourite) {
				rs.where("User_Favourite.User_Alias = %n", userDataFavourite.ID)
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
				reply: `No available YouTube tracks found for given combination of parameters!`
			};
		}

		if (context.params.linkOnly) {
			return {
				reply: `https://youtu.be/${data.TrackLink}`
			};
		}

		const authorList = (data.Authors || "(unknown)").split(",");
		const authors = (authorList.length === 1) ? authorList[0] : "(various)";
		const supiLink = `https://supinic.com/track/detail/${data.TrackID}`;
		const emote = await context.getBestAvailableEmote(["gachiCOOL", "gachiHop", "gachiBASS", "gachiGASM", "pajaVan"], "🤼😩");

		let favouriteString = "your random gachi";
		if (userDataFavourite === context.user) {
			favouriteString = "random gachi from your favourite list";
		}
		else if (userDataFavourite) {
			favouriteString = "random gachi from their favourite list";
		}

		return {
			reply: `Here's ${favouriteString}: "${data.TrackName}" by ${authors} - ${supiLink} ${emote}`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const { types } = this.staticData;
		const list = Object.keys(types).map(i => `<li>${i}</li>`).join("");

		return [
			`Returns a random gachimuchi track from the <a href="/track/gachi/list">track list</a> and the <a href="/track/todo/list">todo list</a>.`,
			"",

			`<code>${prefix}rg</code>`,
			"No arguments - any random track. Only returns YouTube links by default.",
			"",

			`<code>${prefix}rg fav:(user)</code>`,
			"If a provided user (including you) has marked any tracks as their favourites on the website, this will make the command choose only from those favourites.",
			"",

			`<code>${prefix}rg linkOnly:true</code>`,
			"Will only input the link, with no other text. Useful for piping.",
			"",

			`<code>${prefix}rg type:(list of types)</code>`,
			`<code>${prefix}rg type:youtube,nicovideo</code>`,
			`<code>${prefix}rg type:all/code>`,
			"Returns a random track, only from the sites/types that you provided.",
			`If you use "all", all available types will be available at once.`,
			"",

			"List of supported types:",
			`<ul>${list}</ul>`
		];
	})
};
