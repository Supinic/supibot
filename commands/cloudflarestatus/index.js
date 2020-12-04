module.exports = {
	Name: "cloudflarestatus",
	Aliases: ["cloudflare", "cfs"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks current Cloudflare status as a short summary.",
	Flags: ["pipe","non-nullable","developer"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function cloudflareStatus () {
		const { statusCode, body: data } = await sb.Got({
			url: "https://yh6f0r4529hb.statuspage.io/api/v2/summary.json",
			responseType: "json",
			throwHttpErrors: false,
			retry: 0,
			timeout: 5000
		});

		if (statusCode !== 200) {
			throw new sb.errors.APIError({
				statusCode,
				apiName: "CloudflareAPI"
			});
		}

		const { incidents, page, status, scheduled_maintenances: maintenances } = data;
		const update = sb.Utils.timeDelta(new sb.Date(page.updated_at));
		return {
			reply: sb.Utils.tag.trim `
				Cloudflare status: ${status.description};
				Incidents: ${incidents.length};
				Scheduled maintenances: ${maintenances.length}
				(last updated ${update})
			`
		};
	}),
	Dynamic_Description: null
};