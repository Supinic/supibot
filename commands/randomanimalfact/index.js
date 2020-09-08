module.exports = {
	Name: "randomanimalfact",
	Aliases: ["raf", "rbf", "rcf", "rdf", "rff"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Posts a random fact about a selected animal type.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomAnimalFact (context, type) {
		const types = ["cat", "dog", "bird", "fox"];
		switch (context.invocation) {
			case "rcf": type = "cat"; break;
			case "rdf": type = "dog"; break;
			case "rbf": type = "bird"; break;
			case "rff": type = "fox"; break;
	
			default: type = (typeof type === "string") ? type.toLowerCase() : null;
		}
	
		if (type === null) {
			return {
				reply: "No type provided!"
			};
		}
		else if (!types.includes(type)) {
			return {
				reply: "That type is not supported!"
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
				result = (await sb.Got.instances.SRA("facts/bird").json()).fact;
				break;
	
			case "cat":
				result = (await sb.Got("https://catfact.ninja/fact").json()).fact;
				break;
	
			case "dog":
				result = (await sb.Got("https://dog-api.kinduff.com/api/facts").json()).facts[0];
				break;
	
			case "fox":
				result = (await sb.Got.instances.SRA("facts/fox").json()).fact;
				break;
		}
	
		return {
			reply: result
		};
	}),
	Dynamic_Description: null
};