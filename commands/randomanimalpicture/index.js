module.exports = {
	Name: "randomanimalpicture",
	Aliases: ["rap","rbp","rcp","rdp","rfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random picture for a given animal type.",
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
	Code: (async function randomAnimalPicture (context, input) {
		const { invocations, types } = this.staticData;
		const type = invocations[context.invocation] ?? input?.toLowerCase() ?? null;
	
		if (type === null) {
			return {
				reply: "No type provided!" + types.join(", ")
			};
		}
		else if (!types.includes(type)) {
			return {
				reply: "That type is not supported!" + types.join(", ")
			};
		}
		else if (!context.user.Data.animals?.[type]) {
			return {
				reply: `Only people who have verified that they have a ${type} can use this command! Verify by $suggest-ing a picture of your ${type}(s), along with your name and mention that you want the command access.`
			};
		}
	
		let result = null;
		switch (type) {
			case "bird":
				result = (await sb.Got("SRA", "img/birb").json()).link;
				break;
	
			case "cat":
				result = (await sb.Got("https://api.thecatapi.com/v1/images/search").json())[0].url;
				break;
	
			case "dog":
				result = (await sb.Got("https://dog.ceo/api/breeds/image/random").json()).message;
				break;
	
			case "fox":
				result = (await sb.Got("SRA", "img/fox").json()).link;
				break;
		}
	
		return {
			reply: result
		};
	}),
	Dynamic_Description: (async (prefix, values) => {
		const { invocations, types } = values.getStaticData();
		const list = [];

		for (const [short, type] of Object.entries(invocations)) {
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

			`<code>${prefix}randomanimalfact ${types.join("/")}</code>`,
			"Posts a random picture of a given animal",
			"",

			...list.flat()
		];
	})
};