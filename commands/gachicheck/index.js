const { fetchYoutubePlaylist, postToHastebin } = require("../../utils/command-utils.js");
const { getLinkParser } = require("../../utils/link-parser.js");
const limit = 100;

module.exports = {
	Name: "gachicheck",
	Aliases: ["gc"],
	Author: "supinic",
	Cooldown: 2500,
	Description: "Checks if a given gachi link exists in the database, if not, adds it to the to-do list to be processed later.",
	Flags: ["mention","pipe","skip-banphrase"],
	Params: null,
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
		if (args[0] === "playlist") {
			args.shift();
			const playlistID = args.shift();
			if (!playlistID) {
				return {
					success: false,
					reply: `No playlist ID provided!`
				};
			}

			const { amount, reason, result, success } = await fetchYoutubePlaylist({
				playlistID,
				limit,
				limitAction: "return"
			});

			if (!success) {
				if (reason === "limit-exceeded") {
					return {
						success: false,
						reply: `Playlist has too many videos! ${amount} videos fetched, limit is ${limit}.`
					};
				}
				else {
					return {
						success: false,
						reply: `Could not fetch the playlist! Reason: ${reason}`
					};
				}
			}
			else {
				const items = result.map(i => ({
					link: i.ID,
					type: "youtube"
				}));

				links.push(...items);
			}
		}
		else {
			const fixedArgs = args.flatMap(i => i.split(/\s+/).filter(Boolean));
			for (const word of fixedArgs) {
				const type = linkParser.autoRecognize(word);
				if (type) {
					links.push({
						type,
						link: linkParser.parseLink(word)
					});
				}
			}
		}

		if (links.length === 0) {
			return {
				reply: "No valid links provided!",
				cooldown: { length: 2500 }
			};
		}

		const trackToLink = (id) => (!context.channel || context.channel.Links_Allowed)
			? `https://supinic.com/track/detail/${id}`
			: `track list ID ${id}`;

		if (!this.data.typeMap) {
			const typeData = await sb.Query.getRecordset(rs => rs
				.select("ID", "Parser_Name")
				.from("data", "Video_Type")
				.where("Parser_Name IS NOT NULL"));

			this.data.typeMap = Object.fromEntries(typeData.map(i => [i.Parser_Name, i.ID]));
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

			const check = await sb.Query.getRecordset(rs => rs
				.select("ID")
				.from("music", "Track")
				.where("Link = %s", String(videoData.ID))
				.single()
			);

			if (check) {
				const tagData = (await sb.Query.getRecordset(rs => rs
					.select("Tag.Name AS Tag_Name")
					.from("music", "Track_Tag")
					.join("music", {
						raw: "music.Tag ON Tag.ID = Track_Tag.Tag"
					})
					.where("Track_Tag.Track = %n", check.ID)
					.flat("Tag_Name")
				));

				const tags = tagData.join(", ");
				const row = await sb.Query.getRow("music", "Track");
				await row.load(check.ID);

				const added = { name: "(unknown)", date: "(unknown time ago)" };
				if (row.values.Added_By) {
					const userData = await sb.User.get(row.values.Added_By);
					added.name = userData.Name;
				}
				if (row.values.Added_On) {
					added.date = sb.Utils.timeDelta(row.values.Added_On);
				}

				results.push({
					link,
					existing: true,
					ID: check.ID,
					formatted: sb.Utils.tag.trim `
						Link is in the list already:
						${trackToLink(check.ID)}
						with tags: ${tags}.
						This link was added by ${added.name} ${added.date}.						
					`
				});
			}
			else {
				const tag = { todo: 20 };
				const videoData = await linkParser.fetchData(link, type);
				const row = await sb.Query.getRow("music", "Track");

				row.setValues({
					Link: videoData.ID,
					Name: (videoData && videoData.name) || null,
					Added_By: context.user.ID,
					Video_Type: this.data.typeMap[type],
					Available: Boolean(videoData),
					Published: (videoData?.created) ? new sb.Date(videoData.created) : null,
					Duration: (videoData && videoData.duration) || null,
					Track_Type: null,
					Notes: videoData?.description ?? null
				});

				const { insertId: trackID } = await row.save();
				const tagRow = await sb.Query.getRow("music", "Track_Tag");
				tagRow.setValues({
					Track: trackID,
					Tag: tag.todo,
					Added_By: context.user.ID,
					Notes: JSON.stringify(videoData)
				});

				await tagRow.save();

				if (videoData?.author) {
					let authorID = null;
					const normal = videoData.author.toLowerCase().replaceAll(/\s+/g, "_");
					const authorExists = await sb.Query.getRecordset(rs => rs
						.select("ID")
						.from("music", "Author")
						.where("Normalized_Name = %s", normal)
						.single()
					);
					if (authorExists && authorExists.ID) {
						authorID = authorExists.ID;
					}
					else {
						const authorRow = await sb.Query.getRow("music", "Author");
						authorRow.setValues({
							Name: videoData.author,
							Normalized_Name: normal,
							Added_By: context.user.ID
						});

						const result = await authorRow.save();
						authorID = result.insertId;
					}

					const authorRow = await sb.Query.getRow("music", "Track_Author");
					authorRow.setValues({
						Track: trackID,
						Author: authorID,
						Role: "Uploader",
						Added_By: context.user.ID
					});
					await authorRow.save();
				}

				results.push({
					link,
					existing: false,
					ID: row.values.ID,
					formatted: `Saved as ${trackToLink(row.values.ID)} and marked as TODO.`
				});
			}
		}

		console.log(`${results.length} gachi tracks just got processed`, {
			user: context.user.Name,
			channel: context.channel?.Name ?? `${context.platform.Name} DM`,
			results
		});

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
	Dynamic_Description: (async function (prefix) {
		return [
			"Checks if a video is already in the gachi list.",
			"If it isn't, it is added with the Todo tag.",
			"",

			`<code>${prefix}gc (link)</code>`,
			"Check for a single link. If it exists already, it is also checked for availability and updated accordingly.",
			"",

			`<code>${prefix}gc (link1) (link2) ...</code>`,
			"Checks multiple links in one command. Availability will not be updated.",

			"",

			`<code>${prefix}gc playlist (playlistID)</code>`,
			"Checks all videos in a single Youtube playlist. Summary will be posted in a Pastebin paste.",
			`Does not check playlists that have more than <b>${limit}</b> videos.`,
			"As with multiple videos, availability will also not be checked."
		];
	})
};
