import * as z from "zod";
import { declare } from "../../classes/command.js";
import { createRelayLink } from "../../utils/command-utils.js";

const authorShape = z.object({
	id: z.number(),
	name: z.string()
});
const authorsSchema = z.array(authorShape);
type Author = z.infer<typeof authorShape>;

const trackShape = z.object({
	id: z.number(),
	name: z.string(),
	isTodo: z.union([z.literal(0), z.literal(1)])
});
const trackSchema = z.array(trackShape);

export default declare({
	Name: "gachisearch",
	Aliases: ["gs", "gsa", "gachiauthorsearch"],
	Cooldown: 15000,
	Description: "Searches for a given track in the gachi list, and attempts to post a link.",
	Flags: ["mention", "pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Code: (async function gachiSearch (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				success: false,
				reply: "No search query provided!"
			};
		}
		else if (query.length < 3) {
			return {
				success: false,
				reply: "Your search query is too short - use at least 3 characters!"
			};
		}

		const { invocation } = context;
		const escaped = core.Query.escapeLikeString(query);
		if (invocation === "gsa" || invocation === "gachiauthorseach") {
			const data = await core.Query.raw(core.Utils.tag.trim `
				SELECT ID AS id, Name AS name
				FROM music.Author
				WHERE 
					Name LIKE '%${escaped}%' 
					OR Normalized_Name LIKE '%${escaped}%' 
					OR EXISTS(
						SELECT 1
						FROM music.Alias
						WHERE
							Alias.Name LIKE '%${escaped}%' 
							AND Alias.Target_Table = "Author"
							AND Alias.Target_ID = Author.ID
					)
				`);

			const authors = authorsSchema.parse(data);
			const author = authors.at(0);
			if (!author) {
				return {
					success: false,
					reply: "No authors matching that query have been found!"
				};
			}

			const link = `https://supinic.com/track/author/${author.id}`;
			if (context.params.linkOnly) {
				return {
					reply: link
				};
			}

			const rest = authors.slice(1);
			const others = (rest.length === 0)
				? ""
				: `More results: ${rest.map(i => `${i.name} (ID ${i.id})`).join("; ")}`;

			return {
				reply: `"${author.name}" - ${link} ${others}`
			};
		}

		const directMatch = await core.Query.getRecordset<Author | undefined>(rs => rs
			.select("ID AS id", "Name AS name")
			.from("music", "Track")
			.where("Link = %s", query)
			.limit(1)
			.single()
		);

		if (directMatch) {
			const link = `https://supinic.com/track/detail/${directMatch.id}`;
			return {
				reply: (context.params.linkOnly)
					? link
					: `${directMatch.name} ${link}`
			};
		}

		const rawData = await core.Query.raw(core.Utils.tag.trim `
			SELECT
				ID AS id,
				Name AS name,
				EXISTS (SELECT 1 FROM music.Track_Tag WHERE Track_Tag.Track = Track.ID AND Track_Tag.Tag = 20) AS isTodo
			FROM music.Track
			WHERE
				Track.ID IN (
					SELECT Track
					FROM music.Track_Tag
					WHERE Tag IN (6, 20, 25)
				)
				AND
				(
					Name LIKE '%${escaped}%'
					OR EXISTS (
						SELECT 1
						FROM music.Alias
						WHERE
							Target_Table = "Track"
							AND Name LIKE '%${escaped}%'
							AND Target_ID = Track.ID
					)
					OR EXISTS (
						SELECT 1
						FROM music.Track AS Right_Version
						JOIN music.Track_Relationship ON Track_From = Right_Version.ID
						JOIN music.Track AS Left_Version ON Track_To = Left_Version.ID
						WHERE
							(Relationship = "Based on" OR Relationship = "Reupload of")
							AND Left_Version.Name LIKE '%${escaped}%'
							AND Right_Version.ID = Track.ID
					)
				)
		`);

		const data = trackSchema.parse(rawData);
		if (data.length === 0) {
			return {
				success: false,
				reply: "No tracks matching that query have been found!"
			};
		}

		let reply;
		let link;
		if (data.length === 1) {
			const [first] = data;
			reply = `"${first.name}" - ${first.isTodo ? "🚧" : ""} https://supinic.com/track/detail/${first.id}`;
			link = `https://supinic.com/track/detail/${first.id}`;
		}
		else {
			const params = data.map(i => `ID=${i.id}`).join("&");
			const relayResult = await createRelayLink(`/track/lookup?${params}`);
			if (!relayResult.success) {
				return {
					success: false,
					reply: `Could not create a relay link! Try again later.`
				};
			}

			reply = `Search result: ${relayResult.link}`;
		}

		return {
			success: true,
			reply: (context.params.linkOnly) ? link : reply
		};
	}),
	Dynamic_Description: null
});
