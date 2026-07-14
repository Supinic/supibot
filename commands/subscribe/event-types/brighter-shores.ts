import type { CustomEventDefinition } from "../generic-event.js";

const LATEST_STEAM_NEWS_DATE = "brighter-shores-latest-steam-update-date";
const steamNewsUrl = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/";
const steamGameId = "2791440";

type SteamApiResponse = {
	appnews: {
		newsitems: {
			title: string;
			date: number;
			url: string;
			tags?: string[];
		}[];
	};
};

const definition: CustomEventDefinition = {
	type: "custom",
	title: "Brighter Shores",
	names: ["bs", "brighter-shores"],
	notes: `Checks for Brighter Shores updates on <a href="//store.steampowered.com/app/2791440">its Steam page</a>.`,
	process: async () => {
		const response = await core.Got.get("GenericAPI")<SteamApiResponse>({
			url: steamNewsUrl,
			searchParams: {
				appid: steamGameId,
				count: 10,
				maxlength: 1000,
				format: "json"
			}
		});

		if (!response.ok) {
			return null;
		}

		const updates = response.body.appnews.newsitems
			.filter(i => i.tags?.includes("patchnotes") || i.title.toLowerCase().includes("patch notes"))
			.sort((a, b) => b.date - a.date)
			.map(i => ({
				...i,
				date: i.date * 1000 // "Fixing" the no-millisecond date format from Steam API
			}));

		if (updates.length === 0) {
			return null;
		}

		const previousSteamUpdateDate = await core.Cache.getByPrefix(LATEST_STEAM_NEWS_DATE) as number | null;
		if (!previousSteamUpdateDate) {
			const latest = updates[0];
			await core.Cache.setByPrefix(LATEST_STEAM_NEWS_DATE, latest.date, {
				expiry: 14 * 864e5 // 14 days
			});

			return null;
		}

		const newUpdates = updates.filter(i => (i.date) > previousSteamUpdateDate);
		if (newUpdates.length === 0) { // No new updates, do nothing
			return null;
		}

		await core.Cache.setByPrefix(LATEST_STEAM_NEWS_DATE, newUpdates[0].date, {
			expiry: 14 * 864e5 // 14 days
		});

		const updateString = newUpdates.map(i => `${i.title} ${i.url}`).join(" -- ");
		const noun = (newUpdates.length === 1) ? "update" : "updates";
		return {
			message: `New Brighter Shores ${noun}! ${updateString}`
		};
	}
};

export default definition;
