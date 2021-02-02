module.exports = {
	Name: "npm",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Looks up an npm package with your given query, and posts a short description + link.",
	Flags: ["developer","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function npm (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No search query provided!"
			};
		}
	
		const data = await sb.Got({
			url: "https://www.npmjs.com/search",
			method: "GET",
			headers: {
				Accept: "*/*",
				"X-Requested-With": "XMLHttpRequest",
				"X-Spiferack": "1"
			},
			searchParams: new sb.URLParams()
				.set("q", args.join(" "))
				.toString()
		}).json();
	
		if (data.package) {
			const { version, description, repository } = data.packument;
			const { createdAt } = data.upsell;
			const delta = sb.Utils.timeDelta(new sb.Date(createdAt));
			return {
				reply: `${data.package} v${version}: ${description} (last publish: ${delta}) ${repository}`
			};
		}
	
		if (data.objects.length === 0) {
			return {
				success: false,
				reply: "No packages found for that query!"
			};
		}
	
		const { date, description, links, name, publisher, version } = data.objects[0].package;
		return {
			reply: `${name} v${version} by ${publisher?.name ?? "(unknown)"}: ${description} (last publish: ${date.rel}) ${links.npm}`
		};
	}),
	Dynamic_Description: null
};