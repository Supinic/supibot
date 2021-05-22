module.exports = {
	Name: "funfact",
	Aliases: null,
	Author: "supinic",
	Cooldown: 60000,
	Description: "Fetches a random fun fact. Absolutely not guaranteed to be fun or fact. Want to help out? Send us your own fun fact via the $suggest command!",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function funFact () {
		const { year } = new sb.Date();
		const randomDate = new sb.Date(
			sb.Utils.random(2017, year),
			sb.Utils.random(1, 12)
		);

		const { statusCode, body: rawData } = await sb.Got({
			responseType: "json",
			throwHttpErrors: false,

			prefixUrl: "https://uselessfacts.net/api",
			url: "posts",
			searchParams: `d=${randomDate.toJSON()}`
		});

		if (statusCode !== 200) {
			throw new sb.errors.APIError({
				statusCode,
				apiName: "UselessFactsAPI"
			});
		}

		const data = rawData.filter(i => i._id !== this.data.previousFactID);
		if (data.length === 0) {
			return {
				reply: "No fun facts found :("
			};
		}

		const randomFact = sb.Utils.randArray(data);
		this.data.previousFactID = randomFact._id;

		return {
			reply: randomFact.title
		};
	}),
	Dynamic_Description: null
};
