import type { ApiDefinition } from "./index.js";

export default {
	invalidateCache: async (req, res, url) => {
		const names = url.searchParams.getAll("name").filter(Boolean);
		const promises = names.map(i => sb.User.invalidateUserCache(i));

		await Promise.allSettled(promises);

		return {
			statusCode: 200,
			data: "OK"
		};
	}
} satisfies ApiDefinition;
