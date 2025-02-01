const ANIMAL_TYPES = ["cat", "dog", "bird", "fox"];
const INVOCATIONS_MAP = {
	rbf: "bird",
	rcf: "cat",
	rdf: "dog",
	rff: "fox"
};

export default {
	Name: "randomanimalfact",
	Aliases: ["raf","rbf","rcf","rdf","rff"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random fact about a selected animal type.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Code: (async function randomAnimalFact (context, input) {
		const type = INVOCATIONS_MAP[context.invocation] ?? input?.toLowerCase() ?? null;
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

		let gotPromise;
		let extractor;
		switch (type) {
			case "bird":
				extractor = (data) => data.fact;
				gotPromise = sb.Got.get("GenericAPI")({ url: "https://some-random-api.ml/facts/bird" });

				break;

			case "cat":
				extractor = (data) => data.fact;
				gotPromise = sb.Got.get("GenericAPI")("https://catfact.ninja/fact");

				break;

			case "dog":
				extractor = (data) => data.facts[0];
				gotPromise = sb.Got.get("GenericAPI")("https://dog-api.kinduff.com/api/facts");

				break;

			case "fox":
				extractor = (data) => data.fact;
				gotPromise = sb.Got.get("GenericAPI")({ url: "https://some-random-api.ml/facts/fox" });

				break;
		}

		const { body: data } = await gotPromise;
		return {
			reply: extractor(data)
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const list = [];
		for (const [short, type] of Object.entries(INVOCATIONS_MAP)) {
			list.push([
				`<code>${prefix}${short}</code>`,
				`Posts a random ${type} fact.`,
				""
			]);
		}

		return [
			"If you have verified that you own a given animal type, you can use this command to get a random fact about a selected animal type.",
			`To verify, <code>${prefix}suggest</code> a picture of your animal and mention that you want to get verified.`,
			"",

			`<code>${prefix}randomanimalfact ${ANIMAL_TYPES.join("/")}</code>`,
			"Posts a random fact for a given animal",
			"",

			...list.flat()
		];
	})
};
