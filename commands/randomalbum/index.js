module.exports = {
	Name: "randomalbum",
	Aliases: ["ra"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random album.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		// Borrowed from https://codepen.io/bobhami/pen/gwAJNp
		accessToken: "CXyFeSBw2lAdG41xkuU3LS6a_nwyxwwCz2dCkUohw-rw0C49x2HqP__6_4is5RPx",
		minID: 100,
		maxID: 650000,
		maxRetries: 5
	})),
	Code: (async function randomAlbum () {
		const { accessToken, minID, maxID, maxRetries } = this.staticData;

		let data;
		let retries = 0;
		while (!data && retries < maxRetries) {
			const albumID = sb.Utils.random(minID, maxID);
			const { statusCode, body: albumData } = await sb.Got({
				url: `https://api.genius.com/albums/${albumID}`,
				responseType: "json",
				throwHttpErrors: false,
				searchParams: new sb.URLParams()
					.set("access_token", accessToken)
					.toString()
			});

			retries++;
			if (statusCode === 200) {
				data = albumData;
			}
		}

		if (retries >= maxRetries) {
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