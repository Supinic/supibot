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

		for (const ID of missingIDs) {
			const response = await sb.Got("GenericAPI", {
				url: "https://secure.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json",
				searchParams: {
					item: ID
				}
			});

			const { item } = response.body;
			const row = await sb.Query.getRow("osrs", "Item");
			row.setValues({
				Game_ID: Number(item.id),
				Name: item.name,
				Aliases: null
			});

			await row.save({ skipLoad: true });
		}
	})
};
