const allowedTypes = ["string", "number", "boolean", "date", "object", "regex"];
const allowedUtilsMethods = [
	"capitalize",
	"randArray",
	"random",
	"randomString",
	"removeAccents",
	"timeDelta",
	"wrapString",
	"zf"
];

module.exports = async function createDebugSandbox (context, scriptArgs) {
	const customUserData = await context.user.getDataProperty("customDeveloperData") ?? {};
	const customChannelData = (context.channel)
		? await context.channel.getDataProperty("sharedCustomData") ?? {}
		: null;

	let userDataChanged = false;
	let channelDataChanged = false;

	const sandbox = {
		aliasStack: (context.append.aliasStack)
			? [...context.append.aliasStack]
			: [],
		args: scriptArgs ?? null,
		channel: context.channel?.Name ?? "(none)",
		console: undefined,
		executor: context.user.Name,
		platform: context.platform.Name,
		tee: Object.freeze([...context.tee]),
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
				else if (value && (typeof value === "object" || typeof value === "function")) {
					throw new Error("Only primitives are accepted as object values");
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
				else if (value && (typeof value === "object" || typeof value === "function")) {
					throw new Error("Only primitives are accepted as object values");
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
			getEmote: (array, fallback) => {
				if (!Array.isArray(array) || array.some(i => typeof i !== "string")) {
					throw new Error("Emotes must be provided as a string Array");
				}

				return context.getBestAvailableEmote(array, fallback);
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

				return sb.Command.parseParameter(value, type);
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
				string = JSON.stringify(customUserData);
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

			await context.user.setDataProperty("customDeveloperData", customUserData);
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
				string = JSON.stringify(customChannelData);
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

			await context.channel.setDataProperty("sharedCustomData", customChannelData);
			return {
				success: true
			};
		}
	};
};
