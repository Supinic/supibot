module.exports = {
	Name: "randommuseumart",
	Aliases: ["rma"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random museum art piece.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		cacheKey: "object-id-list",
		sliceLength: 1000
	})),
	Code: (async function randomMuseumArt () {
		const { cacheKey } = this.staticData;
		const cacheListExists = Boolean(await sb.Cache.server.exists(cacheKey));

		if (!cacheListExists) {
			const response = await sb.Got("GenericAPI", {
				url: "https://collectionapi.metmuseum.org/public/collection/v1/objects"
			});

			if (response.statusCode !== 200) {
				return {
					success: false,
					reply: `No museum art data is currently available!`
				};
			}

			const { objectIDs } = response.body;
			const { sliceLength } = this.staticData;
			const pushPromises = [];

			for (let i = 0; i < objectIDs.length; i += sliceLength) {
				const slice = objectIDs.slice(i, i + sliceLength);
				pushPromises.push(sb.Cache.server.lpush(cacheKey, ...slice));
			}

			await Promise.all(pushPromises);
			await sb.Cache.server.expire(cacheKey, 7 * 86400); // 7 days -- EXPIRE uses seconds by default!
		}

		const listLength = await sb.Cache.server.llen(cacheKey);
		const randomIndex = sb.Utils.random(0, listLength);
		const objectID = await sb.Cache.server.lindex(cacheKey, randomIndex);

		const response = await sb.Got("GenericAPI", {
			url: `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectID}`
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `No data found for a specific art piece!`
			};
		}

		const { body } = response;
		return {
			reply: sb.Utils.tag.trim `
				Your random art piece:
				"${body.title}"
				by ${body.artistDisplayName || "(unknown)"},
				in ${body.objectDate || "(unknown)"}.
				
				Image: ${body.primaryImage || "N/A"}
				Website: ${body.objectURL || "N/A"}				
			`
		};
	}),
	Dynamic_Description: null
};
