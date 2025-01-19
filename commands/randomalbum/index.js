import { randomInt } from "../../utils/command-utils.js";

// Borrowed from https://codepen.io/bobhami/pen/gwAJNp
const GENIUS_ACCESS_TOKEN = "CXyFeSBw2lAdG41xkuU3LS6a_nwyxwwCz2dCkUohw-rw0C49x2HqP__6_4is5RPx";
const ALBUM_ID_RANGE = [100, 650_000];
const MAX_RETRIES = 5;

export default {
	Name: "randomalbum",
	Aliases: ["ra"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random music album.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function randomAlbum () {
		let data;
		let retries = 0;
		while (!data && retries < MAX_RETRIES) {
			const albumID = randomInt(ALBUM_ID_RANGE[0], ALBUM_ID_RANGE[1]);
			const { statusCode, body: albumData } = await sb.Got.get("GenericAPI")({
				url: `https://api.genius.com/albums/${albumID}`,
				responseType: "json",
				throwHttpErrors: false,
				searchParams: {
					access_token: GENIUS_ACCESS_TOKEN
				}
			});

			retries++;
			if (statusCode === 200) {
				data = albumData;
			}
		}

		if (retries >= MAX_RETRIES) {
			return {
				success: false,
				reply: "Maximum amount of retries exceeded!"
			};
		}

		const { album } = data.response;
		const { artist, url } = album;
		const releaseYear = (album.release_date)
			? new sb.Date(album.release_date).year
			: "(unknown)";

		return {
			reply: `Your random album: ${album.name} by ${artist.name}, released in ${releaseYear}. More info here: ${url}`
		};
	}),
	Dynamic_Description: null
};
