import * as z from "zod";
import { SupiDate } from "supi-core";
import { domainToASCII } from "node:url";
import { declare } from "../../classes/command.js";

const querySchema = z.object({
	scan: z.object({
		last_scan: z.iso.datetime(),
		error: z.string().optional()
	}).optional(),
	warnings: z.object({
		scan_failed: z.array(z.object({
			type: z.string(),
			msg: z.string().optional()
		})).optional()
	}).optional()
});

export default declare({
	Name: "isdown",
	Aliases: null,
	Cooldown: 10000,
	Description: "Checks if a website is currently down or if it's just you.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function isDown (context, input) {
		const fixedInput = domainToASCII(input) || input; // domainToASCII returns empty string for invalid input - hence ||
		if (fixedInput.includes("shouldiblamecaching.com")) {
			return {
				reply: `That website is currently up and available. However, this result may be invalid due to caching.`
			};
		}
		else if (fixedInput.includes("shouldiblametmi.com")) {
			const emote = await context.getBestAvailableEmote(["TMIAteMyMessage", "Clue", "OpieOP"], "😋");
			const [first, second] = core.Utils.shuffleArray([
				"That website is currently up and available.",
				`Website is currently down: ${emote}`
			]);

			void context.sendIntermediateMessage(first);
			return {
				success: true,
				reply: second
			};
		}

		const response = await core.Got.get("GenericAPI")({
			url: `https://sitecheck.sucuri.net/api/v3/?scan=${fixedInput}`
		});

		if (!response.ok) {
			return {
				success: false,
				reply: `Could not check if the website is down right now!`
			};
		}

		const { scan, warnings } = querySchema.parse(response.body);
		if (!scan || scan.error) {
			return {
				success: false,
				reply: `Cannot check website status! ${scan?.error ?? "(no error available)"}`
			};
		}

		const lastScan = new SupiDate(scan.last_scan);
		const delta = core.Utils.timeDelta(lastScan);

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
					success: true,
					reply: `Website is currently down: ${error ?? "(N/A)"}. Last scanned ${delta}.`
				};
			}
		}
		else {
			return {
				success: true,
				reply: `That website is currently up and available. Last scanned ${delta}.`
			};
		}
	}),
	Dynamic_Description: null
});
