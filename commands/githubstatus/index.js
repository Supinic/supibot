module.exports = {
	Name: "githubstatus",
	Aliases: ["ghs"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks current GitHub status as a short summary.",
	Flags: ["developer","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function githubStatus () {
		const response = await sb.Got("GenericAPI", {
			url: "https://www.githubstatus.com/history.json",
			retry: {
				limit: 0
			},
			timeout: {
				request: 5000
			}
		});

		const { components, page_status: pageStatus } = response.body;
		const lastUpdate = sb.Utils.timeDelta(new sb.Date(pageStatus.page.updated_at));

		const degraded = components.filter(i => i.status !== "operational");
		if (degraded.length === 0) {
			return {
				reply: `All GitHub service components are currently operational. Updated ${lastUpdate}.`
			};
		}
		else if (degraded.length === 1) {
			const [service] = degraded;
			return {
				reply: `⚠ The "${service.name}" component is ${service.status}. Updated ${lastUpdate}.`
			};
		}
		else {
			return {
				reply: sb.Utils.tag.trim `
					🚨 ${degraded.length} components are not operational. 
					Check https://www.githubstatus.com for more info.
					Updated ${lastUpdate}.
				`
			};
		}
	}),
	Dynamic_Description: null
};
