// noinspection JSUnusedGlobalSymbols
module.exports = {
	reloadAll: async () => {
		await sb.AwayFromKeyboard.reloadData();
		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	},
	reloadSpecific: async (req, res, url) => {
		const IDs = url.searchParams.getAll("ID").map(Number).filter(Boolean);
		const result = await sb.AwayFromKeyboard.reloadSpecific(...IDs);

		const [active, inactive] = sb.Utils.splitByCondition(IDs, i => sb.AwayFromKeyboard.get(i));
		return {
			statusCode: 200,
			data: {
				processedIDs: IDs,
				active,
				inactive,
				result
			}
		};
	}
};
