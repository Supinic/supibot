// noinspection JSUnusedGlobalSymbols
module.exports = {
	reloadAll: async () => {
		await sb.Channel.reloadData();
		return {
			statusCode: 200,
			body: { message: "OK" }
		};
	}
};