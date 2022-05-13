module.exports = {
	scoreThreshold: 0.5,
	detections: [
		{
			string: "Male Breast - Exposed",
			replacement: "male breast"
		},
		{
			string: "Male Genitalia - Exposed",
			replacement: "penis"
		},
		{
			string: "Male Genitalia - Covered",
			replacement: "covered penis"
		},
		{
			string: "Female Genitalia - Exposed",
			replacement: "vagina"
		},
		{
			string: "Female Genitalia - Covered",
			replacement: "covered vagina"
		},
		{
			string: "Female Breast - Exposed",
			replacement: "breast"
		},
		{
			string: "Female Breast - Covered",
			replacement: "covered breast"
		},
		{
			string: "Buttocks - Exposed",
			replacement: "ass"
		}
	],
	maxRetries: 10,
	formatScore: (score) => `${sb.Utils.round(score * 100, 2)}%`,
	createRecentUseCacheKey: (context) => ({
		type: "recent-use",
		user: context.user.ID,
		channel: context.channel?.ID ?? null
	})
};
