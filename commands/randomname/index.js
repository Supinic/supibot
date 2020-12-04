module.exports = {
	Name: "randomname",
	Aliases: ["rn"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random fantasy name. You can specify its type from a list of fantasy races.",
	Flags: ["mention","non-nullable","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => ({
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
	})),
	Code: (async function randomName (context, ...args) {
		let type = args.slice(0, 2).join(" ");
		if (!type) {
			type = sb.Utils.randArray(this.staticData.types);
		}
		else {
			type = sb.Utils.selectClosestString(type, this.staticData.types, { ignoreCase: true });
			if (!type) {
				return {
					success: false,
					reply: "No matching type found!"
				};
			}
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