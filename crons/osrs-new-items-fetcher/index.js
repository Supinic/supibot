module.exports = {
	Name: "osrs-new-items-fetcher",
	Expression: "0 0 0 * * *",
	Description: "Check new tradeable Old School Runescape items, and adds them to the database accordingly.",
	Defer: null,
	Type: "Website",
	Code: (async function osrsNewItemsFetcher () {
		this.data.isTableAvailable ??= await sb.Query.isTablePresent("osrs", "Item");
		if (this.data.isTableAvailable === false) {
			this.stop();
			return;
		}

		const wikiResponse = await sb.Got({
			url: "https://prices.runescape.wiki/api/v1/osrs/latest",
			responseType: "json"
		});

		const maxDatabaseID = await sb.Query.getRecordset(rs => rs
			.select("MAX(Game_ID) AS ID")
			.from("osrs", "Item")
			.single()
			.flat("ID")
		);

		const availableIDs = Object.keys(wikiResponse.body.data).map(Number);
		const missingIDs = availableIDs.filter(i => i > maxDatabaseID);
		if (missingIDs.length === 0) {
			return;
		}

		const conditions = [];
		for (const id of missingIDs) {
			conditions.push({ id: String(id) });
		}

		let page = 1;
		let added = false;
		const items = [];
		do {
			const boxResponse = await sb.Got({
				url: "https://api.osrsbox.com/items",
				searchParams: {
					where: JSON.stringify({ $id: conditions }),
					page
				},
				responseType: "json"
			});

			const newItems = boxResponse.body._items;
			items.push(...newItems);
			added = (newItems.length > 0);
			page++;
		} while (added && page < 20); // fallback - max. 20 pages (500 items)

		for (const item of items) {
			const row = await sb.Query.getRow("osrs", "Item");
			row.setValues({
				Game_ID: Number(item.id),
				Name: item.name,
				Aliases: null,
				Cost: item.cost,
				High_Alchemy: item.highalch,
				Low_Alchemy: item.lowalch,
				Trade_Limit: item.buy_limit ?? null,
				Members: item.members,
				Equippable: item.equipable,
				Noteable: item.noteable
			});

			await row.save();
		}
	})
};
