export default {
	index: async (req, res) => {
		const data = await core.Metrics.registry.metrics();
		const headers = {
			"Content-Type": core.Metrics.registry.contentType
		};

		res.writeHead(200, headers);
		res.end(data);

		return {
			skipResponseHandling: true
		};
	}
};
