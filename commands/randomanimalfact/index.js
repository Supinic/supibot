module.exports = {
	Name: "randomanimalfact",
	Aliases: ["raf","rbf","rcf","rdf","rff"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random fact about a selected animal type.",
	Flags: ["mention","non-nullable","pipe"],
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
	Dynamic_Description: null
};