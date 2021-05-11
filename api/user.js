// noinspection JSUnusedGlobalSymbols
module.exports = {
	invalidateCache: async (req, res, url) => {
		const names = url.searchParams.getAll("name").filter(Boolean);
		const promises = names.map(i => sb.User.invalidateUserCache(i));

		const result = await Promise.allSettled(promises);
		const [succeeded, failed] = sb.Utils.splitByCondition(result, i => i.status === "fulfilled");
		return {
			statusCode: 200,
			data: {
				succeeded,
				failed
			}
		};
	}
};