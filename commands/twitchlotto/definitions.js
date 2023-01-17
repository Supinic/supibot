module.exports = {
	scoreThreshold: 0.5,
	detections: require("./detections.json"),
	maxRetries: 10,
	flags: ["Anime", "Animal", "Body-fluids", "Disfigured", "Disturbing", "Drawn", "Furry", "Gore", "Hentai", "Human", "Language", "None", "Porn", "Rendered", "Scat", "Softcore"],
	formatScore: (score) => `${sb.Utils.round(score * 100, 2)}%`,
	createRecentUseCacheKey: (context) => ({
		type: "recent-use",
		user: context.user.ID,
		channel: context.channel?.ID ?? null
	})
};
