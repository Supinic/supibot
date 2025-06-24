import type { OsrsSubcommandDefinition } from "../index.js";
import { fetchItemId } from "./osrs-utils.js";

export default {
	name: "itemid",
	title: "Item IDs",
	aliases: ["item-id"],
	default: false,
	description: [
		`<code>$osrs itemid (item name)</code>`,
		`Posts the item's in-game ID. Shows up to 5 best matching results.`
	],
	execute: async function (context, ...args) {
		const itemData = await fetchItemId(args.join(" "));
		if (!itemData) {
			return {
			    success: false,
			    reply: "No matching tradeable item found!"
			};
		}
		else {
			return {
			    success: true,
			    reply: `${itemData.name}: ID = ${itemData.id}, HA value = ${itemData.highalch}`
			};
		}
	}
} satisfies OsrsSubcommandDefinition;
