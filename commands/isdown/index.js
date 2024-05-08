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
		const { domainToASCII } = require("node:url");
		const fixedInput = domainToASCII(input) || input; // domainToASCII returns empty string for invalid input - hence ||
		if (fixedInput.includes("shouldiblamecaching.com")) {
			return {
				reply: `That website is currently up and available. However, this result may be invalid due to caching.`
			};
		}
		else if (fixedInput.includes("shouldiblametmi.com")) {
			const emote = await context.getBestAvailableEmote(["TMIAteMyMessage", "Clue", "OpieOP"], "😋");
			const [first, second] = sb.Utils.shuffleArray([
				"That website is currently up and available.",
				`Website is currently down: ${emote}`
			]);

			context.sendIntermediateMessage(first);
			return {
				reply: second
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
		if (scan?.error) {
			return {
				success: false,
				reply: `Cannot check website status! ${scan.error}`
			};
		}

		const lastScan = new sb.Date(scan.last_scan);
		const delta = sb.Utils.timeDelta(lastScan);

		if (Array.isArray(warnings?.scan_failed)) {
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
