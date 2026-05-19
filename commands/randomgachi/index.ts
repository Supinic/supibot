import { declare } from "../../classes/command.js";

type GachiData = {
	id: number;
	name: string;
	link: string;
	authors: string | null;
};

export default declare({
	Name: "randomgachi",
	Aliases: ["rg"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Fetches a random gachi track from the gachi list, excluding Bilibili and Nicovideo videos with no YouTube reuploads.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [{ name: "linkOnly", type: "boolean" }],
	Whitelist_Response: null,
	Code: (async function randomGachi (context) {
		const data = await core.Query.getRecordset<GachiData | null>(rs => rs
			.select("Track.ID AS id, Track.Name AS name, Track.Link AS link")
			.select("GROUP_CONCAT(Author.Name SEPARATOR ',') AS authors")
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
			.where("Type = %n", 1)
			.where("Available = %b", true)
			.where("Track_Tag.Tag IN %n+", [6, 22])
			.groupBy("Track.ID")
			.orderBy("RAND() DESC")
			.single()
		);

		if (!data) {
			return {
				success: false,
				reply: `Couldn't find any gachi for your query!`
			};
		}

		if (context.params.linkOnly) {
			return {
				success: true,
				reply: `https://youtu.be/${data.link}`
			};
		}

		const authorList = (data.authors || "(unknown)").split(",");
		const authors = (authorList.length === 1) ? authorList[0] : "(various)";
		const supiLink = `https://supinic.com/track/detail/${data.id}`;
		const emote = await context.getBestAvailableEmote(["gachiCOOL", "gachiHop", "gachiBASS", "gachiGASM", "pajaVan"], "🤼😩");

		return {
			success: true,
			reply: `Here's your random gachi: "${data.name}" by ${authors} - ${supiLink} ${emote}`
		};
	}),
	Dynamic_Description: (prefix) => [
		`Returns a random gachimuchi track from the <a href="/track/gachi/list">track list</a> and the <a href="/track/todo/list">todo list</a>.`,
		"",

		`<code>${prefix}rg</code>`,
		"No arguments - any random track. Only returns YouTube links by default.",
		"",

		`<code>${prefix}rg linkOnly:true</code>`,
		"Will only respond with the video link, no other text included. Useful for piping."
	]
});
