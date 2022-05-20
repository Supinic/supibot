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

		const response = await sb.Got("GenericAPI", {
			url: `https://api-prod.downfor.cloud/httpcheck/${fixedInput}`
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Could not check if the website is down right now!`
			};
		}

		const now = sb.Date.now();
		const { isDown, lastChecked, statusCode } = response.body;
		const deltaString = (Math.abs(now - lastChecked) > 1000)
			? ` Last checked ${sb.Utils.timeDelta(new sb.Date(lastChecked))}.`
			: "";

		if (statusCode === 0) {
			return {
				success: false,
				reply: `Could not check the website being down due to API error! Please try a different format.`
			};
		}
		else if (isDown) {
			return {
				reply: `That website is currently not available with status code ${statusCode}.${deltaString}`
			};
		}
		else {
			return {
				reply: `That website is currently up and available.${deltaString}`
			};
		}
	}),
	Dynamic_Description: null
};
