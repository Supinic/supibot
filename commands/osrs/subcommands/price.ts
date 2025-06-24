import type { OsrsSubcommandDefinition } from "../index.js";
import { fetchItemId } from "./osrs-utils.js";

const formatPrice = (price: number) => {
	if (price < 1000) {
		return String(price);
	}
	else {
		return core.Utils.formatSI(price, "", 3, true).replace("G", "B");
	}
};

export type WikiPriceData<T extends string | number> = {
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
	default: false,
	description: [
		`<code>$osrs price (item)</code>`,
		`Posts the item's current GE price, along with trends. The most popular items also respond to aliases.`
	],
	execute: async function (context, ...args) {
		const query = args.join(" ");
		const item = await fetchItemId(query);
		if (item === null) {
			return {
				success: false,
				reply: "Your query matches no items tradeable on the Grand Exchange!"
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
				reply: `${item.name} cannot be traded on the Grand Exchange!`
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
} satisfies OsrsSubcommandDefinition;
