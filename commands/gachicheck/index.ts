import { SupiDate, SupiError } from "supi-core";
import type { ParserName } from "track-link-parser";
import { postToHastebin } from "../../utils/command-utils.js";
import getLinkParser from "../../utils/link-parser.js";
import { declare } from "../../classes/command.js";
import type { Channel } from "../../classes/channel.js";

type Track = {
	ID: number;
	Link: string;
	Name: string;
	Added_By: number | null;
	Added_On: SupiDate | null;
	Video_Type: number;
	Available: boolean;
	Published: SupiDate | null;
	Duration: number | null;
	Track_Type: "Single" | "Collaboration" | "Reupload" | "Audio archive" | "Video archive" | null;
	Notes: string | null;
};
type Author = {
	ID: number;
}
type TrackAuthor = {
	Track: Track["ID"];
	Author: Author["ID"];
	Role: string;
	Added_By: number | null;
};

type TrackTag = {
	Track: Track["ID"];
	Tag: number;
	Added_By: number | null;
	Notes: string | null;
};

const trackToLink = (channel: Channel | null, id: number) => (!channel || channel.Links_Allowed)
	? `https://supinic.com/track/detail/${id}`
	: `track list ID ${id}`;

let typeMap: Record<ParserName, number> | null = null;
const getVideoTypes = async () => {
	if (!typeMap) {
		const typeData = await core.Query.getRecordset<{ ID: number; Parser_Name: ParserName; }[]>(rs => rs
			.select("ID", "Parser_Name")
			.from("data", "Video_Type")
			.where("Parser_Name IS NOT NULL")
		);

		typeMap = Object.fromEntries(typeData.map(i => [i.Parser_Name, i.ID])) as Record<ParserName, number>;
	}

	return typeMap;
};

