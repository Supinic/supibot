// noinspection JSUnusedGlobalSymbols
module.exports = {
	reloadAll: async () => {
		await sb.Channel.reloadData();
		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	},
	reloadSpecific: async (url) => {
		const IDs = url.searchParams.getAll("ID").map(Number).filter(Boolean);
		const result = await sb.Reminder.reloadSpecific(...IDs);

		return {
			statusCode: 200,
			data: {
				processedIDs: IDs,
				result
			}
		};
	}
};