module.exports = {
	Name: "randomanimalpicture",
	Aliases: ["rap","rbp","rcp","rdp","rfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random picture for a given animal type.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		types: ["cat", "dog", "bird", "fox"],
		invocations: {
			rbp: "bird",
			rcp: "cat",
			rdp: "dog",
			rfp: "fox"
		}
	})),
	Code: (async function randomAnimalPicture (context, input) {
		const { invocations, types } = this.staticData;
		const type = invocations[context.invocation] ?? input?.toLowerCase() ?? null;

		if (!context.user.Data.animals) {
			return {
				reply: `You must verify that you have any type of animal as a pet first! Verify by $suggest-ing a picture of your pet(s), along with your name and mention that you want the command access.`
			};
		}
		else if (type === null) {
			return {
				reply: "No type provided! Use one of: " + types.join(", ")
			};
		}
		else if (!types.includes(type)) {
			return {
				reply: "That type is not supported! Use on of: " + types.join(", ")
			};
		}
		else if (!context.user.Data.animals[type]) {
			const available = Object.keys(context.user.Data.animals);
			return {
				reply: `You can only use this command for ${available.join(", ")}! If you want to use it for ${type}s, you need to $suggest a picture of it, like before.`
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
	
			`<code>${prefix}randomanimalpicture ${types.join("/")}</code>`,
			"Posts a random picture of a given animal",
			"",
	
			...list.flat()
		];
	})
};