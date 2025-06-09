import { SupiError } from "supi-core";
import type { Context } from "../../../classes/command.js";
import extraItemData from "./extra-item-data.json" with { type: "json" };
const { aliases, priorities } = extraItemData;

const formatPrice = (price: number) => {
	if (price < 1000) {
		return String(price);
	}
	else {
		return core.Utils.formatSI(price, "", 3, true).replace("G", "B");
	}
};

const osrsItemDataCacheKey = "osrs-item-data";
type WikiItemData = {
	id: number;
	name: string;
	value: number;
	highalch: number;
};

const isAliasName = (input: string): input is keyof typeof aliases => Object.keys(aliases).includes(input);
const hasPriority = (input: string): input is keyof typeof priorities => Object.keys(priorities).includes(input);

const fetchItemId = async (query: string) => {
	let data = await core.Cache.getByPrefix(osrsItemDataCacheKey) as WikiItemData[] | null;
	if (!data) {
		const response = await core.Got.get("GenericAPI")<WikiItemData[]>({
			url: "https://prices.runescape.wiki/api/v1/osrs/mapping"
		});

		data = response.body.map(i => ({
			id: i.id,
			name: i.name,
			value: i.value,
			highalch: i.highalch
		}));

		await core.Cache.setByPrefix(osrsItemDataCacheKey, data, {
			expiry: 7 * 864e5 // 7 days
		});
	}

	query = query.toLowerCase();

	let item: WikiItemData;
	if (isAliasName(query)) {
		const itemId = aliases[query];
		const itemMatch = data.find(i => i.id === itemId);
		if (!itemMatch) {
			throw new SupiError({
			    message: "Assert error: Alias item ID not found in data set"
			});
		}

		item = itemMatch;
	}
	else {
		const matches = core.Utils.selectClosestString(query, data.map(i => i.name), {
			ignoreCase: true,
			fullResult: true
		});

		if (!matches) {
			return null;
		}

		const regexLikeQuery = query.replaceAll(/\s+/g, ".*");
		const regex = new RegExp(`^.*${regexLikeQuery}.*$`, "i");

		const likelyMatches = matches
			.filter(i => i.includes || regex.test(i.string))
			.sort((a, b) => {
				if (a.score !== b.score) {
					return (b.score - a.score);
				}

				const priorityA = (hasPriority(a.string)) ? priorities[a.string] : 0;
				const priorityB = (hasPriority(b.string)) ? priorities[b.string] : 0;
				return (priorityB - priorityA);
			});

		const bestMatch = data.find(i => i.name === likelyMatches[0].original);
		if (!bestMatch) {
			throw new SupiError({
			    message: "Assert error: Item ID not found from the same set",
				args: { match: matches[0] }
			});
		}

		item = bestMatch;
	}

	return item;
};

type WikiPriceData<T extends string | number> = {
	data: {
		[K in T]?: {
			high: number;
			highTime: number;
			low: number;
			lowTime: number;
		};
	};
};

export default {
	name: "price",
	title: "Item prices",
	aliases: [],
	description: [
		`<code>$osrs price (item)</code>`,
		`Posts the item's current GE price, along with trends. The most popular items also respond to aliases.`
	],
	execute: async function (context: Context, ...args: string[]) {
		const query = args.join(" ");
		const item = await fetchItemId(query);
		if (item === null) {
			return {
				success: false,
				reply: `No items found for given query!`
			};
		}

		const response = await core.Got.get("GenericAPI")<WikiPriceData<typeof item.id>>({
			url: "https://prices.runescape.wiki/api/v1/osrs/latest",
			throwHttpErrors: false,
			searchParams: {
				id: item.id
			}
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Item prices could not be fetched!`
			};
		}

		const itemPriceData = response.body.data[item.id];
		if (!itemPriceData) {
			return {
				success: false,
				reply: `${item.name} cannot be traded!`
			};
		}

		const { low, high } = itemPriceData;
		const priceString = (low === high)
			? `Current price of ${item.name}: ${formatPrice(low)} gp`
			: `Current price range of ${item.name}: ${formatPrice(low)} gp - ${formatPrice(high)} gp`;

		const highAlchValue = formatPrice(item.highalch);
		const wiki = `https://prices.runescape.wiki/osrs/item/${item.id}`;
		return {
			reply: core.Utils.tag.trim `
				${priceString};
				HA value: ${highAlchValue} gp
				${wiki}
			`
		};
	}
};