export default declare({
	Name: "gachicheck",
	Aliases: ["gc"],
	Cooldown: 2500,
	Description: "Checks if a given gachi link exists in the database, if not, adds it to the to-do list to be processed later.",
	Flags: ["mention", "pipe", "skip-banphrase"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function gachiCheck (context, ...args) {
		if (args.length === 0) {
			return {
				reply: "No input provided!",
				cooldown: { length: 2500 }
			};
		}

		const linkParser = await getLinkParser();
		const links = [];
		const fixedArgs = args.flatMap(i => i.split(/\s+/).filter(Boolean));
		for (const word of fixedArgs) {
			const type = linkParser.autoRecognize(word);
			if (!type) {
				continue;
			}

			const link = linkParser.parseLink(word);
			if (link) {
				links.push({ type, link });
			}
		}

		if (links.length === 0) {
			return {
				reply: "No valid links provided!",
				cooldown: { length: 2500 }
			};
		}

		const results = [];
		const uniqueLinks = links.filter((item, ind, arr) => {
			const index = arr.findIndex(i => item.link === i.link);
			return (index === ind);
		});

		for (const { link, type } of uniqueLinks) {
			const videoData = await linkParser.fetchData(link, type);
			if (!videoData) {
				results.push({
					link,
					existing: false,
					ID: null,
					formatted: `Video not available - it is deleted or private.`
				});

				continue;
			}

			const existingId = await core.Query.getRecordset<number | undefined>(rs => rs
				.select("ID")
				.from("music", "Track")
				.where("Link = %s", String(videoData.ID))
				.single()
				.flat("ID")
			);

			if (existingId) {
				const tagData = await core.Query.getRecordset<string[]>(rs => rs
					.select("Tag.Name AS Tag_Name")
					.from("music", "Track_Tag")
					.join("music", {
						raw: "music.Tag ON Tag.ID = Track_Tag.Tag"
					})
					.where("Track_Tag.Track = %n", existingId)
					.flat("Tag_Name")
				);

				const tags = tagData.join(", ");
				const row = await core.Query.getRow<Track>("music", "Track");
				await row.load(existingId);

				const added = { name: "(unknown)", date: "(unknown time ago)" };
				if (row.values.Added_By) {
					const userData = await sb.User.getAsserted(row.values.Added_By);
					added.name = userData.Name;
				}
				if (row.values.Added_On) {
					added.date = core.Utils.timeDelta(row.values.Added_On);
				}

				results.push({
					link,
					existing: true,
					ID: existingId,
					formatted: core.Utils.tag.trim `
						Link is in the list already:
						${trackToLink(context.channel, existingId)}
						with tags: ${tags}.
						This link was added by ${added.name} ${added.date}.						
					`
				});
			}
			else {
				const tag = { todo: 20 };
				const videoData = await linkParser.fetchData(link, type);
				if (!videoData) {
					continue;
				}

				const videoTypes = await getVideoTypes();
				const row = await core.Query.getRow<Track>("music", "Track");

				row.setValues({
					Link: videoData.ID,
					Name: videoData.name,
					Added_By: context.user.ID,
					Video_Type: videoTypes[type],
					Available: Boolean(videoData),
					Published: (videoData.created) ? new SupiDate(videoData.created) : null,
					Duration: videoData.duration,
					Track_Type: null,
					Notes: videoData.description
				});

				const trackResult = await row.save({ skipLoad: true });
				if (!trackResult || !("insertId" in trackResult)) {
					throw new SupiError({
						message: "Assert error: No updated columns in Row"
					});
				}

				const trackId = Number(trackResult.insertId);
				const tagRow = await core.Query.getRow<TrackTag>("music", "Track_Tag");
				tagRow.setValues({
					Track: trackId,
					Tag: tag.todo,
					Added_By: context.user.ID,
					Notes: JSON.stringify(videoData)
				});

				await tagRow.save();

				if (videoData.author) {
					const normal = videoData.author.toLowerCase().replaceAll(/\s+/g, "_");
					let authorId = await core.Query.getRecordset<number | undefined>(rs => rs
						.select("ID")
						.from("music", "Author")
						.where("Normalized_Name = %s", normal)
						.single()
						.flat("ID")
					);

					if (!authorId) {
						const authorRow = await core.Query.getRow("music", "Author");
						authorRow.setValues({
							Name: videoData.author,
							Normalized_Name: normal,
							Added_By: context.user.ID
						});

						const result = await authorRow.save({ skipLoad: true });
						if (!result || !("insertId" in result)) {
							throw new SupiError({
								message: "Assert error: No updated columns in Row"
							});
						}

						authorId = Number(result.insertId);
					}

					const authorRow = await core.Query.getRow<TrackAuthor>("music", "Track_Author");
					authorRow.setValues({
						Track: trackId,
						Author: authorId,
						Role: "Uploader",
						Added_By: context.user.ID
					});
					await authorRow.save();
				}

				results.push({
					link,
					existing: false,
					ID: row.values.ID,
					formatted: `Saved as ${trackToLink(context.channel, row.values.ID)} and marked as TODO.`
				});
			}
		}

		if (results.length === 1) {
			return {
				reply: results[0].formatted
			};
		}
		else {
			const summary = results.map(i => `${i.link}\n${i.formatted}`).join("\n\n");
			const paste = await postToHastebin(summary);
			if (!paste.ok) {
				return {
					success: false,
					reply: paste.reason
				};
			}

			return {
				reply: `${results.length} videos processed. Summary: ${paste.link}`
			};
		}
	}),
	Dynamic_Description: (prefix) => [
		"Checks if a video is already in the gachi list.",
		"If it isn't, it is added with the Todo tag.",
		"",

		`<code>${prefix}gc (link)</code>`,
		"Check for a single link. If it exists already, it is also checked for availability and updated accordingly.",
		"",

		`<code>${prefix}gc (link1) (link2) ...</code>`,
		"Checks multiple links in one command. Availability will not be updated."
	]
});
