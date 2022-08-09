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
			url: "https://steakovercooked.com/api/can-visit",
			searchParams: {
				url: fixedInput,
				hash: "20b566a8924fd48fbb105a690fc5699e"
			}
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Could not check if the website is down right now!`
			};
		}

		const { code, error, result } = response.body;
		if (error) {
			return {
				reply: `Error while checking: ${error}.`
			};
		}
		else if (!result) {
			return {
				reply: `That website is currently not available with status code ${code} - error ${error ?? "(N/A)"}.`
			};
		}
		else {
			return {
				reply: `That website is currently up and available.`
			};
		}
	}),
	Dynamic_Description: null
};
