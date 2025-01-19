// noinspection JSUnusedGlobalSymbols
export default {
	index: async (req, res) => {
		const data = await sb.Metrics.registry.metrics();
		const headers = {
			"Content-Type": sb.Metrics.registry.contentType
		};

		res.writeHead(200, headers);
		res.end(data);

		return {
			skipResponseHandling: true
		};
	}
};
