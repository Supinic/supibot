module.exports = {
	Name: "randomname",
	Aliases: ["rn"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Fetches a random name.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: ({
		types: [
			"Human Male",
			"Human Female",
			"Dwarwish Male",
			"Dwarwish Female",
			"Elvish Male",
			"Elvish Female",
			"Halfling Male",
			"Halfling Female",
	
			"Draconic Male",
			"Draconic Female",
			"Drow Male",
			"Drow Female",
			"Orcish Male",
			"Orcish Female",
	
			"Fiendish",
			"Celestial",
			"Modron"
		]
	}),
	Code: (async function randomName (context, type) {
		if (!type) {
			type = sb.Utils.randArray(this.staticData.types);
		}
	
		const name = await sb.Got({
		  	url: "https://donjon.bin.sh/name/rpc-name.fcgi",
			searchParams: new sb.URLParams()
				.set("type", type)
				.set("n", "1")
				.toString()
		}).text();
	
		return {
			reply: `Your random ${type} name is: ${name}`
		};
	}),
	Dynamic_Description: null
};