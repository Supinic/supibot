module.exports = {
	Name: "randomanimalfact",
	Aliases: ["raf","rbf","rcf","rdf","rff"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random fact about a selected animal type.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
		types: ["cat", "dog", "bird", "fox"],
		invocations: {
			rbf: "bird",
			rcf: "cat",
			rdf: "dog",
			rff: "fox"
		}
	})),
	Code: (async function randomAnimalFact (context, input) {
		const { invocations, types } = ["cat", "dog", "bird", "fox"];
		const type = invocations[context.invocation] ?? input?.toLowerCase() ?? null;

		if (type === null) {
			return {
				reply: "No type provided! Use one of: " + types.join(", ")
			};
		}
		else if (!types.includes(type)) {
			return {
				reply: "That type is not supported! Use on of: " + types.join(", ")
			};
		}
		else if (!context.user.Data.animals?.[type]) {
			return {
				reply: `Only people who have verified that they have a ${type} can use this command! Verify by $suggest-ing a picture of your ${type}(s), along with your name and mention that you want the command access.`
			};
		}

		let gotPromise;
		let extractor;
		switch (type) {
			case "bird":
				extractor = (data) => data.fact;
				gotPromise = sb.Got("SRA", "facts/bird");

				break;
	
			case "cat":
				extractor = (data) => data.fact;
				gotPromise = sb.Got("GenericAPI", "https://catfact.ninja/fact");

				break;
	
			case "dog":
				extractor = (data) => data.facts[0];
				gotPromise = sb.Got("GenericAPI", "https://dog-api.kinduff.com/api/facts");

				break;
	
			case "fox":
				extractor = (data) => data.fact;
				gotPromise = sb.Got("SRA", "facts/fox");

				break;
		}

		const { body: data } = await gotPromise;
		return {
			reply: extractor(data)
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { invocations, types } = values.getStaticData();
		const list = [];

		for (const { short, type } of Object.entries(invocations)) {
			list.push([
				`<code>${prefix}${short}</code>`,
				`Posts a random ${type} fact.`,
				""
			]);
		}

		return [
			"If you have verified that you own a given animal type, you can use this command to get a random fact about a selected animal type.",
			`To verify, <code>${prefix}suggest a picture of your animal and mention that you want to get verified.`,
			"",

			`<code>${prefix}randomanimalfact ${types.join("/")}</code>`,
			"Posts a random fact for a given animal",
			"",

			...list.flat()
		];
	})
};