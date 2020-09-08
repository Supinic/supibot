module.exports = {
	Name: "gachisearch",
	Aliases: ["gs"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Searches for a given track in the gachi list, and attempts to post a link.",
	Flags: ["link-only","mention","pipe"],
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
	
		const escaped = sb.Query.escapeLikeString(query);
		const data = await sb.Query.raw(sb.Utils.tag.trim `
			SELECT ID, Name
			FROM music.Track
			WHERE
				Track.ID IN ( SELECT Track FROM music.Track_Tag WHERE Tag = 6 )
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
							Relationship = "Based on"
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
	
		const [first, ...rest] = data;
		const others = (rest.length === 0)
			? ""
			: "More results: " + rest.map(i => `"${i.Name}" (ID ${i.ID})`).join("; ");
	
		return {
			reply: `"${first.Name}" - https://supinic.com/track/detail/${first.ID} ${others}`,
			link: `https://supinic.com/track/detail/${first.ID}`
		};
	}),
	Dynamic_Description: null
};