module.exports = {
	Name: "randomanimalpicture",
	Aliases: ["rap","rbp","rcp","rdp","rfp"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a random picture for a given animal type.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomAnimalPicture (context, type) {
		const types = ["cat", "dog", "bird", "fox"];
		switch (context.invocation) {
			case "rcp": type = "cat"; break;
			case "rdp": type = "dog"; break;
			case "rbp": type = "bird"; break;
			case "rfp": type = "fox"; break;
	
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
	Dynamic_Description: null
};