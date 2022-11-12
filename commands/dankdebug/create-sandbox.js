const allowedTypes = ["string", "number", "boolean", "date", "object", "regex"];
const allowedUtilsMethods = [
	"capitalize",
	"randArray",
	"random",
	"randomString",
	"removeAccents",
	"shuffleArray",
	"timeDelta",
	"wrapString",
	"zf"
];

const advancedStringify = (data) => JSON.stringify(data, (key, value) => {
	if (value instanceof Map) {
		return {
			"@objectRepresentation": "Map",
			entries: [...value.entries()]
		};
	}
	else if (value instanceof Set) {
		return {
			"@objectRepresentation": "Set",
			entries: [...value.entries()]
		};
	}
	else {
		return value;
	}
});

const advancedParse = (string) => JSON.parse(string, (key, value) => {
	if (typeof value === "object" && value !== null) {
		if (value["@objectRepresentation"] === "Map") {
			return new Map(value.entries);
		}
		else if (value["@objectRepresentation"] === "Set") {
			return new Set(value.entries);
		}
	}

	return value;
});

module.exports = async function createDebugSandbox (context, scriptArgs) {
	const rawCustomUserData = await context.user.getDataProperty("customDeveloperData") ?? {};
	const customUserData = advancedParse(JSON.stringify(rawCustomUserData));

	const rawCustomChannelData = await context.channel?.getDataProperty("sharedCustomData") ?? {};
	const customChannelData = (context.channel)
		? advancedParse(JSON.stringify(rawCustomChannelData))
		: null;

	let userDataChanged = false;
	let channelDataChanged = false;

	// When editing the sandbox context, make sure to update the type definitions in ./sandbox.d.ts
	const sandbox = {
		aliasStack: (context.append.aliasStack)
			? [...context.append.aliasStack]
			: [],
		args: scriptArgs ?? null,
		channel: context.channel?.Name ?? "(none)",
		console: undefined,
		executor: context.user.Name,
		platform: context.platform.Name,
		get tee () { return Object.freeze([...context.tee]); },
		_teePush (value) {
			if (typeof value !== "string") {
				throw new Error("Only string values can be pushed to tee");
			}

			return context.tee.push(value);
		},
		channelCustomData: sb.Utils.deepFreeze({
			getKeys: () => {
				if (!customChannelData) {
					throw new Error("There is no channel data available here");
				}

				return Object.keys(customChannelData);
			},
			set: (key, value) => {
				if (!customChannelData) {
					throw new Error("There is no channel data available here");
				}
				else if (typeof key !== "string") {
					throw new Error("Only strings are available as keys");
				}
				else if (customChannelData[key] && !Object.hasOwn(customChannelData, key)) {
					throw new Error("Cannot overwrite prototype properties");
				}

				channelDataChanged = true;
				customChannelData[key] = value;
			},
			get: (key) => {
				if (!customChannelData) {
					throw new Error("There is no channel data available here");
				}

				return (Object.hasOwn(customChannelData, key))
					? customChannelData[key]
					: undefined;
			}
		}),
		customData: sb.Utils.deepFreeze({
			getKeys: () => Object.keys(customUserData),
			set: (key, value) => {
				if (typeof key !== "string") {
					throw new Error("Only strings are available as keys");
				}
				else if (customUserData[key] && !Object.hasOwn(customUserData, key)) {
					throw new Error("Cannot overwrite prototype properties");
				}

				userDataChanged = true;
				customUserData[key] = value;
			},
			get: (key) => (Object.hasOwn(customUserData, key))
				? customUserData[key]
				: undefined
		}),
		utils: {
			getEmote: async (array, fallback) => {
				if (!Array.isArray(array) || array.some(i => typeof i !== "string")) {
					throw new Error("Emotes must be provided as a string Array");
				}

				return await context.getBestAvailableEmote(array, fallback);
			},
			fetchEmotes: async () => {
				let emotes;
				if (context.channel) {
					emotes = await context.channel.fetchEmotes();
				}
				else {
					emotes = await context.platform.fetchGlobalEmotes();
				}

				return emotes;
			},
			parseParameter: (value, type) => {
				if (!allowedTypes.includes(type)) {
					throw new Error("Invalid value type provided");
				}

				return sb.Command.parseParameter(value, type, true);
			},
			parseParametersFromArguments: (definition, args) => {
				if (!Array.isArray(definition) || definition.some(i => typeof i.name !== "string" || typeof i.type !== "string")) {
					throw new Error("Definition must be provided as an Array of { name: string, type: string }");
				}

				else if (!Array.isArray(args) || args.some(i => typeof i !== "string")) {
					throw new Error("Arguments must be provided as a string Array");
				}

				return sb.Command.parseParametersFromArguments(definition, args);
			},
			unping: (string) => {
				if (typeof string !== "string") {
					throw new Error("Passed value must be a string");
				}
				else if (string.length === 0) {
					throw new Error("Empty strings cannot be unpinged");
				}

				return `${string[0]}\u{E0000}${string.slice(1)}`;
			}
		}
	};

	for (const method of allowedUtilsMethods) {
		sandbox.utils[method] = (...args) => sb.Utils[method](...args);
	}

	return {
		sandbox,
		handleUserDataChange: async (limit) => {
			if (!userDataChanged) {
				return {
					success: true
				};
			}

			let string;
			try {
				string = advancedStringify(customUserData);
			}
			catch {
				return {
					success: false,
					reply: `Cannot stringify your custom data object!`
				};
			}

			if (string.length >= limit) {
				return {
					success: false,
					reply: `Your custom data object is too long! Maximum: ${limit}`
				};
			}

			await context.user.setDataProperty("customDeveloperData", JSON.parse(string));
			return {
				success: true
			};
		},
		handleChannelDataChange: async (limit) => {
			if (!context.channel || !channelDataChanged) {
				return {
					success: true
				};
			}

			let string;
			try {
				string = advancedStringify(customChannelData);
			}
			catch {
				return {
					success: false,
					reply: `Cannot stringify the channel custom data object!`
				};
			}

			if (string.length >= limit) {
				return {
					success: false,
					reply: `Your channel custom data object is too long! Maximum: ${limit}`
				};
			}

			await context.user.setDataProperty("sharedCustomData", JSON.parse(string));
			return {
				success: true
			};
		}
	};
};
