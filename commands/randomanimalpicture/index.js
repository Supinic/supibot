const ANIMAL_TYPES = ["cat", "dog", "bird", "fox"];
const PICTURE_INVOCATIONS_MAP = {
	rbp: "bird",
	rcp: "cat",
	rdp: "dog",
	rfp: "fox"
};

export default {
	Name: "randomanimalpicture",
	Aliases: ["rap","rbp","rcp","rdp","rfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random picture for a given animal type.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function randomAnimalPicture (context, input) {
		const type = PICTURE_INVOCATIONS_MAP[context.invocation] ?? input?.toLowerCase() ?? null;
		const animalsData = await context.user.getDataProperty("animals");

		if (!animalsData) {
			return {
				reply: `You must verify that you have any type of animal as a pet first! Verify by $suggest-ing a picture of your pet(s), along with your name and mention that you want the command access.`
			};
		}
		else if (type === null) {
			return {
				reply: `No type provided! Use one of: ${ANIMAL_TYPES.join(", ")}`
			};
		}
		else if (!ANIMAL_TYPES.includes(type)) {
			return {
				reply: `That type is not supported! Use on of: ${ANIMAL_TYPES.join(", ")}`
			};
		}
		else if (!animalsData[type]) {
			const available = Object.keys(animalsData);
			return {
				reply: `You can only use this command for ${available.join(", ")}! If you want to use it for ${type}s, you need to $suggest a picture of it, like before.`
			};
		}

		let result = null;
		switch (type) {
			case "bird": {
				const response = await core.Got.get("GenericAPI")({
					url: "https://some-random-api.ml/img/birb"
				});

				result = response.body.link;
				break;
			}

			case "cat": {
				const response = await core.Got.get("GenericAPI")({
					url: "https://api.thecatapi.com/v1/images/search"
				});

				result = response.body[0].url;
				break;
			}

			case "dog": {
				const response = await core.Got.get("GenericAPI")({
					url: "https://dog.ceo/api/breeds/image/random"
				});

				result = response.body.message;
				break;
			}

			case "fox": {
				const response = await core.Got.get("GenericAPI")({
					url: "https://some-random-api.ml/img/fox"
				});

				result = response.body.link;
				break;
			}
		}

		return {
			reply: result
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const list = [];
		for (const [short, type] of Object.entries(PICTURE_INVOCATIONS_MAP)) {
			list.push([
				`<code>${prefix}${short}</code>`,
				`Posts a random ${type} picture.`,
				""
			]);
		}

		return [
			"If you have verified that you own a given animal type, you can use this command to get a random picture of a selected animal type.",
			`To verify, <code>${prefix}suggest</code> a picture of your animal and mention that you want to get verified.`,
			"",

			`<code>${prefix}randomanimalpicture ${ANIMAL_TYPES.join("/")}</code>`,
			"Posts a random picture of a given animal",
			"",

			...list.flat()
		];
	})
};
