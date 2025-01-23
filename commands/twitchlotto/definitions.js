export * as detections from "./detections.json" with { type: "json" };

export const scoreThreshold = 0.5;
export const maxRetries = 0.5;
export const taggingGuide = [
	"The main idea of tagging TwitchLotto pictures is to only tag them when they contain NSFW content.",
	"E.g. the \"Anime\" tag should not be used unless the image contains NSFW content related to Anime",
	"The exceptions are the \"None\" and the \"Bait\" tags - see below for full explanation."
];

export const createRecentUseCacheKey = (context) => ({
	type: "recent-use",
	user: context.user.ID,
	channel: context.channel?.ID ?? null
});

export const formatScore = (score) => (score === null)
	? "N/A"
	: `${sb.Utils.round(score * 100, 2)}%`;

export const flags = [
	{
		name: "Anime",
		description: "Depictions of character(s) from an anime series. If you're unsure, default to the \"Drawn\" tag.",
		correct: [],
		wrong: []
	},
	{
		name: "Animal",
		description: "NSFW content regarding real-life animals.",
		correct: [
			"two dogs \"going at it\"",
			"a horse with its penis erect"
		],
		wrong: [
			"cat sitting around",
			"dog fetching a frisbee"
		]
	},
	{
		name: "Bait",
		description: "Meta-flag - used when at first glance something appears as NSFW content, but in reality, it isn't.",
		correct: [
			"a carrot in the shape of a penis",
			"a hot dog in the shape of a penis",
			"knees appearing to be breasts"
		],
		wrong: [
			"actual fishing bait"
		]
	},
	{
		name: "Body-fluids",
		description: "Anything regarding NSFW and excessive portrayal of human body fluids, such as saliva, blood, semen, etc.",
		correct: [],
		wrong: []
	},
	{
		name: "Borderline",
		description: "Meta-flag - used when something could be considered NSFW by some, but also not by others; or when given picture is too unclear to decide this.",
		correct: [],
		wrong: []
	},
	{
		name: "Disfigured",
		description: "Humans or humanoids in various unnatural shapes and forms, pertaining to injury, malformations, diseases, etc.",
		correct: [
			"person with a broken arm, without open injuries",
			"human hand with a twisted finger"
		],
		wrong: []
	},
	{
		name: "Disturbing",
		description: "Refers to content that is likely to cause major discomfort in most people when viewed",
		correct: [
			"infected ingrown toenails",
			"a human blob, generated by a stable-diffusion AI"
		],
		wrong: []
	},
	{
		name: "Drawn",
		description: "Content related to any non-real-life situations, such as comics, paintings, etc.",
		correct: [],
		wrong: []
	},
	{
		name: "Furry",
		description: "Refers to content involving non-real-life animal-like humanoids or animals.",
		correct: [],
		wrong: []
	},
	{
		name: "Gore",
		description: "Pictures of open wounds, fatal injuries, results of violence on either human or non-human subjects.",
		correct: [],
		wrong: []
	},
	{
		name: "Hentai",
		description: "Pertains to images portraying non-real-life characters in sexual positions and situations, involving penetration. Basically, \"2D porn\".",
		correct: [],
		wrong: [
			"involving no penetration"
		]
	},
	{
		name: "Human",
		description: "Combined with other tags to specify the content involves humans rather than others.",
		correct: [],
		wrong: []
	},
	{
		name: "None",
		description: "Meta-tag - used whenever the automatic result is incorrect (detections or score) and the pictures do not have any NSFW content in them.",
		correct: [],
		wrong: []
	},
	{
		name: "Porn",
		description: "Used whenever content involving humans in sexual positions and situations, involving penetration is tagged.",
		correct: [],
		wrong: [
			"involving no penetration"
		]
	},
	{
		name: "Offensive",
		description: "Refers to any text, imagery, or other content that could be considered offensive to a specific group of people.",
		correct: [
			"text containing offensive slurs",
			"imagery of hateful symbols"
		],
		wrong: []
	},
	{
		name: "Rendered",
		description: "Used for images containing 3D renders of humans and humanoids, usually combined with other tags.",
		correct: [
			"Blender Overwatch porn"
		],
		wrong: [
			"render of a room design"
		]
	},
	{
		name: "Scat",
		description: "Pictures involving feces in sexual or otherwise NSFW situations.",
		correct: [
			"feces smeared across someone's genitals"
		],
		wrong: [
			"feces in the toilet, about to be flushed",
			"Scatman John"
		]
	},
	{
		name: "Softcore",
		description: "Determines that the image contains sexual or suggestive content, however, does not involve penetration.",
		correct: [],
		wrong: []
	}
];
