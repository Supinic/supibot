module.exports = {
	Name: "gachisearch",
	Aliases: ["gs","gsa","gachiauthorsearch"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Searches for a given track in the gachi list, and attempts to post a link.",
	Flags: ["mention","pipe","use-params"],
	Params: [
		{ name: "linkOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
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
		const escaped = sb.Query.escapeLikeString(query);
		if (invocation === "gsa" || invocation === "gachiauthorseach") {
			const data = await sb.Query.raw(sb.Utils.tag.trim `
				SELECT ID, Name
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

			const [author, ...rest] = data;
			if (!author) {
				return {
					success: false,
					reply: "No authors matching that query have been found!"
				};
			}

			const link = `https://supinic.com/track/author/${author.ID}`;
			if (context.params.linkOnly) {
				return {
					reply: link
				};
			}

			const others = (rest.length === 0)
				? ""
				: `More results: ${rest.map(i => `${i.Name} (ID ${i.ID})`).join("; ")}`;

			return {
				reply: `"${author.Name}" - ${link} ${others}`
			};
		}

		const directMatch = await sb.Query.getRecordset(rs => rs
			.select("ID", "Name")
			.from("music", "Track")
			.where("Link = %s", query)
			.limit(1)
			.single()
		);

		if (directMatch) {
			const link = `https://supinic.com/track/detail/${directMatch.ID}`;
			return {
				reply: (context.params.linkOnly)
					? link
					: `${directMatch.Name} ${link}`
			};
		}

		const data = await sb.Query.raw(sb.Utils.tag.trim `
			SELECT
				ID,
				Name,
				EXISTS (SELECT 1 FROM music.Track_Tag WHERE Track_Tag.Track = Track.ID AND Track_Tag.Tag = 20) AS Is_Todo
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
			reply = `"${first.Name}" - ${first.Is_Todo ? "🚧" : ""} https://supinic.com/track/detail/${first.ID}`;
			link = `https://supinic.com/track/detail/${first.ID}`;
		}
		else {
			const params = data.map(i => `ID=${i.ID}`).join("&");
			const listLink = `/track/lookup?${params}`;
			const relay = await sb.Got("Supinic", {
				method: "POST",
				url: "relay",
				json: { url: listLink }
			});

			link = relay.body.data.link;
			reply = `Search result: ${link}`;
		}

		return {
			reply: (context.params.linkOnly) ? link : reply
		};
	}),
	Dynamic_Description: null
};
