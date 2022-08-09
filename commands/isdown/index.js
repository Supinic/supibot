module.exports = {
	Name: "isdown",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks if a website is currently down or if it's just you.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function isDown (context, input) {
		const { domainToASCII } = require("url");
		const fixedInput = domainToASCII(input) || input; // domainToASCII returns empty string for invalid input - hence ||
		if (fixedInput.includes("shouldiblamecaching.com")) {
			return {
				reply: `That website is currently up and available. However, this result may be invalid due to caching.`
			};
		}

		const response = await sb.Got("GenericAPI",{
			url: `https://sitecheck.sucuri.net/api/v3/?scan=${fixedInput}`
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Could not check if the website is down right now!`
			};
		}

		const { scan, warnings } = response.body;
		const lastScan = new sb.Date(scan.last_scan);
		const delta = sb.Utils.timeDelta(lastScan);

		if (Array.isArray(warnings) && warnings.length > 0) {
			const error = warnings.scan_failed[0].msg;
			if (error === "Host not found") {
				return {
					success: false,
					reply: `Provided website was not found!`
				};
			}
			else {
				return {
					reply: `Website is currently down: ${error ?? "(N/A)"}. Last scanned ${delta}.`
				};
			}
		}
		else {
			return {
				reply: `That website is currently up and available. Last scanned ${delta}.`
			};
		}
	}),
	Dynamic_Description: null
};
