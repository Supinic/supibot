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

const cacheKey = "osrs-item-data";
type WikiItemData = {
	id: number;
	name: string;
};

const fetchItemData = (query: string) => {
	let data = await core.Cache.getByPrefix(cacheKey);
	if (!data) {
		const response = await core.Got.get("GenericAPI")<WikiItemData[]>({
			url: "https://prices.runescape.wiki/api/v1/osrs/mapping"
		});

		data = response.body.map(i => ({
			id: i.id,
			name: i.name
		}));

		await sb.Cache.setByPrefix(cacheKey, data, {
			expiry: 7 * 864e5 // 7 days
		});
	}


}

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
		const query =
		if (aliases)

		const alias = await core.Query.getRecordset<string | undefined>(rs => rs
			.select("Name")
			.from("data", "OSRS_Item")
			.where(`JSON_SEARCH(Aliases, "one", %s) IS NOT NULL`, args.join(" ").toLowerCase())
			.single()
			.limit(1)
			.flat("Name")
		);

		const query = (alias ?? args.join(" ")).toLowerCase();

		type ItemData = { Game_ID: number; Name: string; Value: number; };
		const data = await core.Query.getRecordset<ItemData[]>(rs => {
			rs.select("Game_ID", "Name", "Value")
				.from("data", "OSRS_Item")
				.orderBy("Priority DESC")
				.orderBy("Game_ID ASC");

			for (const word of query.split(" ")) {
				rs.where("Name %*like*", word);
			}

			return rs;
		});

		if (data.length === 0) {
			return {
				success: false,
				reply: `No items found for given query!`
			};
		}

		const bestMatch = core.Utils.selectClosestString(query, data.map(i => i.Name), { ignoreCase: true });
		const item = (bestMatch !== null)
			? data.find(i => i.Name.toLowerCase() === bestMatch.toLowerCase())
			: data[0];

		if (!item) {
			return {
				success: false,
				reply: "Could not match item!"
			};
		}

		const response = await core.Got.get("GenericAPI")<WikiPriceData<typeof item.Game_ID>>({
			url: "https://prices.runescape.wiki/api/v1/osrs/latest",
			throwHttpErrors: false,
			searchParams: {
				id: item.Game_ID
			}
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Item prices could not be fetched!`
			};
		}

		const itemData = response.body.data[item.Game_ID];
		if (!itemData) {
			return {
				success: false,
				reply: `${item.Name} cannot be traded!`
			};
		}

		const { low, high } = itemData;
		const priceString = (low === high)
			? `${formatPrice(low)} gp`
			: `${formatPrice(low)} gp - ${formatPrice(high)} gp`;

		// const lowDelta = core.Utils.timeDelta(new sb.Date(itemData.lowTime * 1000));
		// const highDelta = core.Utils.timeDelta(new sb.Date(itemData.highTime * 1000));

		const highAlchValue = formatPrice(Math.floor(item.Value * 0.6));
		const wiki = `https://prices.runescape.wiki/osrs/item/${item.Game_ID}`;
		return {
			reply: core.Utils.tag.trim `
				Current price range of ${item.Name}: ${priceString};
				HA value: ${highAlchValue} gp
				${wiki}
			`
		};
	}
};
