import { randomInt } from "../../utils/command-utils.js";

export default {
	Name: "funfact",
	Aliases: ["ff"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random fun fact. Absolutely not guaranteed to be fun or fact.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function funFact () {
		const { year } = new sb.Date();
		const randomDate = new sb.Date(
			randomInt(2017, year),
			randomInt(1, 12)
		);

		const response = await core.Got.get("GenericAPI")({
			responseType: "json",
			throwHttpErrors: false,

			prefixUrl: "https://uselessfacts.net/api",
			url: "posts",
			searchParams: `d=${randomDate.toJSON()}`
		});

		const data = response.body.filter(i => i._id !== this.data.previousFactID);
		if (data.length === 0) {
			return {
				reply: "No fun facts found :("
			};
		}

		const randomFact = core.Utils.randArray(data);
		this.data.previousFactID = randomFact._id;

		return {
			reply: randomFact.title
		};
	}),
	Dynamic_Description: null
};
