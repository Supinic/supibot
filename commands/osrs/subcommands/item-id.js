module.exports = {
	name: "itemid",
	title: "Item IDs",
	aliases: ["item-id"],
	description: `Posts the item's ingame ID. Shows up to 5 best matching results.`,
	execute: async function (context, ...args) {
		const data = await sb.Query.getRecordset(rs => {
			rs.select("Game_ID", "Name")
				.from("osrs", "Item")
				.limit(5);

			for (const word of args) {
				rs.where("Name %*like*", word);
			}

			return rs;
		});

		return {
			reply: data.map(i => `${i.Name}: ${i.Game_ID}`).join("; ")
		};
	}
};
